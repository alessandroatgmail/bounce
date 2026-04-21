import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/events/events/';

export interface EventItem {
  id: number;
  name: string;
  status: string;
  event_type: { id: number; name: string };
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
}

export function useEvents(token: string | null) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setEvents(await res.json());
    } catch {
      setError('Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: EventPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(body));
    }
    await fetchAll();
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

  const remove = useCallback(async (id: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  return { events, loading, error, refetch: fetchAll, create, update, remove };
}
