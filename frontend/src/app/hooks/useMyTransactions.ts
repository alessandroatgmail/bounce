import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import type { PaymentMethod } from './usePayments';

const BASE = '/api/payments/my-transactions/';

export interface MyTransactionEvent {
  id: number;
  name: string;
}

export interface MyTransactionContribution {
  id: number;
  membership_name: string | null;
  events: MyTransactionEvent[];
}

export interface MyTransaction {
  id: number;
  method: PaymentMethod;
  receipt_number: string;
  amount_total: string;
  currency: string;
  date: string;
  contributions: MyTransactionContribution[];
}

export function useMyTransactions(token: string | null) {
  const [transactions, setTransactions] = useState<MyTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(BASE, token);
      if (!res.ok) throw new Error(`${res.status}`);
      setTransactions(await res.json());
    } catch {
      setError('Failed to load payment history.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { transactions, loading, error, refetch: fetchAll };
}
