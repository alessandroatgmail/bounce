import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/auth/users/';

export interface UserMembershipSummary {
  id: number;
  name: string;
  color: string | null;
}

export interface UserListItem {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  memberships: UserMembershipSummary[];
}

export interface UserListFilters {
  name?: string;
  membership?: number | '';
  event?: number | '';
}

export const USER_LIST_PAGE_SIZE = 20;

export function useUserList(token: string | null, page: number, filters: UserListFilters) {
  const [results, setResults] = useState<UserListItem[]>([]);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const { name = '', membership = '', event = '' } = filters;

  const fetchPage = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (name)       params.set('name',       name);
      if (membership) params.set('membership', String(membership));
      if (event)      params.set('event',      String(event));

      const res = await authFetch(`${BASE}?${params}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setResults(data.results);
      setCount(data.count);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [token, page, name, membership, event]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const totalPages = Math.ceil(count / USER_LIST_PAGE_SIZE);

  return { results, count, totalPages, loading, error, refetch: fetchPage };
}
