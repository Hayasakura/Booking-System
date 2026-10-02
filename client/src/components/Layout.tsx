import { Link, NavLink, Outlet } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useCustomer } from '../customer/auth';

export default function Layout() {
  const user = useCustomer();
  return (
    <div className="site">
      <header className="site-header">
        <div className="container header-row">
          <Link to="/" className="brand">
            <span className="brand-mark">🏫</span> Campus<span className="brand-accent">Reserve</span>
          </Link>
          <nav className="site-nav">
            <NavLink to="/browse/study_room">自习空间</NavLink>
            <NavLink to="/browse/meeting_room">会议室</NavLink>
            <NavLink to="/browse/equipment">设备</NavLink>
            <NavLink to="/manage" className="nav-pill">管理预约</NavLink>
            {user ? (
              <NavLink to="/account" className="nav-pill">👤 {user.name.split(' ')[0]}</NavLink>
            ) : (
              <NavLink to="/account/login" className="nav-pill">登录</NavLink>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-row">
          <span>Campus Reserve — 校园资源预约平台</span>
          <Link to="/admin">管理后台 →</Link>
        </div>
      </footer>
    </div>
  );
}
