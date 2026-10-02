import { Link, useLocation } from 'react-router-dom';
import { fmtDateTime, fmtTime } from '../format';
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
          <div><span>资源</span><strong>{booking.emoji} {booking.provider_name}</strong></div>
          <div><span>预约项目</span><strong>{booking.service_name}</strong></div>
          <div><span>时间</span><strong>{fmtDateTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</strong></div>
        </div>
        <div className="confirm-actions">
          <Link className="btn btn-ghost" to={`/manage?code=${booking.code}&email=${encodeURIComponent(booking.customer_email)}`}>
            管理预约
          </Link>
          <Link className="btn btn-primary" to="/">再次预约</Link>
        </div>
      </div>
    </div>
  );
}
