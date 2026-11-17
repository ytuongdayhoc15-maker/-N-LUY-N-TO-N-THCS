let currentCsrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  currentCsrfToken = token;
}

export async function apiRequest<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && currentCsrfToken) {
    headers.set('X-CSRF-Token', currentCsrfToken);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin'
  });

  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { error: text };
  }

  if (!res.ok) {
    throw new Error(parsed?.error || `Lỗi máy chủ (${res.status})`);
  }
  return parsed as T;
}
