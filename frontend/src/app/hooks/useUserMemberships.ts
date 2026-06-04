import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import type { Membership } from './useMemberships';

const BASE = '/api/booking/my-memberships/';

export type ContributionStatus = 'received' | 'accepted' | 'confirmed' | 'payed';

export interface UserMembership {
  id: number;
  status: ContributionStatus;
  membership: Membership | null;
  events: number[];
  amount: string;
  start_date: string | null;
  end_date: string | null;
  upgraded_from: number | null;
}

async function extractErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  if (body.membership_id) return Array.isArray(body.membership_id) ? body.membership_id[0] : body.membership_id;
  if (body.detail) return body.detail;
  if (body.non_field_errors) return Array.isArray(body.non_field_errors) ? body.non_field_errors[0] : body.non_field_errors;
  const first = Object.values(body)[0];
  if (first) return Array.isArray(first) ? String(first[0]) : String(first);
  return `Error ${res.status}`;
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
    if (!res.ok) throw new Error(await extractErrorMessage(res));
    await fetchAll();
  }, [token, fetchAll]);

  const upgrade = useCallback(async (contributionId: number, membershipId: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${contributionId}/upgrade/`, token, {
      method: 'POST',
      body: JSON.stringify({ membership_id: membershipId }),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res));
    await fetchAll();
  }, [token, fetchAll]);

  const addEvent = useCallback(async (id: number, eventId: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/add-event/`, token, {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId }),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res));
    await fetchAll();
  }, [token, fetchAll]);

  return { userMemberships, loading, error, refetch: fetchAll, create, upgrade, addEvent };
}
