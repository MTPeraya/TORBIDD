'use client';

// =============================================================================
// contexts/AuthContext.tsx - Client Authentication State & Google Auth Hook
// =============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  org: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (returnUrl?: string, useMock?: boolean) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (profile: { name?: string; org?: string; role?: string; avatar?: string | null }) => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: async () => {},
  refreshUser: async () => {},
  updateProfile: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();
  const { L } = useLanguage();

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setUser(data.authenticated && data.user ? data.user : null);
          }
        } else if (isMounted) {
          setUser(null);
        }
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.authenticated && data.user ? data.user : null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  const login = useCallback((returnUrl?: string, useMock?: boolean) => {
    const target = returnUrl || (typeof window !== 'undefined' ? window.location.pathname : '/');
    const url = new URL('/api/auth/google', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    url.searchParams.set('returnUrl', target);
    if (useMock) {
      url.searchParams.set('mock', 'true');
    }
    window.location.href = url.toString();
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      // Clear legacy localStorage cache if present
      try {
        localStorage.removeItem('torbidd_profile');
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event('torbidd_profile_updated'));
      showToast(L('logoutSuccess') || 'ออกจากระบบเรียบร้อยแล้ว', ICONS.check);
    }
  }, [L, showToast]);

  const updateProfile = useCallback(async (profile: { name?: string; org?: string; role?: string; avatar?: string | null }): Promise<AuthUser | null> => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          try {
            localStorage.setItem('torbidd_profile', JSON.stringify({
              userId: data.user.id,
              email: data.user.email,
              name: data.user.name,
              org: data.user.org,
              role: data.user.role,
              avatar: data.user.picture,
            }));
          } catch {}
          window.dispatchEvent(new Event('torbidd_profile_updated'));
          return data.user;
        }
      }
      return null;
    } catch (err) {
      console.error('Update profile error:', err);
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
