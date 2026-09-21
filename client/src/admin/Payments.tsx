import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { fmtDateTime, money } from '../format';

interface AdminPayment {
  id: number;
  booking_code: string;
  booking_status: string;
  starts_at: string;
  provider: string;
  order_id: string;
  payment_id: string | null;
  amount_cents: number;
  status: string;
  method: string;
  error: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  provider_name: string;
  emoji: string;
  service_name: string;
  refunded_cents: number;
}

const PAYMENT_BADGES: Record<string, string> = {
  created: 'badge-no_show',
  captured: 'badge-confirmed',
  partially_refunded: 'badge-completed',
  refunded: 'badge-completed',
  failed: 'badge-cancelled',
};
const PAYMENT_LABELS: Record<string, string> = {
  created: '已创建', captured: '已收款', partially_refunded: '部分退款', refunded: '已退款', failed: '失败',
};

export default function Payments() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [flash, setFlash] = useState('');

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (search) q.set('search', search);
    api.get<AdminPayment[]>(`/api/admin/payments?${q}`).then(setPayments).catch(() => {});
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function refund(p: AdminPayment) {
    const refundable = p.amount_cents - p.refunded_cents;
    const input = window.prompt(
      `退款金额是多少？（最多 ₹${(refundable / 100).toLocaleString('en-IN')}）`,
      String(refundable / 100)
    );
    if (input === null) return;
    const amount = Math.round(parseFloat(input) * 100);
    if (!amount || amount <= 0 || amount > refundable) {
      setFlash('退款金额无效');
      return;
    }
    setBusyId(p.id);
    setFlash('');
    try {
      await api.post(`/api/admin/payments/${p.id}/refund`, { amountCents: amount });
      setFlash(`已为 ${p.booking_code} 退款 ${money(amount)}`);
      load();
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : '退款失败');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="admin-title-row">
        <h1 className="admin-title">支付</h1>
        {flash && <span className="flash flash-ok">{flash}</span>}
      </div>

      <div className="filter-bar">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          <option value="created">已创建</option>
          <option value="captured">已收款</option>
          <option value="partially_refunded">部分退款</option>
          <option value="refunded">已退款</option>
          <option value="failed">失败</option>
        </select>
        <input className="input" placeholder="搜索预约码 / 客户 / 订单…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="panel">
        {payments.length === 0 && <p className="muted">未找到支付记录。</p>}
        {payments.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>预约</th><th>客户</th><th>服务商</th><th>金额</th>
                <th>状态</th><th>方式</th><th>创建时间</th><th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const refundable = p.amount_cents - p.refunded_cents;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="mono">{p.booking_code}</span>
                      <div className="muted small">{p.service_name}</div>
                    </td>
                    <td>{p.customer_name}<div className="muted small">{p.customer_email}</div></td>
                    <td><span className="cell-provider">{p.emoji} {p.provider_name}</span></td>
                    <td>
                      {money(p.amount_cents)}
                      {p.refunded_cents > 0 && (
                        <div className="muted small">− {money(p.refunded_cents)} 已退款</div>
                      )}
                    </td>
                    <td><span className={`badge ${PAYMENT_BADGES[p.status] ?? ''}`}>{PAYMENT_LABELS[p.status] ?? p.status}</span></td>
                    <td className="small">{p.method || p.provider}<div className="muted small mono">{p.order_id}</div></td>
                    <td className="small">{fmtDateTime(p.created_at)}</td>
                    <td className="row-actions">
                      {['captured', 'partially_refunded'].includes(p.status) && refundable > 0 && (
                        <button className="btn btn-danger-ghost btn-xs" disabled={busyId === p.id} onClick={() => refund(p)}>
                          退款
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
