import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE       = '/api/membership/memberships/';
const RULES_BASE = '/api/membership/rules/';

export interface MembershipRule {
  id: number;
  membership: number;
  event_type: { id: number; name: string; frequency: string; partners: number };
  max_events: number;
}

export interface MembershipRulePayload {
  membership: number;
  event_type_id: number;
  max_events: number;
}

export interface Membership {
  id: number;
  name: string;
  type: 'single' | 'monthly' | 'quarter' | 'year';
  contribution: number;
  color: string | null;
  max_events: number;
  rules: MembershipRule[];
}

export interface MembershipPayload {
  name: string;
  type: string;
  contribution: number;
  color: string | null;
  max_events: number;
}

export const MEMBERSHIP_TYPES = [
  { value: 'single',  label: 'Single'  },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year',    label: 'Year'    },
];

export function useMemberships(token: string | null) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setMemberships(await res.json());
    } catch {
      setError('Failed to load memberships.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: MembershipPayload): Promise<Membership> => {
    if (!token) throw new Error('No token');
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
    return res.json();
  }, [token]);

  const update = useCallback(async (id: number, data: MembershipPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
  }, [token]);

  const remove = useCallback(async (id: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  const createRule = useCallback(async (data: MembershipRulePayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(RULES_BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`${res.status}`);
  }, [token]);

  const deleteRule = useCallback(async (id: number): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${RULES_BASE}${id}/`, token, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
  }, [token]);

  return { memberships, loading, error, refetch: fetchAll, create, update, remove, createRule, deleteRule };
}
