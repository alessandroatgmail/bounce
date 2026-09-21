import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/booking/extra-items/acsi/';

export interface AcsiExtraItem {
  id: number;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    acsi_expiration_date: string | null;
  };
  event_start_date: string | null;
  event_name: string | null;
}

export const ACSI_EXTRA_ITEMS_PAGE_SIZE = 20;

export function useAcsiExtraItems(token: string | null, page: number, userId: number | '' = '') {
  const [results, setResults] = useState<AcsiExtraItem[]>([]);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (userId) params.set('user', String(userId));
      const res = await authFetch(`${BASE}?${params}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setResults(data.results);
      setCount(data.count);
    } catch {
      setError('Failed to load ACSI extra items.');
    } finally {
      setLoading(false);
    }
  }, [token, page, userId]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const totalPages = Math.ceil(count / ACSI_EXTRA_ITEMS_PAGE_SIZE);

  return { results, count, totalPages, loading, error, refetch: fetchPage };
}
