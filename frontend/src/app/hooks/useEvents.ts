import { useState, useEffect, useCallback } from 'react';
import { authFetch, authFetchFile, apiUrl } from '../../lib/api';

const BASE = '/api/events/events/';

export interface EventMembership {
  id: number;
  name: string;
  type: string;
  contribution: number;
  color: string | null;
  max_events: number;
  duration: number;
}

export interface EventItem {
  id: number;
  name: string;
  status: string;
  event_type: { id: number; name: string; frequency: string; partners: number; partner_roles: { id: number; name: string }[] };
  type: string;
  start_date: string;
  end_date: string;
  duration: number;
  room: { id: number; name: string; location: { id: number; name: string; city: { id: number; name: string } } };
  capacity: number;
  level: { id: number; name: string } | null;
  artists: { id: number; full_name: string }[];
  genres: { id: number; name: string }[];
  styles: { id: number; name: string }[];
  events: number[];
  info: string | null;
  color: string | null;
  image: string | null;
  effective_image: string | null;
  accepted_roles: { id: number; name: string }[];
  memberships: EventMembership[];
  warning_threshold: number;
  extras: number;
  payment_days: number;
  multi_events: boolean;
  free: boolean;
  children_levels: { id: number; name: string }[];
  already_booked: boolean;
  booked_by: string | null;
  available_spot: number;
}

export interface EventPayload {
  name: string;
  status: string;
  event_type_id: number;
  type: string;
  start_date: string;
  end_date: string;
  duration: number;
  room_id: number;
  capacity: number;
  level_id?: number | null;
  artist_ids?: number[];
  genre_ids?: number[];
  style_ids?: number[];
  info?: string | null;
  color?: string | null;
  payment_days?: number;
  warning_threshold?: number;
  extras?: number;
  accepted_role_ids?: number[];
  membership_ids?: number[];
  multi_events?: boolean;
  free?: boolean;
  event_ids?: number[];
}

export function useEvents(token: string | null) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accumulated: EventItem[] = [];
      let url: string | null = BASE;
      while (url) {
        const res = token
          ? await authFetch(url, token)
          : await fetch(apiUrl(url), { headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          accumulated.push(...data);
          url = null;
        } else {
          accumulated.push(...data.results);
          url = data.next
            ? new URL(data.next).pathname + new URL(data.next).search
            : null;
        }
      }
      setEvents(accumulated);
    } catch {
      setError('Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: EventPayload): Promise<number> => {
    if (!token) throw new Error('Not authenticated');
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(body));
    }
    const created: EventItem = await res.json();
    await fetchAll();
    return created.id;
  }, [token, fetchAll]);

  const update = useCallback(async (id: number, data: EventPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(body));
    }
    await fetchAll();
  }, [token, fetchAll]);

  const uploadImage = useCallback(async (id: number, file: File): Promise<void> => {
    if (!token) return;
    const form = new FormData();
    form.append('image', file);
    const res = await authFetchFile(`${BASE}${id}/`, token, form);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(body));
    }
    await fetchAll();
  }, [token, fetchAll]);

  const remove = useCallback(async (id: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  return { events, loading, error, refetch: fetchAll, create, update, uploadImage, remove };
}
