import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/payments/transactions/';

export type PaymentMethod = 'stripe' | 'cash' | 'bank';
export type PaymentStatus = 'pending' | 'processing' | 'completed';

export interface TransactionUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface TransactionContributionEvent {
  id: number;
  name: string;
}

export interface TransactionContribution {
  id: number;
  membership_name: string | null;
  events: TransactionContributionEvent[];
  event_name: string | null;
}

export interface Transaction {
  id: number;
  user: TransactionUser;
  method: PaymentMethod;
  status: PaymentStatus;
  receipt_number: string;
  amount_total: string;
  currency: string;
  contributions: TransactionContribution[];
  date: string;
}

export interface TransactionPayload {
  user: number;
  method: 'cash' | 'bank';
  status?: PaymentStatus;
  receipt_number: string;
  amount_total: string;
  currency?: string;
  date?: string;
  contribution_ids?: number[];
}

export interface TransactionFilters {
  eventId?: number | null;
  styleId?: number | null;
  levelId?: number | null;
}

const PAGE_SIZE = 20;

export function usePayments(token: string | null, userId?: number | null, filters: TransactionFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { eventId, styleId, levelId } = filters;

  const load = useCallback(async (p: number) => {
    if (!token) { setTransactions([]); return; }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (userId)  params.set('user',  String(userId));
      if (eventId) params.set('event', String(eventId));
      if (styleId) params.set('style', String(styleId));
      if (levelId) params.set('level', String(levelId));
      const res = await authFetch(`${BASE}?${params.toString()}`, token);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setTransactions(data.results);
      setCount(data.count);
    } catch {
      setError('Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [token, userId, eventId, styleId, levelId]);

  useEffect(() => { setPage(1); }, [userId, eventId, styleId, levelId]);
  useEffect(() => { load(page); }, [page, load]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const refetch = useCallback(() => load(page), [load, page]);

  const create = useCallback(async (data: TransactionPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
    await refetch();
  }, [token, refetch]);

  const update = useCallback(async (id: number, data: TransactionPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(`${BASE}${id}/`, token, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
    await refetch();
  }, [token, refetch]);

  return { transactions, count, page, setPage, totalPages, loading, error, refetch, create, update };
}
