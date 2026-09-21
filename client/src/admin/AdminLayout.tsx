import { useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken, getToken } from '../api';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('bookit_admin_user') ?? 'null');

  useEffect(() => {
    if (!getToken()) navigate('/admin/login');
  }, [navigate]);

  function logout() {
    clearToken();
    localStorage.removeItem('bookit_admin_user');
    navigate('/admin/login');
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/" className="brand admin-brand">📅 Book<span className="brand-accent">It</span></Link>
        <nav>
          <NavLink to="/admin" end>📊 仪表盘</NavLink>
          <NavLink to="/admin/bookings">🗓️ 预约</NavLink>
          <NavLink to="/admin/day">⏱️ 日视图</NavLink>
          <NavLink to="/admin/week">📆 周视图</NavLink>
          <NavLink to="/admin/providers">👥 服务商</NavLink>
          <NavLink to="/admin/reviews">⭐ 评价</NavLink>
          <NavLink to="/admin/payments">💳 支付</NavLink>
          <NavLink to="/admin/coupons">🏷️ 优惠券</NavLink>
          <NavLink to="/admin/waitlist">🔔 候补名单</NavLink>
          <NavLink to="/admin/customers">🙋 客户</NavLink>
        </nav>
        <div className="admin-user">
          <span>{user?.email ?? ''}</span>
          <div className="btn-row">
            <button className="btn btn-ghost btn-sm" onClick={logout}>退出登录</button>
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
