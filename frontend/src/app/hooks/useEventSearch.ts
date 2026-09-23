import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import type { AdminEventItem } from './useAdminEventsPaginated';

const BASE = '/api/events/admin/';

// Name search over events, paginated server-side (page_size=10) instead of
// loading the whole table. By default it's scoped to top-level events only
// (parent_only — excludes generated weekly occurrences), for pickers like
// the payments filter where showing every child event would make the list
// unusable. Pass parentOnly=false for pickers that need to reach individual
// occurrences too (e.g. a membership's fixed events, which can be a single
// festival session rather than the whole festival).
export function useEventSearch(token: string | null, name: string, parentOnly: boolean = true) {
  const [results, setResults] = useState<AdminEventItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', page_size: '10' });
      if (parentOnly) params.set('parent_only', 'true');
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
  }, [token, name, parentOnly]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  return { results, loading };
}
