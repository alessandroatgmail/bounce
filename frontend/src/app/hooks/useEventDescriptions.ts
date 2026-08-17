import { useState, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/events/event-descriptions/';

export interface EventDescriptionItem {
  id: number;
  event: number;
  language: string;
  desc: string;
}

// Admin CRUD for the HTML descriptions attached to a single event, scoped by
// language (one row per event+language, enforced by the API).
export function useEventDescriptions(token: string | null) {
  const [descriptions, setDescriptions] = useState<EventDescriptionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchForEvent = useCallback(async (eventId: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await authFetch(`${BASE}?event=${eventId}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setDescriptions(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  const save = useCallback(async (
    eventId: number,
    language: string,
    desc: string,
    existingId?: number,
  ): Promise<void> => {
    if (!token) return;
    const res = existingId
      ? await authFetch(`${BASE}${existingId}/`, token, { method: 'PATCH', body: JSON.stringify({ desc }) })
      : await authFetch(BASE, token, { method: 'POST', body: JSON.stringify({ event_id: eventId, language, desc }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(body));
    }
    await fetchForEvent(eventId);
  }, [token, fetchForEvent]);

  const remove = useCallback(async (eventId: number, id: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchForEvent(eventId);
  }, [token, fetchForEvent]);

  return { descriptions, loading, fetchForEvent, save, remove };
}
