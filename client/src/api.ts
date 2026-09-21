const TOKEN_KEY = 'bookit_admin_token';
const CUSTOMER_TOKEN_KEY = 'bookit_customer_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const getCustomerToken = () => localStorage.getItem(CUSTOMER_TOKEN_KEY);
export const setCustomerToken = (t: string) => localStorage.setItem(CUSTOMER_TOKEN_KEY, t);
export const clearCustomerToken = () => localStorage.removeItem(CUSTOMER_TOKEN_KEY);

export class ApiError extends Error {
  status: number;
  details?: string[];
  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const ERROR_TRANSLATIONS: Array<[RegExp, string]> = [
  [/^Invalid email or password$/, '邮箱或密码错误'],
  [/^Invalid or expired token$/, '登录已失效，请重新登录'],
  [/^Sign in to continue$/, '请登录后继续'],
  [/^Sign in to redeem points$/, '请登录后使用积分'],
  [/^Provider not found$/, '未找到服务商'],
  [/^Service not found$/, '未找到服务'],
  [/^Customer not found$/, '未找到客户'],
  [/^Account not found$/, '未找到账户'],
  [/^Booking not found$/, '未找到预约'],
  [/^No booking found for that code and email$/, '未找到与该预约码和邮箱匹配的预约'],
  [/^This booking has already been reviewed$/, '此预约已经评价过了'],
  [/^Past bookings cannot be cancelled$/, '过去的预约不能取消'],
  [/^Pick a date that is today or later$/, '请选择今天或之后的日期'],
  [/^Order not found$/, '未找到订单'],
  [/^Order already paid$/, '订单已经支付'],
  [/^Payment failed \(simulated\).*$/, '支付失败（模拟支付），在保留时间结束前可以重试'],
  [/^Invalid payment signature$/, '支付签名无效'],
  [/^No refundable payment found$/, '未找到可退款的支付记录'],
  [/^This payment is already fully refunded$/, '此支付记录已经全部退款'],
  [/^Validation failed$/, '数据校验失败'],
  [/^Internal server error$/, '服务器内部错误'],
];

export const localizeError = (message: string) => {
  for (const [pattern, translation] of ERROR_TRANSLATIONS) {
    if (pattern.test(message)) return translation;
  }
  return message;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const isAdminPath = path.startsWith('/api/admin');
  const token = isAdminPath ? getToken() : getCustomerToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      if (isAdminPath) clearToken();
      else if (token && path.startsWith('/api/customer')) clearCustomerToken();
    }
    throw new ApiError(res.status, localizeError(body.error ?? `Request failed (${res.status})`), body.details);
  }
  return body as T;
}

/** Authenticated file download — a plain <a href> can't carry the JWT header. */
export async function downloadFile(path: string, filename: string) {
  const token = path.startsWith('/api/admin') ? getToken() : getCustomerToken();
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, `下载失败（${res.status}）`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
