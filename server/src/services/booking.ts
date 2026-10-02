import { pool } from '../db/pool.js';
import { computeSlots } from './slots.js';
import { enqueue, enqueueBookingLifecycle, enqueueReminders, voidReminders } from './notify/outbox.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const genCode = () =>
  'BK-' + Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

export class BookingConflictError extends Error {
  status = 409;
  constructor(msg = 'That slot was just taken. Please pick another one.') {
    super(msg);
  }
}

export interface CreateBookingInput {
  providerId: number;
  serviceId: number;
  start: string;
  customer: { name: string; email: string; phone?: string };
  notes?: string;
}

export interface CreateBookingOptions {
  notify?: 'full' | 'reminders_only';
  seriesId?: number;
}

/**
 * Creates a campus resource reservation with three layers of conflict protection:
 * advisory lock, slot re-validation inside the transaction, and a PostgreSQL
 * exclusion constraint on the reservation time range.
 */
export async function createBooking(input: CreateBookingInput, opts: CreateBookingOptions = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::int, $2::int)', [42, input.providerId]);

    const requested = new Date(input.start);
    if (isNaN(requested.getTime())) {
      throw Object.assign(new Error('Invalid start time'), { status: 400 });
    }
    const dateStr = `${requested.getFullYear()}-${String(requested.getMonth() + 1).padStart(2, '0')}-${String(requested.getDate()).padStart(2, '0')}`;
    const { slots, service, provider } = await computeSlots(client, input.providerId, input.serviceId, dateStr);
    const slot = slots.find((s) => new Date(s.start).getTime() === requested.getTime());
    if (!slot) throw new BookingConflictError('That slot is no longer available.');

    const { rows: [customer] } = await client.query(
      `INSERT INTO customers (name, email, phone)
       VALUES ($1, lower($2), $3)
       ON CONFLICT (email) DO UPDATE SET
         name = CASE WHEN customers.password_hash IS NULL THEN EXCLUDED.name ELSE customers.name END,
         phone = CASE WHEN customers.password_hash IS NULL AND EXCLUDED.phone <> ''
                      THEN EXCLUDED.phone ELSE customers.phone END
       RETURNING *`,
      [input.customer.name.trim(), input.customer.email.trim(), input.customer.phone?.trim() ?? '']
    );

    const { rows: [booking] } = await client.query(
      `INSERT INTO bookings (code, provider_id, service_id, customer_id, starts_at, ends_at,
                             status, notes, series_id)
       VALUES ($1,$2,$3,$4,$5,$6,'confirmed',$7,$8) RETURNING *`,
      [genCode(), input.providerId, input.serviceId, customer.id, slot.start, slot.end,
       input.notes?.trim() ?? '', opts.seriesId ?? null]
    );

    await client.query(
      `INSERT INTO booking_events (booking_id, event, actor, detail) VALUES ($1,'created','customer',$2)`,
      [booking.id, `Booked ${service.name} via web`]
    );

    await client.query(
      `UPDATE waitlist SET status = 'converted'
       WHERE provider_id = $1 AND date = $2::date AND lower(email) = lower($3)
         AND status IN ('waiting', 'notified')`,
      [input.providerId, dateStr, customer.email]
    );

    await enqueueBookingLifecycle(client, {
      id: booking.id,
      startsAt: booking.starts_at,
      recipient: customer.email,
    }, { confirmation: opts.notify !== 'reminders_only' });

    await client.query('COMMIT');
    return { booking, customer, service, provider };
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23P01') throw new BookingConflictError();
    if (err.code === '23505' && err.constraint === 'bookings_code_key') {
      throw new BookingConflictError('Please retry your booking.');
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function rescheduleBooking(bookingId: number, newStart: string, actor: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [pre] } = await client.query('SELECT provider_id FROM bookings WHERE id = $1', [bookingId]);
    if (!pre) throw Object.assign(new Error('Booking not found'), { status: 404 });
    await client.query('SELECT pg_advisory_xact_lock($1::int, $2::int)', [42, pre.provider_id]);

    const { rows: [booking] } = await client.query(
      `SELECT b.*, c.email AS customer_email, p.reschedule_cutoff_min
       FROM bookings b
       JOIN customers c ON c.id = b.customer_id
       JOIN providers p ON p.id = b.provider_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId]
    );
    if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });
    if (booking.status !== 'confirmed') {
      throw Object.assign(new Error(`A ${booking.status} booking cannot be rescheduled`), { status: 400 });
    }
    const now = new Date();
    const currentStart = new Date(booking.starts_at);
    if (currentStart <= now) {
      throw Object.assign(new Error('Past bookings cannot be rescheduled'), { status: 400 });
    }
    if (now.getTime() > currentStart.getTime() - booking.reschedule_cutoff_min * 60000) {
      throw Object.assign(new Error('This booking is too close to its start time to reschedule online — please cancel instead'), { status: 400 });
    }

    const requested = new Date(newStart);
    if (isNaN(requested.getTime())) throw Object.assign(new Error('Invalid start time'), { status: 400 });
    const dateStr = `${requested.getFullYear()}-${String(requested.getMonth() + 1).padStart(2, '0')}-${String(requested.getDate()).padStart(2, '0')}`;
    const { slots } = await computeSlots(client, booking.provider_id, booking.service_id, dateStr, bookingId);
    const slot = slots.find((s) => new Date(s.start).getTime() === requested.getTime());
    if (!slot) throw new BookingConflictError('That slot is no longer available.');

    const { rows: [updated] } = await client.query(
      `UPDATE bookings SET starts_at = $2, ends_at = $3, updated_at = now() WHERE id = $1 RETURNING *`,
      [bookingId, slot.start, slot.end]
    );
    await client.query(
      `INSERT INTO booking_events (booking_id, event, actor, detail) VALUES ($1, 'rescheduled', $2, $3)`,
      [bookingId, actor, `From ${currentStart.toISOString()} to ${slot.start}`]
    );
    const { rows: [{ count: sequence }] } = await client.query(
      `SELECT count(*)::int AS count FROM booking_events WHERE booking_id = $1 AND event = 'rescheduled'`,
      [bookingId]
    );
    await voidReminders(client, bookingId, { includeSent: true });
    await enqueueReminders(client, { id: bookingId, startsAt: slot.start, recipient: booking.customer_email });
    await enqueue(client, {
      bookingId,
      template: 'rescheduled',
      recipient: booking.customer_email,
      payload: { oldStartsAt: booking.starts_at, sequence },
    });
    await client.query('COMMIT');
    return updated;
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23P01') throw new BookingConflictError();
    throw err;
  } finally {
    client.release();
  }
}

export interface CancelOptions {
  cancelledBy: 'you' | 'the provider';
  notify?: boolean;
  reason?: string;
}

export async function cancelBooking(bookingId: number, actor: string, opts: CancelOptions) {
  const client = await pool.connect();
  let booking: any;
  try {
    await client.query('BEGIN');
    const { rows: [row] } = await client.query(
      `SELECT b.*, c.email AS customer_email
       FROM bookings b JOIN customers c ON c.id = b.customer_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [bookingId]
    );
    booking = row;
    if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });
    if (booking.status !== 'confirmed') {
      throw Object.assign(new Error(`This booking is already ${booking.status}`), { status: 400 });
    }

    await client.query(`UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = $1`, [bookingId]);
    await client.query(
      `INSERT INTO booking_events (booking_id, event, actor, detail) VALUES ($1, 'cancelled', $2, $3)`,
      [bookingId, actor, opts.reason ?? '']
    );
    await voidReminders(client, bookingId);
    if (opts.notify !== false) {
      const { rows: [{ count: reschedules }] } = await client.query(
        `SELECT count(*)::int AS count FROM booking_events WHERE booking_id = $1 AND event = 'rescheduled'`,
        [bookingId]
      );
      await enqueue(client, {
        bookingId,
        template: 'cancellation',
        recipient: booking.customer_email,
        payload: { cancelledBy: opts.cancelledBy, sequence: reschedules + 1 },
      });
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await notifyWaitlistOfFreedSlot(booking);
  return { booking };
}

let notifyWaitlistOfFreedSlot: (booking: any) => Promise<void> = async () => {};
export function setWaitlistHook(fn: (booking: any) => Promise<void>) {
  notifyWaitlistOfFreedSlot = fn;
}

export async function getBookingDetail(where: string, params: unknown[]) {
  const { rows } = await pool.query(
    `SELECT b.*,
            c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
            s.name AS service_name, s.duration_min,
            p.name AS provider_name, p.title AS provider_title, p.resource_type, p.emoji, p.color,
            p.reschedule_cutoff_min,
            EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed,
            sr.code AS series_code
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     JOIN services s ON s.id = b.service_id
     JOIN providers p ON p.id = b.provider_id
     LEFT JOIN booking_series sr ON sr.id = b.series_id
     WHERE ${where}`,
    params
  );
  return rows[0] ?? null;
}
