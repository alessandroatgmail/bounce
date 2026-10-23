import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/booking/contributions-admin/';

export interface ContributionAdminListItem {
  id: number;
  user: number;
  full_name: string;
  email: string;
  phone: string;
  date: string;
  event: string | null;
  plan: string | null;
  status: string;
}

export interface ContributionAdminListFilters {
  name?: string;
  event?: number | '';
  plan?: number | '';
  status?: string;
  date_from?: string;
  date_to?: string;
}

export const CONTRIBUTION_ADMIN_LIST_PAGE_SIZE = 20;

export function useContributionAdminList(
  token: string | null, page: number, filters: ContributionAdminListFilters,
) {
  const [results, setResults] = useState<ContributionAdminListItem[]>([]);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const { name = '', event = '', plan = '', status = '', date_from = '', date_to = '' } = filters;

  const fetchPage = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (name)      params.set('name',      name);
      if (event)     params.set('event',     String(event));
      if (plan)      params.set('plan',      String(plan));
      if (status)    params.set('status',    status);
      if (date_from) params.set('date_from', date_from);
      if (date_to)   params.set('date_to',   date_to);

      const res = await authFetch(`${BASE}?${params}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setResults(data.results);
      setCount(data.count);
    } catch {
      setError('Failed to load contributions.');
    } finally {
      setLoading(false);
    }
  }, [token, page, name, event, plan, status, date_from, date_to]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const totalPages = Math.ceil(count / CONTRIBUTION_ADMIN_LIST_PAGE_SIZE);

  return { results, count, totalPages, loading, error, refetch: fetchPage };
}
