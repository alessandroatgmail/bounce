import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import type { AccommodationRoomType } from './useEvents';

const BASE = '/api/booking/accommodation-rooms/';

export interface AccommodationRoomUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface AccommodationRoom {
  id: number;
  extra_item: { id: number; name: string; name_it: string; name_en: string; value: string };
  event: { id: number; name: string };
  users: AccommodationRoomUser[];
  type: AccommodationRoomType;
  occupation_rate: string | null;
  paid_occupation_rate: string | null;
}

export interface AccommodationRoomPayload {
  extra_item_id: number;
  event_id: number;
  user_ids: number[];
  type?: AccommodationRoomType;
}

export interface AccommodationRoomFilters {
  extra_item?: number | '';
  name?: string;
}

export interface AccommodationTypeOccupancy {
  accommodation_type_id: number;
  extra_item_id: number;
  available_rooms: number;
  full_booked_rooms: number;
  full_paid_rooms: number;
  occupancy_rate: string;
  full_paid_rate: string;
}

export function useAccommodationTypeOccupancy(token: string | null, eventId: number | null) {
  const [occupancy, setOccupancy] = useState<Record<number, AccommodationTypeOccupancy>>({});
  const [loading, setLoading] = useState(false);

  const fetchOccupancy = useCallback(async () => {
    if (!token || !eventId) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/booking/accommodation-types/occupancy/?event=${eventId}`, token);
      if (!res.ok) return;
      const data: AccommodationTypeOccupancy[] = await res.json();
      setOccupancy(Object.fromEntries(data.map(e => [e.extra_item_id, e])));
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => { fetchOccupancy(); }, [fetchOccupancy]);

  return { occupancy, loading, refetch: fetchOccupancy };
}

export function useAccommodationRooms(
  token: string | null, eventId: number | null, filters: AccommodationRoomFilters = {},
) {
  const [rooms, setRooms] = useState<AccommodationRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { extra_item: extraItem, name } = filters;

  const fetchAll = useCallback(async () => {
    if (!token || !eventId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ event: String(eventId) });
      if (extraItem) params.set('extra_item', String(extraItem));
      if (name) params.set('name', name);
      const res = await authFetch(`${BASE}?${params}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setRooms(await res.json());
    } catch {
      setError('Failed to load accommodation rooms.');
    } finally {
      setLoading(false);
    }
  }, [token, eventId, extraItem, name]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: AccommodationRoomPayload): Promise<void> => {
    if (!token) throw new Error('No token');
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
    await fetchAll();
  }, [token, fetchAll]);

  const update = useCallback(async (id: number, data: Partial<AccommodationRoomPayload>): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'PATCH', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
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
