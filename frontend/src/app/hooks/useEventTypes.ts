import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/events/event-types/';

export type Frequency = 'single' | 'weekly' | 'monthly';

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'single',  label: 'One Shot' },
  { value: 'weekly',  label: 'Weekly'   },
  { value: 'monthly', label: 'Monthly'  },
];

export interface EventType {
  id: number;
  name: string;
  frequency: Frequency;
  partners: number;
  partner_roles: { id: number; name: string }[];
}

export interface EventTypePayload {
  name: string;
  frequency: string;
  partners: number;
  role_ids?: number[];
}

export function useEventTypes(token: string | null) {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setEventTypes(await res.json());
    } catch {
      setError('Failed to load event types.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: EventTypePayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  const update = useCallback(async (id: number, data: EventTypePayload): Promise<void> => {
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

  return { eventTypes, loading, error, refetch: fetchAll, create, update, remove };
}
