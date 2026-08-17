import { useState, useCallback } from 'react';
import { apiUrl } from '../../lib/api';

const BASE = '/api/events/event-descriptions/';

interface EventDescriptionItem {
  id: number;
  event: number;
  language: string;
  desc: string;
}

export function useEventDescription() {
  const [desc, setDesc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDescription = useCallback(async (eventId: number, language: string) => {
    setLoading(true);
    setError(null);
    setDesc(null);
    try {
      const res = await fetch(apiUrl(`${BASE}?event=${eventId}&language=${language}`));
      if (!res.ok) throw new Error(`${res.status}`);
      const results: EventDescriptionItem[] = await res.json();
      setDesc(results[0]?.desc ?? null);
    } catch {
      setError('Failed to load description.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { desc, loading, error, fetchDescription };
}
