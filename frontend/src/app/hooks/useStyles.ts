import { useState, useEffect, useCallback } from 'react';
import { apiUrl, authFetch } from '../../lib/api';

const BASE = '/api/events/styles/';

export interface Style {
  id: number;
  name: string;
}

export type StylePayload = Omit<Style, 'id'>;

export function useStyles(token: string | null) {
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = token ? await authFetch(BASE, token) : await fetch(apiUrl(BASE));
      if (!res.ok) throw new Error(`${res.status}`);
      setStyles(await res.json());
    } catch {
      setError('Failed to load styles.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: StylePayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  const update = useCallback(async (id: number, data: StylePayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  const remove = useCallback(async (id: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  return { styles, loading, error, refetch: fetchAll, create, update, remove };
}
