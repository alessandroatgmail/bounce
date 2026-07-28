import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/membership/discounts/';

export interface Discount {
  id: number;
  name: string;
  name_ext: string;
  description: string;
  rate: number | null;
  amount: string | null;
}

export interface DiscountPayload {
  name: string;
  name_ext: string;
  description: string;
  rate: number | null;
  amount: string | null;
}

export function useDiscounts(token: string | null) {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setDiscounts(await res.json());
    } catch {
      setError('Failed to load discounts.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: DiscountPayload): Promise<Discount> => {
    if (!token) throw new Error('No token');
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
    return res.json();
  }, [token]);

  const update = useCallback(async (id: number, data: DiscountPayload): Promise<void> => {
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

  return { discounts, loading, error, refetch: fetchAll, create, update, remove };
}
