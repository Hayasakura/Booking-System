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
      <section className="hero">
        <h1>
          预约你需要的一切。<br />
          <span className="hero-accent">医生、沙龙与运动场地。</span>
        </h1>
        <p className="hero-sub">
          实时查看空闲时间，杜绝重复预约，邮件即时确认。
          选择一个类别开始预约。
        </p>
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
            <h3>实时空档</h3>
            <p>空档根据真实营业时间、休息时间和现有预约动态计算。</p>
          </div>
        </div>
        <div className="feature">
          <span>🔒</span>
          <div>
            <h3>杜绝时间冲突</h3>
            <p>数据库级排他约束让重复预约不可能发生。</p>
          </div>
        </div>
        <div className="feature">
          <span>📧</span>
          <div>
            <h3>邮件确认</h3>
            <p>即时发送确认和取消邮件，并附带预约管理链接。</p>
          </div>
        </div>
      </section>
    </div>
  );
}
