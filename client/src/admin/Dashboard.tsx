import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { fmtDateTime, money, STATUS_LABELS } from '../format';
import type { AdminStats, Booking } from '../types';
import { BarChart, Heatmap, HBarList } from './charts';

interface Analytics {
  days: number;
  timeseries: { day: string; bookings: number; revenue_cents: number; cancelled: number }[];
  heatmap: { dow: number; hour: number; count: number }[];
  services: { id: number; name: string; provider_name: string; color: string; emoji: string; bookings: number; revenue_cents: number }[];
  statusRates: { status: string; count: number }[];
  customers: { new_bookings: number; returning_bookings: number; new_customers: number };
}

const dayTick = (iso: string) =>
  new Date(iso).toLocaleDateString('zh-CN', { day: 'numeric', month: 'short' });
const dayFull = (iso: string) =>
  new Date(iso).toLocaleDateString('zh-CN', { weekday: 'short', day: 'numeric', month: 'short' });
const compactMoney = (v: number) =>
  v >= 100000_00 ? `₹${(v / 100000_00).toFixed(1)}L` : v >= 1000_00 ? `₹${Math.round(v / 1000_00)}k` : `₹${Math.round(v / 100)}`;

export default function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recent, setRecent] = useState<Booking[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    api.get<AdminStats>('/api/admin/stats').then(setStats).catch(() => {});
    api.get<Booking[]>('/api/admin/bookings?limit=8').then(setRecent).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<Analytics>(`/api/admin/analytics?days=${days}`).then(setAnalytics).catch(() => {});
  }, [days]);

  if (!stats) return <p className="muted">正在加载仪表盘…</p>;

  const cancelRate = Number(stats.created_30d)
    ? Math.round((Number(stats.cancelled_30d) / Number(stats.created_30d)) * 100)
    : 0;

  const cards = [
    { label: '今日预约', value: stats.today_confirmed, icon: '📅' },
    { label: '未来 7 天', value: stats.next7_confirmed, icon: '🗓️' },
    { label: '本月预约金额', value: money(Number(stats.month_revenue_cents)), icon: '💰' },
    { label: '本月线上收款', value: money(Number(stats.month_collected_cents ?? 0)), icon: '💳' },
    { label: '本月退款', value: money(Number(stats.month_refunded_cents ?? 0)), icon: '↩️' },
    { label: '取消率（30天）', value: `${cancelRate}%`, icon: '📉' },
    { label: '启用的服务商', value: stats.active_providers, icon: '👥' },
    { label: '客户数', value: stats.customers, icon: '🙋' },
  ];

  return (
    <div>
      <h1 className="admin-title">仪表盘</h1>
      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <span className="stat-icon">{c.icon}</span>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-title-row">
        <h2 className="analytics-title">数据分析</h2>
        <div className="range-tabs">
          {[7, 30, 90].map((d) => (
            <button key={d} className={`tab ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
              {d} 天
            </button>
          ))}
        </div>
      </div>

      {analytics && (
        <>
          <div className="dash-cols">
            <section className="panel">
              <h2>每日预约数</h2>
              <BarChart
                color="var(--chart-volume)"
                valueFmt={(v) => String(Math.round(v))}
                data={analytics.timeseries.map((t) => ({
                  label: dayTick(t.day), tooltip: dayFull(t.day), value: t.bookings,
                }))}
              />
            </section>
            <section className="panel">
              <h2>每日净收入</h2>
              <BarChart
                color="var(--chart-revenue)"
                valueFmt={compactMoney}
                data={analytics.timeseries.map((t) => ({
                  label: dayTick(t.day), tooltip: dayFull(t.day), value: t.revenue_cents,
                }))}
              />
            </section>
          </div>

          <section className="panel">
            <h2>高峰时段（星期 × 小时）</h2>
            <Heatmap cells={analytics.heatmap} />
          </section>

          <div className="dash-cols">
            <section className="panel">
              <h2>收入最高的服务</h2>
              {analytics.services.length === 0 && <p className="muted">此时间范围内没有预约。</p>}
              <HBarList
                valueFmt={(v) => money(v)}
                items={analytics.services.map((s) => ({
                  label: s.name,
                  sub: `${s.emoji} ${s.provider_name} · ${s.bookings}×`,
                  dotColor: s.color,
                  value: s.revenue_cents,
                }))}
              />
            </section>
            <section className="panel">
              <h2>预约结果与客户（{analytics.days} 天）</h2>
              <div className="status-rows">
                {analytics.statusRates.map((s) => {
                  const total = analytics.statusRates.reduce((sum, x) => sum + x.count, 0);
                  return (
                    <div key={s.status} className="status-row">
                      <span className={`badge badge-${s.status}`}>{STATUS_LABELS[s.status] ?? s.status}</span>
                      <div className="hbar-track">
                        <div
                          className="hbar-fill"
                          style={{
                            width: `${Math.max((s.count / Math.max(total, 1)) * 100, 1)}%`,
                            background: s.status === 'cancelled' || s.status === 'no_show'
                              ? 'var(--chart-danger)'
                              : 'var(--chart-volume)',
                          }}
                        />
                        <span className="hbar-value">
                          {s.count} ({Math.round((s.count / Math.max(total, 1)) * 100)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="stat-grid mini-stats">
                <div className="stat-card"><span className="stat-icon">🆕</span><div>
                  <div className="stat-value">{analytics.customers.new_bookings}</div>
                  <div className="stat-label">新客户带来的预约</div>
                </div></div>
                <div className="stat-card"><span className="stat-icon">🔁</span><div>
                  <div className="stat-value">{analytics.customers.returning_bookings}</div>
                  <div className="stat-label">回头客带来的预约</div>
                </div></div>
              </div>
            </section>
          </div>
        </>
      )}

      <div className="dash-cols">
        <section className="panel">
          <h2>服务商——即将到来的预约</h2>
          <table className="table">
            <thead><tr><th>服务商</th><th>即将到来</th><th>收入（本月）</th></tr></thead>
            <tbody>
              {stats.byProvider.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/admin/providers/${p.id}`} className="cell-provider">
                      <span className="mini-avatar" style={{ background: p.color }}>{p.emoji}</span>
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.upcoming}</td>
                  <td>{money(Number(p.month_revenue_cents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>最近预约</h2>
          <table className="table">
            <thead><tr><th>预约码</th><th>客户</th><th>时间</th><th>状态</th></tr></thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.code}</td>
                  <td>{b.customer_name}</td>
                  <td>{fmtDateTime(b.starts_at)}</td>
                  <td><span className={`badge badge-${b.status}`}>{STATUS_LABELS[b.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link to="/admin/bookings" className="panel-link">全部预约 →</Link>
        </section>
      </div>
    </div>
  );
}
