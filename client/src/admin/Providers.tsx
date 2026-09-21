import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Provider } from '../types';

const TYPE_LABELS: Record<string, string> = { doctor: '医生', salon: '沙龙', turf: '运动场地' };

export default function AdminProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Provider[]>('/api/admin/providers').then(setProviders).catch(() => {});
  }, []);

  async function create() {
    const created = await api.post<Provider>('/api/admin/providers', {
      business_type: 'doctor',
      name: '新服务商',
      title: '',
      bio: '',
    });
    navigate(`/admin/providers/${created.id}`);
  }

  return (
    <div>
      <div className="admin-title-row">
        <h1 className="admin-title">服务商</h1>
        <button className="btn btn-primary" onClick={create}>+ 新建服务商</button>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>服务商</th><th>类型</th><th>服务数</th><th>时间间隔</th><th>状态</th><th></th></tr></thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="cell-provider">
                    <span className="mini-avatar" style={{ background: p.color }}>{p.emoji}</span>
                    <div>
                      <div>{p.name}</div>
                      <div className="muted small">{p.title}</div>
                    </div>
                  </div>
                </td>
                <td>{TYPE_LABELS[p.business_type]}</td>
                <td>{p.service_count}</td>
                <td>{p.slot_step_min} 分钟</td>
                <td>
                  <span className={`badge ${p.active ? 'badge-confirmed' : 'badge-cancelled'}`}>
                    {p.active ? '启用' : '停用'}
                  </span>
                </td>
                <td><Link className="btn btn-ghost btn-sm" to={`/admin/providers/${p.id}`}>编辑</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
