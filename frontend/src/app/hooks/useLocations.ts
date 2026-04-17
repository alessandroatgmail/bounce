import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/events/locations/';

export interface City {
  id: number;
  name: string;
  country: string;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  city: City;
}

export interface LocationPayload {
  name: string;
  address: string;
  city_id: number | '';
}

export function useLocations(token: string | null) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setLocations(await res.json());
    } catch {
      setError('Failed to load locations.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: LocationPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  const update = useCallback(async (id: number, data: LocationPayload): Promise<void> => {
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

  return { locations, loading, error, refetch: fetchAll, create, update, remove };
}
