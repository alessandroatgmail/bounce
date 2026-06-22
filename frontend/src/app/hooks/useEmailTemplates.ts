import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/emails/templates/';

export interface EmailTemplate {
  id: number;
  name: string;
  description: string;
  subject: string;
  content: string;
  html_content: string;
  language: string;
  default_template: number | null;
  created: string;
  last_updated: string;
}

export interface EmailTemplatePayload {
  name: string;
  description?: string;
  subject: string;
  content?: string;
  html_content?: string;
  language?: string;
  default_template?: number | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useEmailTemplates(token: string) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
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
      const data: PaginatedResponse<EmailTemplate> = await res.json();
      setTemplates(data.results);
      setCount(data.count);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(page); }, [page, load]);

  const create = async (payload: EmailTemplatePayload): Promise<EmailTemplate> => {
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`${res.status}`);
    const created = await res.json();
    load(page);
    return created;
  };

  const update = async (id: number, payload: Partial<EmailTemplatePayload>): Promise<EmailTemplate> => {
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'PATCH', body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`${res.status}`);
    const updated = await res.json();
    load(page);
    return updated;
  };

  const remove = async (id: number): Promise<void> => {
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
    load(page);
  };

  const totalPages = Math.ceil(count / 25);

  return { templates, count, page, setPage, totalPages, loading, error, create, update, remove, refetch: load };
}
