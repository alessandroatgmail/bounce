import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import { Location } from './useLocations';

const BASE = '/api/events/rooms/';

export interface Room {
  id: number;
  name: string;
  capacity: number;
  location: Location;
}

export interface RoomPayload {
  name: string;
  capacity: number | '';
  location_id: number | '';
}

export function useRooms(token: string | null) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setRooms(await res.json());
    } catch {
      setError('Failed to load rooms.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: RoomPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  const update = useCallback(async (id: number, data: RoomPayload): Promise<void> => {
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

  return { rooms, loading, error, refetch: fetchAll, create, update, remove };
}
