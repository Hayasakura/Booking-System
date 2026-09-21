import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { money } from '../format';
import type { Coupon } from '../types';

const empty = {
  code: '', type: 'percent' as Coupon['type'], value: 10, max_uses: null as number | null,
  min_amount_cents: 0, valid_from: null as string | null, valid_to: null as string | null, active: true,
};

export default function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [editing, setEditing] = useState<(typeof empty & { id?: number }) | null>(null);
  const [error, setError] = useState('');

  const load = () => api.get<Coupon[]>('/api/admin/coupons').then(setCoupons).catch(() => {});
  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!editing) return;
    setError('');
    try {
      if (editing.id) await api.put(`/api/admin/coupons/${editing.id}`, editing);
      else await api.post('/api/admin/coupons', editing);
      setEditing(null);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message}${err.details ? ' — ' + err.details.join('; ') : ''}` : String(err));
    }
  }

  return (
    <>
      <div className="admin-title-row">
        <h1 className="admin-title">优惠券</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...empty })}>+ 新建优惠券</button>
      </div>

      <div className="panel">
        {coupons.length === 0 && <p className="muted">暂无优惠券。</p>}
        {coupons.length > 0 && (
          <table className="table">
            <thead>
              <tr><th>代码</th><th>优惠</th><th>最低订单金额</th><th>使用次数</th><th>有效期</th><th>状态</th><th></th></tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className={c.active ? '' : 'row-hidden'}>
                  <td className="mono">{c.code}</td>
                  <td>{c.type === 'percent' ? `优惠 ${c.value}%` : `优惠 ${money(c.value)}`}</td>
                  <td>{c.min_amount_cents ? money(c.min_amount_cents) : '—'}</td>
                  <td>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                  <td className="small">
                    {c.valid_from ? new Date(c.valid_from).toLocaleDateString('zh-CN') : '…'} →{' '}
                    {c.valid_to ? new Date(c.valid_to).toLocaleDateString('zh-CN') : '…'}
                  </td>
                  <td><span className={`badge ${c.active ? 'badge-confirmed' : 'badge-cancelled'}`}>{c.active ? '启用' : '停用'}</span></td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-xs" onClick={() => setEditing({
                      id: c.id, code: c.code, type: c.type, value: c.value, max_uses: c.max_uses,
                      min_amount_cents: c.min_amount_cents, valid_from: c.valid_from, valid_to: c.valid_to, active: c.active,
                    })}>编辑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {editing && (
          <div className="service-editor">
            <h3>{editing.id ? `编辑：${editing.code}` : '新建优惠券'}</h3>
            <div className="form-grid">
              <label>代码
                <input className="input" value={editing.code} placeholder="WELCOME10"
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
              </label>
              <label>类型
                <select className="input" value={editing.type}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value as Coupon['type'] })}>
                  <option value="percent">按比例优惠</option>
                  <option value="fixed">固定金额优惠</option>
                </select>
              </label>
              <label>{editing.type === 'percent' ? '比例（1–100）' : '金额（₹）'}
                <input className="input" type="number" min={1}
                  value={editing.type === 'percent' ? editing.value : editing.value / 100}
                  onChange={(e) => setEditing({
                    ...editing,
                    value: editing.type === 'percent' ? +e.target.value : Math.round(+e.target.value * 100),
                  })} />
              </label>
              <label>最大使用次数（留空为不限）
                <input className="input" type="number" min={1} value={editing.max_uses ?? ''}
                  onChange={(e) => setEditing({ ...editing, max_uses: e.target.value ? +e.target.value : null })} />
              </label>
              <label>最低订单金额（₹）
                <input className="input" type="number" min={0} value={editing.min_amount_cents / 100}
                  onChange={(e) => setEditing({ ...editing, min_amount_cents: Math.round(+e.target.value * 100) })} />
              </label>
              <label>生效日期
                <input className="input" type="date" value={editing.valid_from?.slice(0, 10) ?? ''}
                  onChange={(e) => setEditing({ ...editing, valid_from: e.target.value || null })} />
              </label>
              <label>失效日期
                <input className="input" type="date" value={editing.valid_to?.slice(0, 10) ?? ''}
                  onChange={(e) => setEditing({ ...editing, valid_to: e.target.value || null })} />
              </label>
              <label className="check-label">
                <input type="checkbox" checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> 启用
              </label>
            </div>
            {error && <p className="error-box">{error}</p>}
            <div className="btn-row">
              <button className="btn btn-primary" onClick={save}>保存优惠券</button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>取消</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
