import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const BASE = '/api/payments/transactions/';

export type PaymentMethod = 'stripe' | 'cash' | 'bank';

export interface TransactionUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface Transaction {
  id: number;
  user: TransactionUser;
  method: PaymentMethod;
  receipt_number: string;
  amount_total: string;
  currency: string;
  contributions: number[];
  date: string;
}

export interface TransactionPayload {
  user: number;
  method: 'cash' | 'bank';
  receipt_number: string;
  amount_total: string;
  currency?: string;
  date?: string;
  contribution_ids?: number[];
}

export function usePayments(token: string | null, userId?: number | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) { setTransactions([]); return; }
    setLoading(true);
    setError(null);
    try {
      const path = userId ? `${BASE}?user=${userId}` : BASE;
      const res = await authFetch(path, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setTransactions(await res.json());
    } catch {
      setError('Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (data: TransactionPayload): Promise<void> => {
    if (!token) return;
    const res = await authFetch(BASE, token, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
    await fetchAll();
  }, [token, fetchAll]);

  return { transactions, loading, error, refetch: fetchAll, create };
}
