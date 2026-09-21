import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { fmtDateTime, fmtTime, money, STATUS_LABELS } from '../format';
import type { Booking } from '../types';

export default function Receipt() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code || !email) {
      setError('请从收据邮件或预约确认页面打开此页面。');
      return;
    }
    api.get<Booking>(`/api/bookings/${code}/receipt?email=${encodeURIComponent(email)}`)
      .then(setBooking)
      .catch((err) => setError(err instanceof ApiError ? err.message : '无法加载收据'));
  }, [code, email]);

  if (error) {
    return (
      <div className="container center-page">
        <p className="error-box">{error}</p>
        <Link to="/manage" className="btn btn-ghost">查询预约</Link>
      </div>
    );
  }
  if (!booking) return <div className="container"><p className="muted">正在加载收据…</p></div>;

  const captured = (booking.payments ?? []).filter((p) =>
    ['captured', 'partially_refunded', 'refunded'].includes(p.status)
  );
  const paid = captured.reduce((s, p) => s + p.amount_cents, 0);
  const refunded = captured.flatMap((p) => p.refunds ?? []).reduce((s, r) => s + r.amount_cents, 0);
  const net = booking.price_cents - (booking.discount_cents ?? 0);
  const venueBalance = Math.max(0, net - paid);

  return (
    <div className="container narrow-page receipt-page">
      <div className="step-card receipt-card">
        <div className="receipt-head">
          <div>
            <div className="brand">📅 Book<span className="brand-accent">It</span></div>
            <p className="muted small">预约管理系统</p>
          </div>
          <div className="receipt-meta">
            <strong>收据</strong>
            <span className="mono">{booking.code}</span>
            <span className="muted small">{fmtDateTime(new Date())}</span>
          </div>
        </div>

        <div className="confirm-details">
          <div><span>客户</span><strong>{booking.customer_name} ({booking.customer_email})</strong></div>
          <div><span>服务商</span><strong>{booking.emoji} {booking.provider_name}</strong></div>
          <div><span>服务</span><strong>{booking.service_name}</strong></div>
          <div><span>预约时间</span><strong>{fmtDateTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</strong></div>
          <div><span>状态</span><strong>{STATUS_LABELS[booking.status] ?? booking.status}</strong></div>
        </div>

        <table className="table receipt-table">
          <tbody>
            <tr><td>服务价格</td><td className="right">{money(booking.price_cents)}</td></tr>
            {(booking.discount_cents ?? 0) > 0 && (
              <tr><td>优惠{booking.coupon_code ? ` (${booking.coupon_code})` : ''}{(booking.points_redeemed ?? 0) > 0 ? ` · ${booking.points_redeemed} 积分` : ''}</td>
                <td className="right">− {money(booking.discount_cents!)}</td></tr>
            )}
            <tr><td><strong>合计</strong></td><td className="right"><strong>{money(net)}</strong></td></tr>
            {captured.map((p) => (
              <tr key={p.id}>
                <td>线上支付（{p.method || p.provider} · <span className="mono">{p.payment_id ?? p.order_id}</span>）</td>
                <td className="right">{money(p.amount_cents)}</td>
              </tr>
            ))}
            {captured.flatMap((p) => p.refunds ?? []).map((r) => (
              <tr key={`r${r.id}`}>
                <td>退款（{r.reason.replace(/_/g, ' ')}）</td>
                <td className="right">− {money(r.amount_cents)}</td>
              </tr>
            ))}
            {venueBalance > 0 && booking.status !== 'cancelled' && (
              <tr><td>到店应付</td><td className="right">{money(venueBalance)}</td></tr>
            )}
          </tbody>
        </table>

        {refunded > 0 && (
          <p className="muted small">退款将在 3–5 个工作日内原路退回。</p>
        )}

        <div className="btn-row no-print">
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ 打印 / 保存为 PDF</button>
          <Link className="btn btn-ghost" to={`/manage?code=${booking.code}&email=${encodeURIComponent(email)}`}>
            管理预约
          </Link>
        </div>
      </div>
    </div>
  );
}
