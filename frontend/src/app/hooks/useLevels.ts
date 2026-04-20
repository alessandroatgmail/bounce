import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/events/levels/';

export interface Level {
  id: number;
  name: string;
}

export function useLevels(token: string | null) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setLevels(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { levels, loading };
}
