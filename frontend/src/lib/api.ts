import { getApiBase } from './env';

export function apiBase(): string {
  const base = getApiBase();
  return base.replace(/\/$/, "");
}

export async function getJSON<T = any>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - server not responding');
    }
    throw error;
  }
}

export async function postJSON<T = any>(path: string, body?: any, init?: RequestInit): Promise<T> {
  return getJSON<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });
}
