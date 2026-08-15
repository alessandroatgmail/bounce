import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import { type ExtraItem } from './useUserMemberships';

const BASE = '/api/booking/extra-items/';

export function useExtraItems(token: string | null) {
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setExtraItems(await res.json());
    } catch {
      setError('Failed to load extra items.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { extraItems, loading, error, refetch: fetchAll };
}
