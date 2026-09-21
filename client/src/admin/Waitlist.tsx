import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { fmtDate } from '../format';
import type { Provider } from '../types';

interface WaitlistEntry {
  id: number;
  provider_id: number;
  provider_name: string;
  emoji: string;
  service_name: string;
  date: string;
  name: string;
  email: string;
  phone: string;
  status: 'waiting' | 'notified' | 'converted' | 'expired';
  notified_at: string | null;
  created_at: string;
}

const WL_BADGES: Record<string, string> = {
  waiting: 'badge-no_show',
  notified: 'badge-completed',
  converted: 'badge-confirmed',
  expired: 'badge-cancelled',
};
const WL_LABELS: Record<string, string> = {
  waiting: '等待中', notified: '已通知', converted: '已转化', expired: '已过期',
};

export default function Waitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    api.get<Provider[]>('/api/admin/providers').then(setProviders);
  }, []);

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (providerId) q.set('providerId', providerId);
    if (status) q.set('status', status);
    api.get<WaitlistEntry[]>(`/api/admin/waitlist?${q}`).then(setEntries).catch(() => {});
  }, [providerId, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: number) {
    if (!window.confirm('确定从候补名单中移除此条记录吗？')) return;
    setBusyId(id);
    try {
      await api.del(`/api/admin/waitlist/${id}`);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1 className="admin-title">候补名单</h1>
      <div className="filter-bar">
        <select className="input" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          <option value="">全部服务商</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          <option value="waiting">等待中</option>
          <option value="notified">已通知</option>
          <option value="converted">已转化</option>
          <option value="expired">已过期</option>
        </select>
      </div>

      <div className="panel">
        {entries.length === 0 && <p className="muted">目前没有人在等待。</p>}
        {entries.length > 0 && (
          <table className="table">
            <thead>
              <tr><th>日期</th><th>服务商</th><th>服务</th><th>客户</th><th>状态</th><th>加入时间</th><th></th></tr>
            </thead>
            <tbody>
              {entries.map((w) => (
                <tr key={w.id}>
                  <td>{fmtDate(w.date)}</td>
                  <td><span className="cell-provider">{w.emoji} {w.provider_name}</span></td>
                  <td>{w.service_name}</td>
                  <td>{w.name}<div className="muted small">{w.email}</div></td>
                  <td><span className={`badge ${WL_BADGES[w.status]}`}>{WL_LABELS[w.status] ?? w.status}</span></td>
                  <td className="small">{fmtDate(w.created_at)}</td>
                  <td className="row-actions">
                    {(w.status === 'waiting' || w.status === 'notified') && (
                      <button className="btn btn-danger-ghost btn-xs" disabled={busyId === w.id} onClick={() => remove(w.id)}>
                        移除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
