export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('codetrack_token');
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem('codetrack_token', token);
    } else {
      localStorage.removeItem('codetrack_token');
    }
  } catch {
    // Ignore localStorage errors in restricted contexts
  }
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers
  });
}
