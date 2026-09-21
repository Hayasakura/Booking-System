import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, downloadFile } from '../api';
import { fmtDateTime, fmtTime, money, STATUS_LABELS } from '../format';
import type { Booking, Provider } from '../types';

export default function AdminBookings() {
  const [params] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filters, setFilters] = useState({
    status: '', providerId: '', date: '', search: params.get('search') ?? '',
  });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (filters.status) q.set('status', filters.status);
    if (filters.providerId) q.set('providerId', filters.providerId);
    if (filters.date) q.set('date', filters.date);
    if (filters.search) q.set('search', filters.search);
    api.get<Booking[]>(`/api/admin/bookings?${q}`).then(setBookings).catch((e) => setError(e.message));
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<Provider[]>('/api/admin/providers').then(setProviders).catch(() => {}); }, []);

  async function setStatus(b: Booking, status: string) {
    const labels: Record<string, string> = { cancelled: '取消此预约并通知客户吗？', completed: '标记为已完成吗？', no_show: '标记为爽约吗？' };
    if (!window.confirm(labels[status])) return;
    setBusyId(b.id);
    setError('');
    try {
      await api.patch(`/api/admin/bookings/${b.id}/status`, { status });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
    } finally {
      setBusyId(null);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError('');
    try {
      const q = new URLSearchParams();
      if (filters.status) q.set('status', filters.status);
      if (filters.providerId) q.set('providerId', filters.providerId);
      if (filters.date) q.set('date', filters.date);
      if (filters.search) q.set('search', filters.search);
      await downloadFile(`/api/admin/bookings.csv?${q}`, `bookings-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="admin-title-row">
        <h1 className="admin-title">预约</h1>
        <button className="btn btn-ghost btn-sm" disabled={exporting} onClick={exportCsv}>
          {exporting ? '导出中…' : '⬇️ 导出 CSV'}
        </button>
      </div>
      <div className="filter-bar">
        <input className="input" placeholder="搜索预约码 / 姓名 / 邮箱"
          value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={filters.providerId} onChange={(e) => setFilters({ ...filters, providerId: e.target.value })}>
          <option value="">全部服务商</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
        </select>
        <input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        {(filters.status || filters.providerId || filters.date || filters.search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ status: '', providerId: '', date: '', search: '' })}>
            清除
          </button>
        )}
      </div>

      {error && <p className="error-box">{error}</p>}

      <div className="panel">
        <table className="table">
          <thead>
            <tr><th>预约码</th><th>客户</th><th>服务商 / 服务</th><th>时间</th><th>价格</th><th>状态</th><th></th></tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className={busyId === b.id ? 'row-busy' : ''}>
                <td className="mono">{b.code}</td>
                <td>
                  <Link to={`/admin/customers/${b.customer_id}`}>{b.customer_name}</Link>
                  <div className="muted small">{b.customer_email}</div>
                </td>
                <td>
                  <div className="cell-provider">
                    <span className="mini-avatar" style={{ background: b.color }}>{b.emoji}</span>
                    {b.provider_name}
                  </div>
                  <div className="muted small">{b.service_name}</div>
                </td>
                <td>{fmtDateTime(b.starts_at)}<div className="muted small">结束于 {fmtTime(b.ends_at)}</div></td>
                <td>{money(b.price_cents)}</td>
                <td><span className={`badge badge-${b.status}`}>{STATUS_LABELS[b.status]}</span></td>
                <td className="row-actions">
                  {b.status === 'confirmed' && (
                    <>
                      <button className="btn btn-sm btn-ghost" title="标记完成" onClick={() => setStatus(b, 'completed')}>✓</button>
                      <button className="btn btn-sm btn-ghost" title="爽约" onClick={() => setStatus(b, 'no_show')}>👻</button>
                      <button className="btn btn-sm btn-danger-ghost" title="取消" onClick={() => setStatus(b, 'cancelled')}>✕</button>
                    </>
                  )}
                  {b.status === 'pending_payment' && (
                    <button className="btn btn-sm btn-danger-ghost" title="取消未付款保留" onClick={() => setStatus(b, 'cancelled')}>✕</button>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={7} className="muted center">没有符合筛选条件的预约。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
