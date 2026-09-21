import { useState } from 'react';
import { api } from '../api';
import { useCustomer } from '../customer/auth';

interface Props {
  providerId: number;
  serviceId: number;
  date: string; // YYYY-MM-DD
}

/** Shown when a day has no free slots — joins the cancellation waitlist. */
export default function WaitlistForm({ providerId, serviceId, date }: Props) {
  const user = useCustomer();
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/waitlist', { providerId, serviceId, date, customer: form });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法加入候补名单');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="flash flash-ok">
        你已加入当天的候补名单——有空档时我们会立即通过邮件通知你。🎉
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="waitlist-form">
      <strong>当天已约满——要不要让我们帮你留意？</strong>
      <p className="muted small">
        如果有空档，候补名单前几位会收到邮件通知，先到先得。
      </p>
      <div className="form-row">
        <input className="input" placeholder="你的姓名" required minLength={2}
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" type="email" placeholder="邮箱" required
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      {error && <p className="error-box">{error}</p>}
      <button className="btn btn-ghost" disabled={busy}>
        {busy ? '加入中…' : '🔔 有空档时通知我'}
      </button>
    </form>
  );
}
