import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import { buildEventParams, type EventFilters } from './useEventsPaginated';

// Flat shape served by /api/events/admin/ — just the admin table columns.
export interface AdminEventItem {
  id: number;
  name: string;
  status: string;
  event_type_name: string;
  start_date: string;
  room: string;
  artists: string[];
  capacity: number;
  available_spot: number;
}

export interface PaginatedAdminEvents {
  events: AdminEventItem[];
  count: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setFilters: (filters: EventFilters) => void;
  refetch: () => void;
  remove: (id: number) => Promise<void>;
}

const BASE = '/api/events/admin/';
// Writes still go through the full events endpoint; the admin list is read-only.
const EVENTS_BASE = '/api/events/events/';

export function useAdminEventsPaginated(token: string | null, initialFilters: EventFilters = {}, pageSize = 20): PaginatedAdminEvents {
  const [events, setEvents] = useState<AdminEventItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<EventFilters>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (p: number, f: EventFilters) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = buildEventParams(p, pageSize, f);
      const res = await authFetch(`${BASE}?${params}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setEvents(data.results);
      setCount(data.count);
    } catch {
      setError('Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetch(page, filters); }, [fetch, page, filters]);

  const handleSetFilters = useCallback((f: EventFilters) => {
    setPage(1);
    setFilters(f);
  }, []);

  const refetch = useCallback(() => { fetch(page, filters); }, [fetch, page, filters]);

  const remove = useCallback(async (id: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${EVENTS_BASE}${id}/`, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
  }, [token]);

  return { events, count, page, pageSize, loading, error, setPage, setFilters: handleSetFilters, refetch, remove };
}
