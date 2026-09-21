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
            <span className="brand-mark">📅</span> Book<span className="brand-accent">It</span>
          </Link>
          <nav className="site-nav">
            <NavLink to="/browse/doctor">医生</NavLink>
            <NavLink to="/browse/salon">沙龙</NavLink>
            <NavLink to="/browse/turf">场地</NavLink>
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
          <span>BookIt — 预约管理系统</span>
          <Link to="/admin">管理后台 →</Link>
        </div>
      </footer>
    </div>
  );
}
