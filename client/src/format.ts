export const money = (cents: number) => `₹${(cents / 100).toLocaleString('en-IN')}`;

export const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
export const WEEKDAYS_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export const fmtTime = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit' });

export const fmtDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('zh-CN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export const fmtDateTime = (iso: string | Date) => `${fmtDate(iso)}, ${fmtTime(iso)}`;

/** Local YYYY-MM-DD (never UTC-shifted) */
export const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayStr = () => toDateStr(new Date());

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** "HH:MM[:SS]" -> "HH:MM" */
export const hhmm = (t: string) => t.slice(0, 5);

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: '待付款',
  confirmed: '已确认',
  completed: '已完成',
  cancelled: '已取消',
  no_show: '爽约',
};
