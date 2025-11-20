'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';

export enum Role {
  ADMIN = 'ADMIN',
  SAFETY_OFFICER = 'SAFETY_OFFICER',
  SUPERVISOR = 'SUPERVISOR',
  OPERATOR = 'OPERATOR',
}

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: Role[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const REFRESH_THRESHOLD = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getAccessToken = () => Cookies.get(ACCESS_TOKEN_KEY);
  const getRefreshToken = () => Cookies.get(REFRESH_TOKEN_KEY);

  const setTokens = (accessToken: string, refreshToken: string, expiresIn: number) => {
    const expiresMinutes = expiresIn / 60;
    Cookies.set(ACCESS_TOKEN_KEY, accessToken, {
      expires: expiresMinutes / (24 * 60),
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken, {
      expires: 7,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  };

  const clearTokens = () => {
    Cookies.remove(ACCESS_TOKEN_KEY);
    Cookies.remove(REFRESH_TOKEN_KEY);
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      await refreshAuth();
      const newToken = getAccessToken();
      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        return fetch(url, { ...options, headers });
      }
      throw new Error('Authentication failed');
    }

    return response;
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      setTokens(data.accessToken, data.refreshToken, data.expiresIn);
      setUser(data.user);
    } catch (error) {
      clearTokens();
      setUser(null);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await fetchWithAuth(`${API_URL}/auth/logout`, {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const refreshAuth = async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json();
      setTokens(data.accessToken, data.refreshToken, data.expiresIn);
      setUser(data.user);
    } catch (error) {
      clearTokens();
      setUser(null);
      throw error;
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/auth/me`);
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        throw new Error('Failed to fetch user');
      }
    } catch (error) {
      clearTokens();
      setUser(null);
    }
  };

  const hasRole = (role: Role): boolean => {
    return user?.roles.includes(role) ?? false;
  };

  const hasAnyRole = (...roles: Role[]): boolean => {
    return roles.some((role) => hasRole(role));
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      if (token) {
        await fetchUserProfile();
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const token = getAccessToken();
      if (!token) {
        await refreshAuth();
      }
    }, REFRESH_THRESHOLD);

    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshAuth,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredRoles?: Role[],
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, hasAnyRole } = useAuth();

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }

    if (requiredRoles && !hasAnyRole(...requiredRoles)) {
      return <div>Access Denied</div>;
    }

    return <Component {...props} />;
  };
}
