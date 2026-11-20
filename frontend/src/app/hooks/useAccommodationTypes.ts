import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import { type Location } from './useLocations';

const BASE = '/api/booking/accommodation-types/';

export interface AccommodationExtraItem {
  id: number;
  name: string;
  name_it: string;
  name_en: string;
  value: string;
  expiration_date: string;
}

export interface AccommodationType {
  id: number;
  extra_item: AccommodationExtraItem;
  location: Location;
  description: string | null;
  occupants_per_room: number;
  available_rooms: number;
}

export interface AccommodationTypePayload {
  extra_item: {
    name: string;
    name_it: string;
    name_en: string;
    value: string;
    expiration_date: string;
  };
  location_id: number | '';
  description: string;
  occupants_per_room: number | '';
  available_rooms: number | '';
}

export function useAccommodationTypes(token: string | null) {
  const [accommodationTypes, setAccommodationTypes] = useState<AccommodationType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setAccommodationTypes(await res.json());
    } catch {
      setError('Failed to load accommodation types.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: AccommodationTypePayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  const update = useCallback(async (id: number, data: AccommodationTypePayload): Promise<void> => {
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

  return { accommodationTypes, loading, error, refetch: fetchAll, create, update, remove };
}
