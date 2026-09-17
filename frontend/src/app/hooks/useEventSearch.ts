import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import type { AdminEventItem } from './useAdminEventsPaginated';

const BASE = '/api/events/admin/';

// Name search over top-level events only (parent_only — excludes generated
// weekly occurrences), for pickers like the payments filter where showing
// every child event would make the list unusable.
export function useEventSearch(token: string | null, name: string) {
  const [results, setResults] = useState<AdminEventItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', page_size: '10', parent_only: 'true' });
      if (name) params.set('name', name);
      const res = await authFetch(`${BASE}?${params}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setResults(data.results);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [token, name]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  return { results, loading };
}
