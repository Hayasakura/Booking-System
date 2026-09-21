import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { fmtDate, fmtDateTime, money, STATUS_LABELS } from '../format';
import type { Booking } from '../types';
import type { CrmCustomer } from './Customers';

type Detail = CrmCustomer & { notes: string; bookings: Booking[] };

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<Detail | null>(null);
  const [notes, setNotes] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Detail>(`/api/admin/customers/${id}`).then((c) => {
      setCustomer(c);
      setNotes(c.notes);
    }).catch(() => {});
  }, [id]);

  async function saveNotes() {
    setBusy(true);
    setFlash('');
    try {
      await api.patch(`/api/admin/customers/${id}/notes`, { notes });
      setFlash('备注已保存');
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  if (!customer) return <p className="muted">正在加载客户…</p>;

  const tiles = [
    { label: '预约数', value: customer.booking_count, icon: '🗓️' },
    { label: '累计消费', value: money(customer.total_spend_cents), icon: '💰' },
    { label: '积分余额', value: customer.points_balance, icon: '⭐' },
    { label: '爽约次数', value: customer.no_show_count, icon: '🚫' },
    { label: '最近到访', value: customer.last_visit ? fmtDate(customer.last_visit) : '—', icon: '📍' },
  ];

  return (
    <>
      <div className="admin-title-row">
        <h1 className="admin-title">
          {customer.name} {customer.has_account && <span title="已有账户">👤</span>}
        </h1>
        <Link className="btn btn-ghost btn-sm" to="/admin/customers">← 全部客户</Link>
      </div>
      <p className="muted">
        {customer.email}{customer.phone ? ` · ${customer.phone}` : ''} · 客户创建于 {fmtDate(customer.created_at)}
      </p>

      <div className="stat-grid">
        {tiles.map((t) => (
          <div key={t.label} className="stat-card">
            <span className="stat-icon">{t.icon}</span>
            <div>
              <div className="stat-value">{t.value}</div>
              <div className="stat-label">{t.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>私密备注</h2>
          {flash && <span className="flash flash-ok">{flash}</span>}
        </div>
        <textarea className="input" rows={3} maxLength={5000} value={notes}
          placeholder="偏好、过敏信息、VIP 状态…"
          onChange={(e) => setNotes(e.target.value)} />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={saveNotes}>
            {busy ? '保存中…' : '保存备注'}
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>预约记录</h2>
        {customer.bookings.length === 0 && <p className="muted">暂无预约。</p>}
        {customer.bookings.length > 0 && (
          <table className="table">
            <thead>
              <tr><th>预约码</th><th>服务商</th><th>服务</th><th>时间</th><th>已付</th><th>状态</th></tr>
            </thead>
            <tbody>
              {customer.bookings.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.code}</td>
                  <td><span className="cell-provider"><span className="mini-avatar" style={{ background: b.color }}>{b.emoji}</span> {b.provider_name}</span></td>
                  <td>{b.service_name}</td>
                  <td className="small">{fmtDateTime(b.starts_at)}</td>
                  <td>{money(b.price_cents - (b.discount_cents ?? 0))}</td>
                  <td><span className={`badge badge-${b.status}`}>{STATUS_LABELS[b.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
