import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { fmtDateTime, fmtTime } from '../format';
import type { Booking, Provider, Slot } from '../types';
import SlotPicker from './SlotPicker';

interface Props {
  booking: Booking;
  /** Email that owns the booking (guest lookup email or the account email). */
  email: string;
  /** Use the authenticated customer endpoint instead of the code+email one. */
  useCustomerApi?: boolean;
  onDone: (updated: Booking) => void;
  onClose: () => void;
}

export default function RescheduleDialog({ booking, email, useCustomerApi, onDone, onClose }: Props) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api.get<Provider>(`/api/providers/${booking.provider_id}`)
      .then(setProvider)
      .catch(() => setError('无法加载空档信息'));
  }, [booking.provider_id]);

  async function confirm() {
    if (!slot) return;
    setBusy(true);
    setError('');
    try {
      const updated = useCustomerApi
        ? await api.post<Booking>(`/api/customer/bookings/${booking.id}/reschedule`, { start: slot.start })
        : await api.post<Booking>(`/api/bookings/${booking.code}/reschedule`, { email, start: slot.start });
      onDone(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message + ' 空档列表已刷新。');
        setSlot(null);
        setRefreshKey((k) => k + 1);
      } else {
        setError(err instanceof Error ? err.message : '改期失败');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reschedule-box">
      <div className="panel-head">
        <h2>选择新的时间</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ 关闭</button>
      </div>
      <p className="muted small">
        Currently: {fmtDateTime(booking.starts_at)} – {fmtTime(booking.ends_at)}
      </p>
      {provider ? (
        <SlotPicker
          provider={provider}
          serviceId={booking.service_id}
          excludeBookingId={booking.id}
          slot={slot}
          onSelect={setSlot}
          refreshKey={refreshKey}
        />
      ) : (
        <p className="muted">正在加载…</p>
      )}
      {error && <p className="error-box">{error}</p>}
      <button className="btn btn-primary" disabled={!slot || busy} onClick={confirm}>
        {busy ? '改期中…' : slot ? `改到 ${fmtDateTime(slot.start)}` : '请选择新的时间'}
      </button>
    </div>
  );
}
