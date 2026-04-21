import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/festival/festival-days/';

export interface FestivalRoom {
  id: number;
  festival_day: number;
  room: { id: number; name: string; location: { id: number; name: string } };
}

export interface FestivalDay {
  id: number;
  date: string;
  rooms: FestivalRoom[];
}

export function useFestivalDays(token: string | null, eventId: number | null) {
  const [days, setDays] = useState<FestivalDay[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDays = useCallback(async () => {
    if (!token || !eventId) return;
    setLoading(true);
    try {
      const res = await authFetch(`${BASE}?event_id=${eventId}`, token);
      if (!res.ok) return;
      setDays(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => { fetchDays(); }, [fetchDays]);

  return { days, loading, refetch: fetchDays };
}
