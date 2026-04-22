import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/booking/contributions/';

export interface Contribution {
  id: number;
  amount: string;
  user: number;
  events: number[];
  membership: number | null;
}

export interface ContributionPayload {
  amount: string;
  user: number;
  event_ids?: number[];
  membership_id?: number | null;
}

export function useContributions(token: string | null, userId: number | null) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForUser = useCallback(async () => {
    if (!token || !userId) { setContributions([]); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${BASE}?user=${userId}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setContributions(await res.json());
    } catch {
      setError('Failed to load contributions.');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => { fetchForUser(); }, [fetchForUser]);

  const create = useCallback(async (data: ContributionPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
    await fetchForUser();
  }, [token, fetchForUser]);

  const update = useCallback(async (id: number, data: ContributionPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
    await fetchForUser();
  }, [token, fetchForUser]);

  const remove = useCallback(async (id: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchForUser();
  }, [token, fetchForUser]);

  return { contributions, loading, error, refetch: fetchForUser, create, update, remove };
}
