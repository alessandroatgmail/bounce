import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/consent/communications/';

export interface CommunicationTarget {
  id: number;
  name: string;
}

export interface Communication {
  id: number;
  events: CommunicationTarget[];
  extra_items: CommunicationTarget[];
  plans: CommunicationTarget[];
  title: string;
  title_it: string;
  title_en: string;
  desc: string;
  desc_it: string;
  desc_en: string;
  recurrent: boolean;
}

export interface CommunicationPayload {
  event_ids: number[];
  extra_item_ids: number[];
  plan_ids: number[];
  title: string;
  title_it: string;
  title_en: string;
  desc: string;
  desc_it: string;
  desc_en: string;
  recurrent: boolean;
}

export function useCommunications(token: string | null) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setCommunications(await res.json());
    } catch {
      setError('Failed to load communications.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: CommunicationPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  const update = useCallback(async (id: number, data: CommunicationPayload): Promise<void> => {
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

  return { communications, loading, error, refetch: fetchAll, create, update, remove };
}
