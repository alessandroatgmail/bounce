import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/events/cities/';

export interface City {
  id: number;
  name: string;
  country: string;
}

export function useCities(token: string | null) {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setCities(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { cities, loading };
}
