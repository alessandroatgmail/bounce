import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { apiUrl } from '../../lib/api';

export type UserRole = 'guest' | 'student' | 'admin';

export interface User {
  id: string;
  uuid: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  phone?: string;
  date_of_birth?: string | null;
  place_of_birth?: { id: number; name: string } | null;
  ci?: string;
  address?: string;
  city?: { id: number; name: string } | null;
  postal_code?: string;
  country?: { id: number; name: string } | null;
  acsi?: boolean;
  acsi_number?: number | null;
  acsi_expiration_date?: string | null;
  privacy_consent?: boolean;
  marketing_consent?: boolean;
  joinedDate?: string;
  profile_image?: string | null;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  isAuthenticated: boolean;
  adminViewMode: 'admin' | 'student';
  setAdminViewMode: (mode: 'admin' | 'student') => void;
  updateUser: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  return JSON.parse(atob(payload));
}

function mapRole(backendRole: string): UserRole {
  if (backendRole === 'admin') return 'admin';
  return 'student';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'student'>('admin');
  const [initializing, setInitializing] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so the scheduled timer always calls the latest version of tryRefresh
  const tryRefreshRef = useRef<() => Promise<string | null>>();

  const clearRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const performLogout = () => {
    clearRefreshTimer();
    localStorage.removeItem('refresh_token');
    setAccessToken(null);
    setUser(null);
    setAdminViewMode('admin');
  };

  // Apply a fresh token pair to state and schedule the next silent refresh.
  const applySession = (access: string, refresh: string): User => {
    const payload = decodeJwtPayload(access);
    const role = mapRole(payload['role'] as string);
    const newUser: User = {
      id: String(payload['user_id']),
      uuid: '',
      email: payload['email'] as string,
      name: '',
      role,
    };
    localStorage.setItem('refresh_token', refresh);
    setAccessToken(access);
    setUser(newUser);
    if (role === 'admin') setAdminViewMode('admin');

    // Refresh 60 s before the access token expires
    const exp = payload['exp'] as number;
    const msUntilRefresh = Math.max((exp - Date.now() / 1000 - 60) * 1000, 0);
    clearRefreshTimer();
    refreshTimerRef.current = setTimeout(() => tryRefreshRef.current?.(), msUntilRefresh);

    // Enrich with full profile data (name, uuid, profile_image, etc.)
    fetch(apiUrl('/api/auth/me/'), {
      headers: { Authorization: `Bearer ${access}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setUser(u => u ? {
          ...u,
          uuid: data.uuid ?? '',
          name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          phone: data.phone ?? undefined,
          date_of_birth: data.date_of_birth ?? null,
          place_of_birth: data.place_of_birth ?? null,
          ci: data.ci ?? '',
          address: data.address ?? '',
          city: data.city ?? null,
          postal_code: data.postal_code ?? '',
          country: data.country ?? null,
          acsi: data.acsi ?? false,
          acsi_number: data.acsi_number ?? null,
          acsi_expiration_date: data.acsi_expiration_date ?? null,
          privacy_consent: data.privacy_consent ?? false,
          marketing_consent: data.marketing_consent ?? false,
          joinedDate: data.date_joined ?? undefined,
          profile_image: data.profile_image ?? null,
        } : u);
      })
      .catch(() => {/* non-critical */});

    return newUser;
  };

  const updateUser = (partial: Partial<User>) => {
    setUser(u => u ? { ...u, ...partial } : u);
  };

  const tryRefresh = async (): Promise<string | null> => {
    const storedRefresh = localStorage.getItem('refresh_token');
    if (!storedRefresh) {
      performLogout();
      return null;
    }
    try {
      const res = await fetch(apiUrl('/api/auth/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: storedRefresh }),
      });
      if (!res.ok) {
        performLogout();
        return null;
      }
      const data = await res.json();
      const newAccess = data.access as string;
      // SimpleJWT can rotate the refresh token; use the new one if provided
      const newRefresh = (data.refresh as string | undefined) ?? storedRefresh;
      applySession(newAccess, newRefresh);
      return newAccess;
    } catch {
      performLogout();
      return null;
    }
  };

  // Keep the ref pointing at the latest closure so the timer never goes stale
  tryRefreshRef.current = tryRefresh;

  // On mount: silently restore session from the stored refresh token
  useEffect(() => {
    tryRefresh().finally(() => setInitializing(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clearRefreshTimer(); }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
    const res = await fetch(apiUrl('/api/auth/token/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return applySession(data.access as string, data.refresh as string);
  };

  // Render nothing while we check for a stored session — avoids a flash of the login page
  if (initializing) return null;

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      login,
      logout: performLogout,
      isAuthenticated: user !== null,
      adminViewMode,
      setAdminViewMode,
      updateUser,
    }}>
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
