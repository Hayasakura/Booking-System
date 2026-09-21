import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { hhmm, money, WEEKDAYS } from '../format';
import type { BreakWindow, Provider, ScheduleWindow, Service, TimeOff } from '../types';

export default function ProviderEdit() {
  const { id } = useParams();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [schedules, setSchedules] = useState<ScheduleWindow[]>([]);
  const [breaks, setBreaks] = useState<BreakWindow[]>([]);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    const p = await api.get<Provider>(`/api/admin/providers/${id}`);
    setProvider(p);
    setSchedules(p.schedules ?? []);
    setBreaks(p.breaks ?? []);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  function show(kind: 'ok' | 'err', msg: string) {
    setFlash({ kind, msg });
    window.setTimeout(() => setFlash(null), 3500);
  }

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    try {
      await fn();
      show('ok', okMsg);
    } catch (e) {
      show('err', e instanceof ApiError ? e.message + (e.details ? ` — ${e.details.join('; ')}` : '') : String(e));
    }
  }

  if (!provider) return <p className="muted">正在加载…</p>;

  return (
    <div>
      <div className="admin-title-row">
        <h1 className="admin-title">
          <Link to="/admin/providers" className="muted">服务商 /</Link> {provider.name}
        </h1>
        {flash && <span className={`flash flash-${flash.kind}`}>{flash.msg}</span>}
      </div>

      <DetailsPanel provider={provider} onSave={(p) =>
        run(async () => { await api.put(`/api/admin/providers/${id}`, p); await load(); }, '服务商信息已保存')} />

      <ServicesPanel provider={provider} onChanged={() =>
        run(load, '服务已更新')} onError={(m) => show('err', m)} />

      <SchedulePanel
        schedules={schedules} breaks={breaks}
        setSchedules={setSchedules} setBreaks={setBreaks}
        onSave={() => run(async () => {
          await api.put(`/api/admin/providers/${id}/schedule`, {
            schedules: schedules.map(({ weekday, start_time, end_time }) => ({ weekday, start_time: hhmm(start_time), end_time: hhmm(end_time) })),
            breaks: breaks.map(({ weekday, start_time, end_time, label }) => ({ weekday, start_time: hhmm(start_time), end_time: hhmm(end_time), label })),
          });
          await load();
        }, '营业时间已保存')}
      />

      <TimeOffPanel provider={provider} onChanged={() => run(load, '休息时间已更新')} />
    </div>
  );
}

/* ------------------------------------------------------------------ details */
function DetailsPanel({ provider, onSave }: { provider: Provider; onSave: (p: Partial<Provider>) => void }) {
  const [p, setP] = useState({ ...provider });
  useEffect(() => setP({ ...provider }), [provider]);

  return (
    <section className="panel">
      <h2>基本信息</h2>
      <div className="form-grid">
        <label>名称<input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
        <label>头衔 / 专业<input className="input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} /></label>
        <label>类型
          <select className="input" value={p.business_type} onChange={(e) => setP({ ...p, business_type: e.target.value as Provider['business_type'] })}>
            <option value="doctor">医生</option><option value="salon">沙龙</option><option value="turf">运动场地</option>
          </select>
        </label>
        <label>表情<input className="input" value={p.emoji} onChange={(e) => setP({ ...p, emoji: e.target.value })} /></label>
        <label>颜色<input className="input" type="color" value={p.color} onChange={(e) => setP({ ...p, color: e.target.value })} /></label>
        <label>时间间隔（分钟）<input className="input" type="number" min={5} max={120} value={p.slot_step_min} onChange={(e) => setP({ ...p, slot_step_min: +e.target.value })} /></label>
        <label>最短提前时间（分钟）<input className="input" type="number" min={0} value={p.min_lead_min} onChange={(e) => setP({ ...p, min_lead_min: +e.target.value })} /></label>
        <label>可预约范围（天）<input className="input" type="number" min={1} max={365} value={p.booking_horizon_days} onChange={(e) => setP({ ...p, booking_horizon_days: +e.target.value })} /></label>
        <label>改期截止时间（分钟）<input className="input" type="number" min={0} value={p.reschedule_cutoff_min ?? 120} onChange={(e) => setP({ ...p, reschedule_cutoff_min: +e.target.value })} /></label>
        <label className="span2">简介<textarea className="input" rows={2} value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} /></label>
        <label className="check-label">
          <input type="checkbox" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} /> 启用（可见且可预约）
        </label>
      </div>
      <button className="btn btn-primary" onClick={() => onSave({
        business_type: p.business_type, name: p.name, title: p.title, bio: p.bio, emoji: p.emoji,
        color: p.color, slot_step_min: p.slot_step_min, min_lead_min: p.min_lead_min,
        booking_horizon_days: p.booking_horizon_days, reschedule_cutoff_min: p.reschedule_cutoff_min ?? 120,
        active: p.active,
      })}>保存信息</button>
    </section>
  );
}

/* ----------------------------------------------------------------- services */
function ServicesPanel({ provider, onChanged, onError }: {
  provider: Provider; onChanged: () => void; onError: (msg: string) => void;
}) {
  const empty = {
    name: '', description: '', duration_min: 30, buffer_min: 0, price_cents: 0,
    payment_policy: 'none' as const, deposit_pct: 50, active: true,
  };
  const [editing, setEditing] = useState<(Service & { isNew?: boolean }) | null>(null);

  async function save() {
    if (!editing) return;
    const body = {
      name: editing.name, description: editing.description, duration_min: editing.duration_min,
      buffer_min: editing.buffer_min, price_cents: editing.price_cents,
      payment_policy: editing.payment_policy ?? 'none', deposit_pct: editing.deposit_pct ?? 50,
      active: editing.active ?? true,
    };
    try {
      if (editing.isNew) await api.post(`/api/admin/providers/${provider.id}/services`, body);
      else await api.put(`/api/admin/services/${editing.id}`, body);
      setEditing(null);
      onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? `${e.message}${e.details ? ' — ' + e.details.join('; ') : ''}` : String(e));
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>服务</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...(empty as Service), id: 0, isNew: true })}>+ 添加服务</button>
      </div>
      <table className="table">
        <thead><tr><th>服务</th><th>时长</th><th>缓冲</th><th>价格</th><th>付款方式</th><th>状态</th><th></th></tr></thead>
        <tbody>
          {(provider.services ?? []).map((s) => (
            <tr key={s.id}>
              <td>
                <div>{s.name}</div>
                <div className="muted small">{s.description}</div>
              </td>
              <td>{s.duration_min} 分钟</td>
              <td>{s.buffer_min} 分钟</td>
              <td>{money(s.price_cents)}</td>
              <td className="small">
                {s.payment_policy === 'full' ? '全额预付' : s.payment_policy === 'deposit' ? `${s.deposit_pct}% 定金` : '到店支付'}
              </td>
              <td><span className={`badge ${s.active ? 'badge-confirmed' : 'badge-cancelled'}`}>{s.active ? '启用' : '隐藏'}</span></td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...s })}>编辑</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="service-editor">
          <h3>{editing.isNew ? '新建服务' : `编辑：${editing.name}`}</h3>
          <div className="form-grid">
            <label>名称<input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label>描述<input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
            <label>时长（分钟）<input className="input" type="number" min={5} max={480} value={editing.duration_min} onChange={(e) => setEditing({ ...editing, duration_min: +e.target.value })} /></label>
            <label>缓冲（分钟）<input className="input" type="number" min={0} max={120} value={editing.buffer_min} onChange={(e) => setEditing({ ...editing, buffer_min: +e.target.value })} /></label>
            <label>价格（₹）
              <input className="input" type="number" min={0} value={editing.price_cents / 100}
                onChange={(e) => setEditing({ ...editing, price_cents: Math.round(+e.target.value * 100) })} />
            </label>
            <label>付款方式
              <select className="input" value={editing.payment_policy ?? 'none'}
                onChange={(e) => setEditing({ ...editing, payment_policy: e.target.value as Service['payment_policy'] })}>
                <option value="none">到店支付</option>
                <option value="deposit">线上支付定金</option>
                <option value="full">全额预付</option>
              </select>
            </label>
            {editing.payment_policy === 'deposit' && (
              <label>定金比例
                <input className="input" type="number" min={1} max={100} value={editing.deposit_pct ?? 50}
                  onChange={(e) => setEditing({ ...editing, deposit_pct: +e.target.value })} />
              </label>
            )}
              <label className="check-label">
              <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> 启用
            </label>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>保存服务</button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>取消</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- schedule */
function SchedulePanel({ schedules, breaks, setSchedules, setBreaks, onSave }: {
  schedules: ScheduleWindow[]; breaks: BreakWindow[];
  setSchedules: (s: ScheduleWindow[]) => void; setBreaks: (b: BreakWindow[]) => void;
  onSave: () => void;
}) {
  const update = <T extends ScheduleWindow>(list: T[], set: (l: T[]) => void, idx: number, patch: Partial<T>) =>
    set(list.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  const remove = <T,>(list: T[], set: (l: T[]) => void, idx: number) =>
    set(list.filter((_, i) => i !== idx));

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>每周营业时间</h2>
        <button className="btn btn-primary btn-sm" onClick={onSave}>保存营业时间</button>
      </div>
      <div className="schedule-grid">
        {WEEKDAYS.map((day, wd) => (
          <div key={wd} className="schedule-day">
            <div className="schedule-day-head">
              <strong>{day}</strong>
              <div className="btn-row">
                <button className="btn btn-ghost btn-xs"
                  onClick={() => setSchedules([...schedules, { weekday: wd, start_time: '09:00', end_time: '17:00' }])}>
                  + 营业时段
                </button>
                <button className="btn btn-ghost btn-xs"
                  onClick={() => setBreaks([...breaks, { weekday: wd, start_time: '13:00', end_time: '14:00', label: '休息' }])}>
                  + 休息时段
                </button>
              </div>
            </div>
            {schedules.map((s, i) => s.weekday === wd && (
              <div key={`s${i}`} className="window-row">
                <span className="window-tag work">营业</span>
                <input className="input input-time" type="time" value={hhmm(s.start_time)}
                  onChange={(e) => update(schedules, setSchedules, i, { start_time: e.target.value })} />
                <span>–</span>
                <input className="input input-time" type="time" value={hhmm(s.end_time)}
                  onChange={(e) => update(schedules, setSchedules, i, { end_time: e.target.value })} />
                <button className="btn btn-danger-ghost btn-xs" onClick={() => remove(schedules, setSchedules, i)}>✕</button>
              </div>
            ))}
            {breaks.map((b, i) => b.weekday === wd && (
              <div key={`b${i}`} className="window-row">
                <span className="window-tag break">休息</span>
                <input className="input input-time" type="time" value={hhmm(b.start_time)}
                  onChange={(e) => update(breaks, setBreaks, i, { start_time: e.target.value })} />
                <span>–</span>
                <input className="input input-time" type="time" value={hhmm(b.end_time)}
                  onChange={(e) => update(breaks, setBreaks, i, { end_time: e.target.value })} />
                <input className="input input-label" value={b.label} placeholder="标签"
                  onChange={(e) => update(breaks, setBreaks, i, { label: e.target.value })} />
                <button className="btn btn-danger-ghost btn-xs" onClick={() => remove(breaks, setBreaks, i)}>✕</button>
              </div>
            ))}
            {!schedules.some((s) => s.weekday === wd) && <p className="muted small">休息</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- time off */
function TimeOffPanel({ provider, onChanged }: { provider: Provider; onChanged: () => void }) {
  const [form, setForm] = useState({ starts_at: '', ends_at: '', reason: '' });

  async function add() {
    if (!form.starts_at || !form.ends_at) return;
    await api.post(`/api/admin/providers/${provider.id}/time-off`, {
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      reason: form.reason,
    });
    setForm({ starts_at: '', ends_at: '', reason: '' });
    onChanged();
  }

  async function del(t: TimeOff) {
    if (!window.confirm('确定删除这段休息时间吗？')) return;
    await api.del(`/api/admin/time-off/${t.id}`);
    onChanged();
  }

  return (
    <section className="panel">
      <h2>临时休息</h2>
      <div className="timeoff-form">
        <label>开始<input className="input" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></label>
        <label>结束<input className="input" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></label>
        <label>原因<input className="input" placeholder="休假、维护…" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
        <button className="btn btn-primary" onClick={add}>添加</button>
      </div>
      {(provider.time_off ?? []).length === 0 && <p className="muted small">暂无临时休息安排。</p>}
      {(provider.time_off ?? []).map((t) => (
        <div key={t.id} className="timeoff-row">
          <span>
            {new Date(t.starts_at).toLocaleString('zh-CN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            {' → '}
            {new Date(t.ends_at).toLocaleString('zh-CN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </span>
          <span className="muted">{t.reason}</span>
          <button className="btn btn-danger-ghost btn-xs" onClick={() => del(t)}>删除</button>
        </div>
      ))}
    </section>
  );
}
