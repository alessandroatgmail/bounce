import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import type { EventItem } from './useEvents';

const BASE = '/api/booking/my-bookings/';

export interface UserBooking {
  id: number;
  event: EventItem;
}

export function useUserBookings(token: string | null) {
  const [userBookings, setUserBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setUserBookings(await res.json());
    } catch {
      setError('Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { userBookings, loading, error, refetch: fetchAll };
}
