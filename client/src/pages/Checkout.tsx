import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { fmtDateTime, fmtTime, money } from '../format';
import type { Booking, PaymentInfo } from '../types';

export default function Checkout() {
  const { code } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const stateBooking = (location.state as { booking?: Booking } | null)?.booking;
  const [booking, setBooking] = useState<Booking | null>(stateBooking ?? null);
  const [payment, setPayment] = useState<PaymentInfo | null>(stateBooking?.payment ?? null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // deep-link recovery (e.g. "Complete payment" from the manage page)
  useEffect(() => {
    if (booking && payment) return;
    const email = params.get('email') ?? booking?.customer_email;
    if (!email || !code) return;
    api.get<Booking>(`/api/bookings/${code}/receipt?email=${encodeURIComponent(email)}`)
      .then((r) => {
        if (r.status !== 'pending_payment') {
          navigate(`/manage?code=${code}&email=${encodeURIComponent(email)}`, { replace: true });
          return;
        }
        const open = (r.payments ?? []).find((p) => p.status === 'created');
        setBooking(r);
        if (open) {
          setPayment({
            required: true,
            orderId: open.order_id,
            amountCents: open.amount_cents,
            currency: open.currency,
            expiresAt: r.expires_at!,
            provider: 'mock',
          });
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : '无法加载此订单'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!booking || !payment) {
    return (
      <div className="container center-page">
        {error ? <p className="error-box">{error}</p> : <p className="muted">正在加载支付页面…</p>}
        <Link to="/manage" className="btn btn-ghost">查询预约</Link>
      </div>
    );
  }

  const msLeft = new Date(payment.expiresAt).getTime() - now;
  const expired = msLeft <= 0;
  const mm = String(Math.max(0, Math.floor(msLeft / 60000))).padStart(2, '0');
  const ss = String(Math.max(0, Math.floor((msLeft % 60000) / 1000))).padStart(2, '0');
  const balance = booking.price_cents - (booking.discount_cents ?? 0) - payment.amountCents;

  async function pay(outcome: 'success' | 'failure') {
    setBusy(true);
    setError('');
    try {
      const { paymentId, signature } = await api.post<{ paymentId: string; signature: string }>(
        '/api/payments/mock/pay',
        { orderId: payment!.orderId, outcome }
      );
      const detail = await api.post<Booking>('/api/payments/verify', {
        code: booking!.code,
        orderId: payment!.orderId,
        paymentId,
        signature,
      });
      navigate('/confirmation', { state: { booking: detail } });
    } catch (err) {
      setError(err instanceof Error ? err.message : '支付失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container narrow-page">
      <h1>完成支付</h1>
      <p className="muted">
        该时间段已为你保留{expired ? '，但保留时间已过期' : '，请完成支付'}。
      </p>

      <div className="step-card">
        <div className="manage-head">
          <div className="provider-avatar" style={{ background: booking.color }}>{booking.emoji}</div>
          <div>
            <h2>{booking.provider_name}</h2>
            <p className="muted">{booking.service_name}</p>
          </div>
          <span className={`checkout-timer ${expired ? 'expired' : ''}`}>
            {expired ? 'Expired' : `${mm}:${ss}`}
          </span>
        </div>
        <div className="confirm-details">
          <div><span>预约码</span><strong className="mono">{booking.code}</strong></div>
          <div><span>时间</span><strong>{fmtDateTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</strong></div>
          <div><span>价格</span><strong>{money(booking.price_cents)}</strong></div>
          {(booking.discount_cents ?? 0) > 0 && (
            <div><span>优惠{booking.coupon_code ? ` (${booking.coupon_code})` : ''}</span><strong>− {money(booking.discount_cents!)}</strong></div>
          )}
          <div><span>现在支付</span><strong>{money(payment.amountCents)}</strong></div>
          {balance > 0 && <div><span>到店支付</span><strong>{money(balance)}</strong></div>}
        </div>

        {expired ? (
          <div>
            <p className="error-box">支付时间已过，预约时间段已释放。请选择新的时间。</p>
            <Link className="btn btn-primary" to={`/provider/${booking.provider_id}`}>重新预约</Link>
          </div>
        ) : (
          <div className="mockpay-card">
            <div className="mockpay-head">
              <strong>模拟支付</strong>
              <span className="muted small">模拟支付网关——不会产生真实扣款</span>
            </div>
            {error && <p className="error-box">{error}</p>}
            <div className="btn-row">
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => pay('success')}>
                {busy ? '处理中…' : `支付 ${money(payment.amountCents)}`}
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => pay('failure')}>
                模拟支付失败
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
