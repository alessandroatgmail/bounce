import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'guest' | 'student' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  joinedDate?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  isAuthenticated: boolean;
  adminViewMode: 'admin' | 'student';
  setAdminViewMode: (mode: 'admin' | 'student') => void;
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

  const login = async (email: string, password: string): Promise<User | null> => {
    const response = await fetch('/api/auth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const { access, refresh } = data as { access: string; refresh: string };

    const payload = decodeJwtPayload(access);
    const role = mapRole(payload['role'] as string);

    const loggedInUser: User = {
      id: String(payload['user_id']),
      email: payload['email'] as string,
      name: '',
      role,
    };

    localStorage.setItem('refresh_token', refresh);
    setAccessToken(access);
    setUser(loggedInUser);

    if (role === 'admin') setAdminViewMode('admin');

    return loggedInUser;
  };

  const logout = () => {
    localStorage.removeItem('refresh_token');
    setAccessToken(null);
    setUser(null);
    setAdminViewMode('admin');
  };

  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, isAuthenticated, adminViewMode, setAdminViewMode }}>
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
