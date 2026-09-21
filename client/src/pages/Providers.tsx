import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { money } from '../format';
import type { Provider } from '../types';
import { RatingBadge } from '../components/Stars';
import { useFavorites } from '../customer/favorites';

const TYPE_LABELS: Record<string, string> = {
  doctor: '医生与诊所',
  salon: '沙龙与护理',
  turf: '运动场地',
};

export default function Providers() {
  const { type } = useParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const fav = useFavorites();

  useEffect(() => {
    setLoading(true);
    api.get<Provider[]>(`/api/providers?type=${type}`)
      .then(setProviders)
      .finally(() => setLoading(false));
  }, [type]);

  const filtered = providers.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container">
      <div className="page-head">
        <h1>{TYPE_LABELS[type ?? ''] ?? '服务商'}</h1>
        <input
          className="input search-input"
          placeholder="按名称或专业搜索…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <p className="muted">正在加载服务商…</p>}
      {!loading && filtered.length === 0 && <p className="muted">未找到服务商。</p>}

      <div className="provider-grid">
        {filtered.map((p) => (
          <Link key={p.id} to={`/provider/${p.id}`} className="provider-card">
            {fav.loggedIn && (
              <button
                className={`fav-btn ${fav.ids.has(p.id) ? 'on' : ''}`}
                title={fav.ids.has(p.id) ? '取消收藏' : '加入收藏'}
                onClick={(e) => {
                  e.preventDefault();
                  fav.toggle(p.id);
                }}
              >
                {fav.ids.has(p.id) ? '♥' : '♡'}
              </button>
            )}
            <div className="provider-avatar" style={{ background: p.color }}>{p.emoji}</div>
            <div className="provider-info">
              <h2>{p.name} <RatingBadge avg={p.avg_rating} count={p.review_count} /></h2>
              <p className="provider-title">{p.title}</p>
              <p className="provider-bio">{p.bio}</p>
              <div className="chip-row">
                {(p.services ?? []).slice(0, 3).map((s) => (
                  <span key={s.id} className="chip">
                    {s.name} · {money(s.price_cents)}
                  </span>
                ))}
                {(p.services?.length ?? 0) > 3 && (
                  <span className="chip chip-more">+{p.services!.length - 3} 项</span>
                )}
              </div>
            </div>
            <span className="provider-cta">预约 →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
