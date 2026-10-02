import { config } from '../../config.js';
import { buildIcs, bookingToIcsEvent } from '../ics.js';
import type { RenderedMessage, Template } from './types.js';

export const fmt = (d: string | Date) =>
  new Date(d).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export function layout(title: string, accent: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;padding:32px 16px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08)">
    <div style="background:${accent};padding:28px 32px;color:#fff">
      <div style="font-size:13px;letter-spacing:2px;opacity:.85">CAMPUS RESERVE</div>
      <h1 style="margin:6px 0 0;font-size:22px">${title}</h1>
    </div>
    <div style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.6">${body}</div>
    <div style="padding:18px 32px;background:#f8fafc;color:#94a3b8;font-size:12px">
      This is an automated message from Campus Reserve — Campus Resource Reservation Platform.
    </div>
  </div></body></html>`;
}

export function detailTable(b: any, extraRows = '') {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#64748b;width:130px">${k}</td><td style="padding:6px 0;font-weight:600">${v}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">
    ${row('Booking code', `<span style="font-family:monospace;font-size:16px">${b.code}</span>`)}
    ${row('Resource', `${b.emoji ?? ''} ${b.provider_name}`)}
    ${row('Reservation type', b.service_name)}
    ${row('When', fmt(b.starts_at) + ' – ' + fmtTime(b.ends_at))}
    ${extraRows}
  </table>`;
}

export const tableRow = (k: string, v: string) =>
  `<tr><td style="padding:6px 0;color:#64748b;width:130px">${k}</td><td style="padding:6px 0;font-weight:600">${v}</td></tr>`;

const manageUrl = (b: any) =>
  `${config.clientOrigin}/manage?code=${b.code}&email=${encodeURIComponent(b.customer_email)}`;

const ctaBtn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${label}</a>`;

function icsAttachment(detail: any, method: 'REQUEST' | 'CANCEL', sequence = 0) {
  const content = buildIcs([bookingToIcsEvent(detail, sequence, method === 'CANCEL')], method);
  return {
    filename: `booking-${detail.code}.ics`,
    content,
    contentType: `text/calendar; charset=utf-8; method=${method}`,
  };
}

// ---------------------------------------------------------------- templates

function confirmation(b: any): RenderedMessage {
  const html = layout('Booking confirmed ✔', '#16a34a', `
    <p>Hi ${b.customer_name},</p>
    <p>Your appointment is <strong>confirmed</strong>. Here are the details:</p>
    ${detailTable(b)}
    ${ctaBtn(manageUrl(b), 'View / manage booking')}
    <p style="margin-top:20px;color:#64748b;font-size:13px">Need a different time? You can reschedule or cancel from the link above. A calendar invite is attached.</p>`);
  return {
    subject: `Confirmed: ${b.service_name} on ${fmt(b.starts_at)} [${b.code}]`,
    html,
    attachments: [icsAttachment(b, 'REQUEST', 0)],
  };
}

function cancellation(b: any, payload: any): RenderedMessage {
  const cancelledBy = payload?.cancelledBy ?? 'you';
  const html = layout('Booking cancelled', '#dc2626', `
    <p>Hi ${b.customer_name},</p>
    <p>The following booking was cancelled by <strong>${cancelledBy}</strong>. The slot has been released.</p>
    ${detailTable(b)}
    ${ctaBtn(config.clientOrigin, 'Book a new slot')}`);
  return {
    subject: `Cancelled: ${b.service_name} on ${fmt(b.starts_at)} [${b.code}]`,
    html,
    attachments: [icsAttachment(b, 'CANCEL', payload?.sequence ?? 1)],
  };
}

function rescheduled(b: any, payload: any): RenderedMessage {
  const oldWhen = payload?.oldStartsAt ? fmt(payload.oldStartsAt) : '';
  const html = layout('Booking rescheduled 🔁', '#6366f1', `
    <p>Hi ${b.customer_name},</p>
    <p>Your appointment has been moved${oldWhen ? ` from <s style="color:#94a3b8">${oldWhen}</s>` : ''} to:</p>
    ${detailTable(b)}
    ${ctaBtn(manageUrl(b), 'View / manage booking')}
    <p style="margin-top:20px;color:#64748b;font-size:13px">An updated calendar invite is attached.</p>`);
  return {
    subject: `Rescheduled: ${b.service_name} now on ${fmt(b.starts_at)} [${b.code}]`,
    html,
    attachments: [icsAttachment(b, 'REQUEST', payload?.sequence ?? 1)],
  };
}

function reminder(b: any, when: string, subjectPrefix: string): RenderedMessage {
  const html = layout(`Appointment reminder ⏰`, '#6366f1', `
    <p>Hi ${b.customer_name},</p>
    <p>A friendly reminder — your appointment is <strong>${when}</strong>:</p>
    ${detailTable(b)}
    ${ctaBtn(manageUrl(b), 'View / manage booking')}`);
  return { subject: `${subjectPrefix}: ${b.service_name} on ${fmt(b.starts_at)} [${b.code}]`, html };
}

export function render(
  n: { template: Template; payload: Record<string, any> },
  detail: any
): RenderedMessage {
  switch (n.template) {
    case 'confirmation': return confirmation(detail);
    case 'cancellation': return cancellation(detail, n.payload);
    case 'rescheduled': return rescheduled(detail, n.payload);
    case 'reminder_24h': return reminder(detail, 'tomorrow', 'Reminder');
    case 'reminder_1h': return reminder(detail, 'starting in about an hour', 'Starting soon');
    default:
      // waitlist_slot_open / series_* render via renderExtra registrations
      const extra = extraRenderers[n.template];
      if (extra) return extra(n.payload, detail);
      throw new Error(`No renderer for template ${n.template}`);
  }
}

/** Later features (waitlist, series) register their renderers here. */
export const extraRenderers: Partial<Record<Template, (payload: any, detail: any) => RenderedMessage>> = {};
