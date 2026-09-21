import { useState } from 'react';
import { getTheme, toggleTheme } from '../theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme());
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => setTheme(toggleTheme())}
      title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      aria-label="切换颜色主题"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
