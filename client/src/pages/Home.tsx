import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { BusinessTypeInfo } from '../types';

export default function Home() {
  const [types, setTypes] = useState<BusinessTypeInfo[]>([]);

  useEffect(() => {
    api.get<BusinessTypeInfo[]>('/api/business-types').then(setTypes).catch(() => {});
  }, []);

  return (
    <div className="container">
      <section className="hero campus-hero">
        <h1>
          校园资源，<br />
          <span className="hero-accent">按你的学习计划预约。</span>
        </h1>
        <p className="hero-sub">
          自习空间、会议室和实验设备统一管理。实时查看空闲时段，提交后立即获得预约确认。
        </p>
        <div className="hero-actions"><Link className="btn btn-primary btn-lg" to="/browse/study_room">开始查找资源</Link><Link className="btn btn-ghost btn-lg" to="/manage">管理我的预约</Link></div>
      </section>

      <section className="category-grid">
        {types.map((t) => (
          <Link key={t.key} to={`/browse/${t.key}`} className={`category-card cat-${t.key}`}>
            <span className="category-emoji">{t.emoji}</span>
            <h2>{t.label}</h2>
            <p>{t.tagline}</p>
            <span className="category-cta">浏览 →</span>
          </Link>
        ))}
      </section>

      <section className="feature-strip">
        <div className="feature">
          <span>⚡</span>
          <div>
            <h3>实时可用</h3>
            <p>根据开放时间、维护安排和已有预约动态计算可用时段。</p>
          </div>
        </div>
        <div className="feature">
          <span>🔒</span>
          <div>
            <h3>防止重复预约</h3>
            <p>前端校验加数据库排他约束，确保同一资源不会被重复占用。</p>
          </div>
        </div>
        <div className="feature">
          <span>📧</span>
          <div>
            <h3>状态清晰</h3>
            <p>加载、失败、无数据和成功结果都有明确反馈，预约过程更安心。</p>
          </div>
        </div>
      </section>
    </div>
  );
}
