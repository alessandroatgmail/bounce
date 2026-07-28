import { useState, useEffect, useCallback } from 'react';
import { authFetch, apiUrl } from '../../lib/api';
import type { EventItem } from './useEvents';

export interface EventFilters {
  event_type?: string;
  level?: string;
  level_id?: number;
  name?: string;
  style_id?: number;
  type?: string;
  status?: string;
  city_id?: number;
  upcoming?: boolean;
  active?: boolean;
  parent_only?: boolean;
  exclude_children?: boolean;
  multi_events?: boolean;
  frequency?: string;
  start_date_before?: string;
  end_date_after?: string;
}

export interface PaginatedEvents {
  events: EventItem[];
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

const BASE = '/api/events/events/';

export function buildEventParams(page: number, pageSize: number, f: EventFilters): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (f.event_type) params.set('event_type', f.event_type);
  if (f.level) params.set('level', f.level);
  if (f.level_id) params.set('level_id', String(f.level_id));
  if (f.name) params.set('name', f.name);
  if (f.style_id) params.set('style_id', String(f.style_id));
  if (f.type) params.set('type', f.type);
  if (f.status) params.set('status', f.status);
  if (f.city_id) params.set('city_id', String(f.city_id));
  if (f.upcoming) params.set('upcoming', 'true');
  if (f.active) params.set('active', 'true');
  if (f.parent_only) params.set('parent_only', 'true');
  if (f.exclude_children) params.set('exclude_children', 'true');
  if (f.multi_events) params.set('multi_events', 'true');
  if (f.frequency) params.set('frequency', f.frequency);
  if (f.start_date_before) params.set('start_date_before', f.start_date_before);
  if (f.end_date_after) params.set('end_date_after', f.end_date_after);
  return params;
}

export function useEventsPaginated(token: string | null, initialFilters: EventFilters = {}, pageSize = 20): PaginatedEvents {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<EventFilters>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (p: number, f: EventFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = buildEventParams(p, pageSize, f);
      const url = `${BASE}?${params}`;
      const res = token
        ? await authFetch(url, token)
        : await window.fetch(apiUrl(url), { headers: { 'Content-Type': 'application/json' } });
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
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
  }, [token]);

  return { events, count, page, pageSize, loading, error, setPage, setFilters: handleSetFilters, refetch, remove };
}
