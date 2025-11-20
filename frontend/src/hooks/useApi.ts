import { useState, useCallback } from 'react';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const request = useCallback(async <T = any>(
    endpoint: string,
    options: ApiOptions = {},
  ): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const { skipAuth, ...fetchOptions } = options;
      const token = Cookies.get('accessToken');

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(!skipAuth && token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      };

      const response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
      });

      if (response.status === 401 && !skipAuth) {
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed: ${response.statusText}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return await response.json();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(
    <T = any>(endpoint: string, options?: ApiOptions) =>
      request<T>(endpoint, { ...options, method: 'GET' }),
    [request],
  );

  const post = useCallback(
    <T = any>(endpoint: string, data?: any, options?: ApiOptions) =>
      request<T>(endpoint, {
        ...options,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      }),
    [request],
  );

  const patch = useCallback(
    <T = any>(endpoint: string, data?: any, options?: ApiOptions) =>
      request<T>(endpoint, {
        ...options,
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      }),
    [request],
  );

  const del = useCallback(
    <T = any>(endpoint: string, options?: ApiOptions) =>
      request<T>(endpoint, { ...options, method: 'DELETE' }),
    [request],
  );

  return {
    loading,
    error,
    request,
    get,
    post,
    patch,
    delete: del,
  };
}
