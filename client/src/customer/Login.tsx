import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { setSession, type CustomerUser } from './auth';

type Mode = 'signin' | 'signup';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) || 'signin');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res =
        mode === 'signin'
          ? await api.post<{ token: string; user: CustomerUser }>('/api/customer/auth/login', {
              email: form.email,
              password: form.password,
            })
          : await api.post<{ token: string; user: CustomerUser }>('/api/customer/auth/signup', {
              name: form.name,
              email: form.email,
              password: form.password,
              phone: form.phone || undefined,
            });
      setSession(res.token, res.user);
      navigate(params.get('next') ?? '/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : '出了点问题');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container narrow-page">
      <div className="step-card auth-card">
        <h1>{mode === 'signin' ? '欢迎回来' : '创建你的账户'}</h1>
        <p className="muted">
          {mode === 'signin'
            ? '登录后查看你的预约、积分和收藏。'
            : '使用此邮箱创建的历史预约会自动关联。'}
        </p>
        <div className="tabs">
          <button className={`tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => setMode('signin')}>
            登录
          </button>
          <button className={`tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>
            创建账户
          </button>
        </div>
        <form onSubmit={submit} className="booking-form">
          {mode === 'signup' && (
            <label>
              姓名 *
              <input className="input" required minLength={2} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
          )}
          <label>
            邮箱 *
            <input className="input" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            密码 *
            <input className="input" type="password" required minLength={mode === 'signup' ? 8 : 1}
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          {mode === 'signup' && (
            <label>
              手机
              <input className="input" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
          )}
          {error && <p className="error-box">{error}</p>}
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? '请稍候…' : mode === 'signin' ? '登录' : '创建账户'}
          </button>
        </form>
      </div>
    </div>
  );
}
