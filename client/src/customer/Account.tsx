import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { fmtDateTime, fmtTime, money, STATUS_LABELS } from '../format';
import type { Booking, Provider } from '../types';
import { RatingBadge } from '../components/Stars';
import { clearSession, useCustomer } from './auth';
import RescheduleDialog from '../components/RescheduleDialog';
import ReviewForm from '../components/ReviewForm';

export default function Account() {
  const user = useCustomer();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reschedulingId, setReschedulingId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const [favorites, setFavorites] = useState<Provider[]>([]);

  const load = useCallback(() => {
    api.get<Booking[]>('/api/customer/bookings')
      .then(setBookings)
      .catch((err) => setError(err instanceof ApiError ? err.message : '加载预约失败'));
    api.get<Provider[]>('/api/customer/favorites').then(setFavorites).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/account/login');
      return;
    }
    load();
  }, [user, navigate, load]);

  if (!user) return null;

  const now = new Date();
  const upcoming = (bookings ?? []).filter((b) => b.status === 'confirmed' && new Date(b.starts_at) > now);
  const past = (bookings ?? []).filter((b) => !(b.status === 'confirmed' && new Date(b.starts_at) > now));

  async function cancel(b: Booking) {
    if (!window.confirm('确定取消此预约吗？该时间段将被释放。')) return;
    setBusyId(b.id);
    setError('');
    try {
      await api.post(`/api/bookings/${b.code}/cancel`, { email: user!.email });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '取消预约失败');
    } finally {
      setBusyId(null);
    }
  }

  function signOut() {
    clearSession();
    navigate('/');
  }

  return (
    <div className="container">
      <div className="account-head">
        <div>
          <h1>你好，{user.name.split(' ')[0]} 👋</h1>
          <p className="muted">{user.email}</p>
        </div>
        <button className="btn btn-ghost" onClick={signOut}>退出登录</button>
      </div>

      {error && <p className="error-box">{error}</p>}

      <section className="step-card">
        <h2>即将到来的预约</h2>
        {bookings === null && <p className="muted">正在加载…</p>}
        {bookings !== null && upcoming.length === 0 && (
          <p className="muted">
            还没有预约——<Link to="/">查找服务商</Link>开始预约吧。
          </p>
        )}
        <div className="booking-list">
          {upcoming.map((b) => (
            <div key={b.id} className="manage-card account-booking">
              <div className="manage-head">
                <div className="provider-avatar" style={{ background: b.color }}>{b.emoji}</div>
                <div>
                  <h2>{b.provider_name}</h2>
                  <p className="muted">{b.service_name} · {money(b.price_cents)}</p>
                </div>
                <span className={`badge badge-${b.status}`}>{STATUS_LABELS[b.status]}</span>
              </div>
              <div className="confirm-details">
                <div><span>预约码</span><strong className="mono">{b.code}</strong></div>
                <div><span>时间</span><strong>{fmtDateTime(b.starts_at)} – {fmtTime(b.ends_at)}</strong></div>
              </div>
              <div className="btn-row">
                {new Date() <
                  new Date(new Date(b.starts_at).getTime() - (b.reschedule_cutoff_min ?? 120) * 60000) && (
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === b.id}
                    onClick={() => setReschedulingId(reschedulingId === b.id ? null : b.id)}
                  >
                    🔁 改期
                  </button>
                )}
                <button className="btn btn-danger-ghost btn-sm" disabled={busyId === b.id} onClick={() => cancel(b)}>
                  {busyId === b.id ? '取消中…' : '取消预约'}
                </button>
              </div>
              {reschedulingId === b.id && (
                <RescheduleDialog
                  booking={b}
                  email={user.email}
                  useCustomerApi
                  onDone={() => {
                    setReschedulingId(null);
                    load();
                  }}
                  onClose={() => setReschedulingId(null)}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {favorites.length > 0 && (
        <section className="step-card">
          <h2>❤️ Your favorites</h2>
          <div className="fav-grid">
            {favorites.map((p) => (
              <Link key={p.id} to={`/provider/${p.id}`} className="fav-card">
                <div className="provider-avatar" style={{ background: p.color }}>{p.emoji}</div>
                <div>
                  <strong>{p.name}</strong>
                  <p className="muted small">{p.title} <RatingBadge avg={p.avg_rating} count={p.review_count} /></p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="step-card">
        <h2>预约记录</h2>
        {bookings !== null && past.length === 0 && <p className="muted">暂无历史预约。</p>}
        <div className="booking-list">
          {past.map((b) => (
            <div key={b.id} className="history-block">
              <div className="history-row">
                <div className="mini-avatar" style={{ background: b.color }}>{b.emoji}</div>
                <div className="history-info">
                  <strong>{b.provider_name}</strong>
                  <span className="muted small">{b.service_name} · {fmtDateTime(b.starts_at)}</span>
                </div>
                {b.status === 'completed' && !b.reviewed && (
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => setReviewingId(reviewingId === b.id ? null : b.id)}
                  >
                    ⭐ 评价
                  </button>
                )}
                <span className={`badge badge-${b.status}`}>{STATUS_LABELS[b.status]}</span>
              </div>
              {reviewingId === b.id && (
                <ReviewForm
                  onSubmit={async (rating, comment) => {
                    await api.post(`/api/customer/bookings/${b.id}/review`, { rating, comment });
                    load();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
