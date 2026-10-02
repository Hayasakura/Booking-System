import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { fmtTime, hhmm, WEEKDAYS, WEEKDAYS_SHORT } from '../format';
import type { Booking, Provider, Service, Slot } from '../types';
import { useCustomer } from '../customer/auth';
import { useFavorites } from '../customer/favorites';
import SlotPicker from '../components/SlotPicker';
import WaitlistForm from '../components/WaitlistForm';
import { RatingBadge, Stars } from '../components/Stars';

interface Review { rating: number; comment: string; created_at: string; customer_name: string; service_name: string }

export default function ProviderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useCustomer();
  const fav = useFavorites();
  const [params] = useSearchParams();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [repeat, setRepeat] = useState<'once' | 'weekly' | 'biweekly'>('once');
  const [occurrences, setOccurrences] = useState(4);
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: '', notes: '' });

  useEffect(() => {
    let alive = true;
    setLoadError('');
    Promise.all([
      api.get<Provider>(`/api/providers/${id}`),
      api.get<Review[]>(`/api/providers/${id}/reviews`),
    ]).then(([p, r]) => {
      if (!alive) return;
      setProvider(p);
      setReviews(r);
      const wanted = Number(params.get('serviceId'));
      const selected = wanted ? p.services?.find((s) => s.id === wanted) : p.services?.[0];
      if (selected) setService(selected);
    }).catch((err) => alive && setLoadError(err instanceof Error ? err.message : '资源加载失败'));
    return () => { alive = false; };
  }, [id, params]);

  useEffect(() => {
    setForm((current) => ({ ...current, name: user?.name ?? current.name, email: user?.email ?? current.email }));
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!provider || !service || !slot) return;
    setSubmitting(true); setError('');
    try {
      if (repeat !== 'once') {
        const result = await api.post<{ series: { code: string }; booked: Booking[]; skipped: { start: string; reason: string }[] }>(
          '/api/bookings/series', { providerId: provider.id, serviceId: service.id, start: slot.start,
            customer: { name: form.name, email: form.email, phone: form.phone || undefined },
            notes: form.notes || undefined, frequency: repeat, occurrences }
        );
        navigate('/confirmation', { state: { booking: result.booked[0], series: result } });
        return;
      }
      const booking = await api.post<Booking>('/api/bookings', {
        providerId: provider.id, serviceId: service.id, start: slot.start,
        customer: { name: form.name, email: form.email, phone: form.phone || undefined },
        notes: form.notes || undefined,
      });
      navigate('/confirmation', { state: { booking } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(`${err.message}，可用时段已刷新，请重新选择。`); setSlot(null); setRefreshKey((key) => key + 1);
      } else setError(err instanceof Error ? err.message : '预约失败，请稍后重试');
    } finally { setSubmitting(false); }
  }

  if (loadError) return <div className="container center-page"><div className="error-box">{loadError}</div><button className="btn btn-primary" onClick={() => window.location.reload()}>重新加载</button></div>;
  if (!provider) return <div className="container center-page"><div className="loading-state"><span className="spinner" />正在加载资源信息…</div></div>;

  return <div className="container detail-layout">
    <aside className="detail-side">
      {fav.loggedIn && <button className={`fav-btn ${fav.ids.has(provider.id) ? 'on' : ''}`} title="收藏资源" onClick={() => fav.toggle(provider.id)}>{fav.ids.has(provider.id) ? '♥' : '♡'}</button>}
      <div className="provider-avatar lg" style={{ background: provider.color }}>{provider.emoji}</div>
      <h1>{provider.name}</h1>
      <p className="provider-title">{provider.title} <RatingBadge avg={provider.avg_rating} count={provider.review_count} /></p>
      <p className="provider-bio">{provider.bio}</p>
      <div className="hours-box"><h3>开放时间</h3>{WEEKDAYS.map((day, wd) => {
        const windows = (provider.schedules ?? []).filter((s) => s.weekday === wd);
        return <div key={wd} className="hours-row"><span>{WEEKDAYS_SHORT[wd]}</span><span>{windows.length ? windows.map((w) => `${hhmm(w.start_time)}–${hhmm(w.end_time)}`).join(', ') : <em className="muted">未开放</em>}</span></div>;
      })}</div>
    </aside>

    <section className="detail-main">
      <div className="step-card"><h2><span className="step-num">1</span>选择预约项目</h2>
        <div className="service-list">{(provider.services ?? []).map((s) => <button key={s.id} className={`service-option ${service?.id === s.id ? 'selected' : ''}`} onClick={() => { setService(s); setSlot(null); }}>
          <div><strong>{s.name}</strong><p>{s.description}</p></div><div className="service-meta"><span className="service-duration">{s.duration_min} 分钟</span></div>
        </button>)}</div>
        {(provider.services ?? []).length === 0 && <div className="empty-state">该资源暂时没有可预约项目。</div>}
      </div>

      {service && <div className="step-card"><h2><span className="step-num">2</span>选择日期和时间</h2><SlotPicker provider={provider} serviceId={service.id} slot={slot} onSelect={setSlot} refreshKey={refreshKey} initialDate={params.get('date') ?? undefined} renderEmpty={(date) => <WaitlistForm providerId={provider.id} serviceId={service.id} date={date} />} /></div>}

      {service && slot && <div className="step-card"><h2><span className="step-num">3</span>确认预约信息</h2>
        <div className="summary-bar">{service.name} · {new Date(slot.start).toLocaleDateString('zh-CN', { weekday: 'long', day: 'numeric', month: 'long' })} {fmtTime(slot.start)}</div>
        <form onSubmit={submit} className="booking-form">
          <div className="form-row"><label>姓名 *<input className="input" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>邮箱 *<input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div>
          <div className="form-row"><label>手机号<input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>预约备注<input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="例如：需要投影设备" /></label></div>
          <div className="form-row"><label>预约频率<select className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)}><option value="once">仅预约一次</option><option value="weekly">每周重复</option><option value="biweekly">每两周重复</option></select></label>{repeat !== 'once' && <label>预约次数（2—12）<input className="input" type="number" min={2} max={12} value={occurrences} onChange={(e) => setOccurrences(Math.max(2, Math.min(12, +e.target.value || 2)))} /></label>}</div>
          {repeat !== 'once' && <p className="muted small">无法预约或超出资源开放范围的日期会被跳过，并在成功页说明原因。</p>}
          {error && <p className="error-box">{error}</p>}
          <button className="btn btn-primary btn-lg" disabled={submitting}>{submitting ? <><span className="spinner spinner-light" />正在提交预约…</> : repeat !== 'once' ? `确认预约 ${occurrences} 次` : '确认预约'}</button>
        </form>
      </div>}

      {reviews.length > 0 && <div className="step-card"><h2>⭐ 使用评价</h2><div className="review-list">{reviews.map((r, i) => <div key={i} className="review-item"><div className="review-item-head"><Stars value={r.rating} /><strong>{r.customer_name}</strong><span className="muted small">{r.service_name} · {new Date(r.created_at).toLocaleDateString('zh-CN', { month: 'short', year: 'numeric' })}</span></div>{r.comment && <p className="review-comment">{r.comment}</p>}</div>)}</div></div>}
    </section>
  </div>;
}
