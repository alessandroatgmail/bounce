import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import { ArtistType } from './useArtistTypes';
import { Style } from './useStyles';
import { Genre } from './useGenres';

const BASE = '/api/events/artists/';

export interface Artist {
  id: number;
  full_name: string;
  user: number | null;
  first_name: string | null;
  last_name: string | null;
  types: ArtistType[];
  styles: Style[];
  genres: Genre[];
}

export interface ArtistPayload {
  first_name: string;
  last_name: string;
  type_ids: number[];
  style_ids: number[];
  genre_ids: number[];
}

export function useArtists(token: string | null) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setArtists(await res.json());
    } catch {
      setError('Failed to load artists.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: ArtistPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`${res.status}`);
    await fetchAll();
  }, [token, fetchAll]);

  const update = useCallback(async (id: number, data: ArtistPayload): Promise<void> => {
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

  return { artists, loading, error, refetch: fetchAll, create, update, remove };
}
