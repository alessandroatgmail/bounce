import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/emails/logs/';

export interface EmailLog {
  id: number;
  email: number;
  email_to: string | string[] | null;
  date: string;
  status: number;
  exception_type: string;
  message: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useEmailLogs(token: string, emailId?: number) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (emailId !== undefined) params.set('email', String(emailId));
      const res = await authFetch(`${BASE}?${params}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      const data: PaginatedResponse<EmailLog> = await res.json();
      setLogs(data.results);
      setCount(data.count);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [token, emailId]);

  useEffect(() => { load(page); }, [page, load]);

  const totalPages = Math.ceil(count / 25);

  return { logs, count, page, setPage, totalPages, loading, error, refetch: load };
}
