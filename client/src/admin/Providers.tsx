import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Provider } from '../types';

const TYPE_LABELS: Record<string, string> = { study_room: '自习空间', meeting_room: '会议与活动室', equipment: '实验室设备' };

export default function AdminProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Provider[]>('/api/admin/providers').then(setProviders).catch(() => {});
  }, []);

  async function create() {
    const created = await api.post<Provider>('/api/admin/providers', {
      resource_type: 'study_room',
      name: '新校园资源',
      title: '',
      bio: '',
    });
    navigate(`/admin/providers/${created.id}`);
  }

  return (
    <div>
      <div className="admin-title-row">
        <h1 className="admin-title">校园资源</h1>
        <button className="btn btn-primary" onClick={create}>+ 新建资源</button>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>资源</th><th>类型</th><th>项目数</th><th>时间间隔</th><th>状态</th><th></th></tr></thead>
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
                <td>{TYPE_LABELS[p.resource_type]}</td>
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
