import { Link, useLocation } from 'react-router-dom';
import { fmtDateTime, fmtTime, money } from '../format';
import type { Booking } from '../types';

interface SeriesResult {
  series: { code: string };
  booked: Booking[];
  skipped: { start: string; reason: string }[];
}

export default function Confirmation() {
  const state = useLocation().state as { booking?: Booking; series?: SeriesResult } | null;
  const booking = state?.booking;
  const series = state?.series;

  if (!booking) {
    return (
      <div className="container center-page">
        <p className="muted">这里暂时没有内容。</p>
        <Link to="/" className="btn btn-primary">返回首页</Link>
      </div>
    );
  }

  return (
    <div className="container center-page">
      <div className="confirm-card">
        <div className="confirm-tick">✓</div>
        <h1>{series ? `已预约 ${series.booked.length} 次！` : '预约成功！'}</h1>
        <p className="muted">
          确认邮件已发送至 <strong>{booking.customer_email}</strong>。
        </p>
        <div className="confirm-code">
          <span>{series ? '系列预约码' : '预约码'}</span>
          <strong>{series ? series.series.code : booking.code}</strong>
        </div>
        {series && (
          <div className="series-summary">
            <ul className="series-list">
              {series.booked.map((b) => (
                <li key={b.code}>
                  ✅ {fmtDateTime(b.starts_at)} <span className="mono muted small">[{b.code}]</span>
                </li>
              ))}
            </ul>
            {series.skipped.length > 0 && (
              <div className="error-box">
                <strong>有 {series.skipped.length} 个日期无法预约：</strong>
                <ul className="series-list">
                  {series.skipped.map((s) => (
                    <li key={s.start}>{fmtDateTime(s.start)} — {s.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="confirm-details">
          <div><span>服务商</span><strong>{booking.emoji} {booking.provider_name}</strong></div>
          <div><span>服务</span><strong>{booking.service_name}</strong></div>
          <div><span>时间</span><strong>{fmtDateTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</strong></div>
          <div><span>价格</span><strong>{money(booking.price_cents)}</strong></div>
          {(booking.discount_cents ?? 0) > 0 && (
            <div>
              <span>优惠{booking.coupon_code ? ` (${booking.coupon_code})` : ''}</span>
              <strong>− {money(booking.discount_cents!)}</strong>
            </div>
          )}
          {(booking.amount_due_cents ?? 0) > 0 && (
            <div><span>线上已付</span><strong>{money(booking.amount_due_cents!)}</strong></div>
          )}
          {(booking.amount_due_cents ?? 0) > 0 &&
            booking.price_cents - (booking.discount_cents ?? 0) - booking.amount_due_cents! > 0 && (
            <div>
              <span>到店支付</span>
              <strong>{money(booking.price_cents - (booking.discount_cents ?? 0) - booking.amount_due_cents!)}</strong>
            </div>
          )}
        </div>
        <div className="confirm-actions">
          {(booking.amount_due_cents ?? 0) > 0 && (
            <Link className="btn btn-ghost" to={`/receipt/${booking.code}?email=${encodeURIComponent(booking.customer_email)}`}>
              🧾 收据
            </Link>
          )}
          <Link className="btn btn-ghost" to={`/manage?code=${booking.code}&email=${encodeURIComponent(booking.customer_email)}`}>
            管理预约
          </Link>
          <Link className="btn btn-primary" to="/">再次预约</Link>
        </div>
      </div>
    </div>
  );
}
