import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { fmtDateTime, fmtTime, money, STATUS_LABELS } from '../format';
import type { Booking } from '../types';
import RescheduleDialog from '../components/RescheduleDialog';
import ReviewForm from '../components/ReviewForm';

export default function Manage() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      setBooking(await api.get<Booking>(
        `/api/bookings/lookup?code=${encodeURIComponent(code.trim())}&email=${encodeURIComponent(email.trim())}`
      ));
    } catch (err) {
      setBooking(null);
      setError(err instanceof ApiError ? err.message : '查询失败');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (params.get('code') && params.get('email')) void lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cancel() {
    if (!booking) return;
    let msg = '确定取消此预约吗？该时间段将被释放。';
    try {
      const p = await api.get<{ paid: boolean; refund: { amountCents: number; paidCents: number } | null }>(
        `/api/bookings/${booking.code}/refund-preview?email=${encodeURIComponent(email.trim())}`
      );
      if (p.paid && p.refund) {
        msg =
          p.refund.amountCents > 0
            ? `确定取消此预约吗？你已支付的 ${money(p.refund.paidCents)} 中将退还 ${money(p.refund.amountCents)}。`
            : '确定取消此预约吗？根据取消政策，临近预约时间取消不予退款。';
      }
    } catch {
      /* preview is best-effort */
    }
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError('');
    try {
      setBooking(await api.post<Booking>(`/api/bookings/${booking.code}/cancel`, { email }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '取消预约失败');
    } finally {
      setBusy(false);
    }
  }

  const upcoming = booking && booking.status === 'confirmed' && new Date(booking.starts_at) > new Date();
  const canReschedule =
    upcoming &&
    new Date() <
      new Date(new Date(booking!.starts_at).getTime() - (booking!.reschedule_cutoff_min ?? 120) * 60000);

  return (
    <div className="container narrow-page">
      <h1>管理你的预约</h1>
      <p className="muted">请输入确认邮件中的预约码。</p>

      <form onSubmit={lookup} className="lookup-form">
        <input className="input" placeholder="预约码（例如 BK-7F3K2A）" required
          value={code} onChange={(e) => setCode(e.target.value)} />
        <input className="input" type="email" placeholder="预约时使用的邮箱" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn btn-primary" disabled={busy}>{busy ? '查询中…' : '查询预约'}</button>
      </form>

      {error && <p className="error-box">{error}</p>}

      {booking && (
        <div className="manage-card">
          <div className="manage-head">
            <div className="provider-avatar" style={{ background: booking.color }}>{booking.emoji}</div>
            <div>
              <h2>{booking.provider_name}</h2>
              <p className="muted">{booking.service_name}</p>
            </div>
            <span className={`badge badge-${booking.status}`}>{STATUS_LABELS[booking.status]}</span>
          </div>
          <div className="confirm-details">
            <div><span>预约码</span><strong>{booking.code}</strong></div>
            <div><span>时间</span><strong>{fmtDateTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</strong></div>
            <div><span>预约人</span><strong>{booking.customer_name}</strong></div>
            <div><span>价格</span><strong>{money(booking.price_cents)}</strong></div>
            {(booking.discount_cents ?? 0) > 0 && (
              <div><span>优惠</span><strong>− {money(booking.discount_cents!)}</strong></div>
            )}
            {booking.refund && booking.refund.amountCents > 0 && (
              <div><span>退款</span><strong>已发起 {money(booking.refund.amountCents)}</strong></div>
            )}
            {booking.notes && <div><span>备注</span><strong>{booking.notes}</strong></div>}
          </div>
          {booking.status === 'pending_payment' && booking.expires_at && new Date(booking.expires_at) > new Date() && (
            <Link
              className="btn btn-primary"
              to={`/checkout/${booking.code}?email=${encodeURIComponent(email.trim())}`}
            >
              💳 完成支付
            </Link>
          )}
          {(booking.amount_due_cents ?? 0) > 0 && booking.status !== 'pending_payment' && (
            <Link className="panel-link" to={`/receipt/${booking.code}?email=${encodeURIComponent(email.trim())}`}>
              🧾 查看收据
            </Link>
          )}
          {upcoming && (
            <div className="btn-row">
              {canReschedule && (
                <button className="btn btn-ghost" onClick={() => setRescheduling((r) => !r)} disabled={busy}>
                  🔁 改期
                </button>
              )}
              <button className="btn btn-danger" onClick={cancel} disabled={busy}>
                {busy ? '取消中…' : '取消预约'}
              </button>
            </div>
          )}
          {booking.series_code && upcoming && (
            <div className="series-cancel-row">
              <span className="muted small">
                系列预约 <strong className="mono">{booking.series_code}</strong>
              </span>
              <button
                className="btn btn-danger-ghost btn-sm"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm('确定取消此系列中所有剩余预约吗？')) return;
                  setBusy(true);
                  setError('');
                  try {
                    await api.post(`/api/bookings/series/${booking.series_code}/cancel`, { email });
                    void lookup();
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : '取消系列预约失败');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                取消剩余系列预约
              </button>
            </div>
          )}
          {rescheduling && booking && (
            <RescheduleDialog
              booking={booking}
              email={email}
              onDone={(b) => {
                setBooking(b);
                setRescheduling(false);
              }}
              onClose={() => setRescheduling(false)}
            />
          )}
          {booking.status === 'completed' && !booking.reviewed && (
            <ReviewForm
              onSubmit={async (rating, comment) => {
                await api.post(`/api/bookings/${booking.code}/review`, { email, rating, comment });
                setBooking({ ...booking, reviewed: true });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
