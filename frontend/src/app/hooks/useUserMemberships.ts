import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import type { Membership } from './useMemberships';

const BASE = '/api/booking/my-memberships/';

export interface UserMembership {
  id: number;
  membership: Membership | null;
  events: number[];
  amount: string;
}

export function useUserMemberships(token: string | null) {
  const [userMemberships, setUserMemberships] = useState<UserMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setUserMemberships(await res.json());
    } catch {
      setError('Failed to load memberships.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (membershipId: number, eventId?: number): Promise<void> => {
    if (!token) return;
    const body: Record<string, number> = { membership_id: membershipId };
    if (eventId !== undefined) body.event_id = eventId;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
    await fetchAll();
  }, [token, fetchAll]);

  const addEvent = useCallback(async (id: number, eventId: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/add-event/`, token, {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId }),
    });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
    await fetchAll();
  }, [token, fetchAll]);

  return { userMemberships, loading, error, refetch: fetchAll, create, addEvent };
}
