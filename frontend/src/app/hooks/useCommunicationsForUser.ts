import { useCallback, useState } from 'react';
import { authFetch } from '../../lib/api';
import type { Communication } from './useCommunications';

const BASE = '/api/consent/communications/for-user/';

export interface CommunicationFilters {
  event?: number | '';
  extraItem?: number | '';
  plan?: number | '';
}

export function useCommunicationsForUser(token: string | null) {
  const [loading, setLoading] = useState(false);

  const fetchFor = useCallback(async (filters: CommunicationFilters): Promise<Communication[]> => {
    if (!token) return [];
    const params = new URLSearchParams();
    if (filters.event) params.set('event', String(filters.event));
    if (filters.extraItem) params.set('extra_item', String(filters.extraItem));
    if (filters.plan) params.set('plan', String(filters.plan));

    setLoading(true);
    try {
      const res = await authFetch(`${BASE}?${params.toString()}`, token);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { fetchFor, loading };
}
