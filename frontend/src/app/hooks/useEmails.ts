import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/emails/emails/';

export interface EmailLog {
  id: number;
  email: number;
  date: string;
  status: number;
  exception_type: string;
  message: string;
}

export interface SentEmail {
  id: number;
  from_email: string;
  to: string | string[];
  cc: string | string[];
  bcc: string | string[];
  subject: string;
  message: string;
  html_message: string;
  status: number;
  priority: number;
  created: string;
  last_updated: string;
  scheduled_time: string | null;
  expires_at: string | null;
  message_id: string;
  number_of_retries: number;
  template: number | null;
  template_name: string | null;
  context: Record<string, unknown>;
  backend_alias: string;
  logs: EmailLog[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useEmails(token: string) {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${BASE}?page=${p}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      const data: PaginatedResponse<SentEmail> = await res.json();
      setEmails(data.results);
      setCount(data.count);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(page); }, [page, load]);

  const totalPages = Math.ceil(count / 25);

  return { emails, count, page, setPage, totalPages, loading, error, refetch: load };
}
