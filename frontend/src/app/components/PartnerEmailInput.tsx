import { useEffect, useState } from 'react';
import { Loader2, UserCheck, UserX } from 'lucide-react';
import { Input } from './ui/input';

/** True when an email was typed but never resolved to a partner id (not
 * found, or the lookup hasn't finished yet) — callers check this before
 * submitting instead of round-tripping to the API to find out. */
export function partnerEmailUnresolved(email: string, partnerId: number | null): boolean {
  return email.trim().length > 0 && partnerId === null;
}

/** Looks up an email against /api/auth/check-email/ (active, registered
 * users only) and reports the resolved partner id back to the caller —
 * shared by every booking flow that lets a student name a partner. */
export function PartnerEmailInput({
  value,
  onChange,
  onResolved,
  accessToken,
  language,
  inputClassName = '',
}: {
  value: string;
  onChange: (email: string) => void;
  onResolved: (partnerId: number | null) => void;
  accessToken: string | null;
  language: string;
  inputClassName?: string;
}) {
  const it = language === 'it';
  const [status, setStatus] = useState<'idle' | 'checking' | 'found' | 'not_found'>('idle');
  const [name, setName] = useState('');

  useEffect(() => {
    const email = value.trim();
    if (!email || !email.includes('@')) {
      setStatus('idle');
      setName('');
      onResolved(null);
      return;
    }
    setStatus('checking');
    setName('');
    onResolved(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-email/?email=${encodeURIComponent(email)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setName(`${data.first_name} ${data.last_name}`.trim());
          setStatus('found');
          onResolved(data.id);
        } else {
          setStatus('not_found');
          onResolved(null);
        }
      } catch {
        setStatus('not_found');
        onResolved(null);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, accessToken]);

  return (
    <div>
      <div className="relative">
        <Input
          type="email"
          placeholder={it ? 'email@esempio.com' : 'email@example.com'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`pr-8 ${inputClassName}`}
        />
        {status === 'checking' && <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-gray-400" />}
        {status === 'found' && <UserCheck className="absolute right-2 top-2.5 size-4 text-green-600" />}
        {status === 'not_found' && <UserX className="absolute right-2 top-2.5 size-4 text-red-400" />}
      </div>
      {status === 'found' && name && (
        <p className="text-xs text-green-700 flex items-center gap-1 mt-1">
          <UserCheck className="size-3" /> {name}
        </p>
      )}
      {status === 'not_found' && (
        <p className="text-xs text-red-600 mt-1">
          {it
            ? 'Utente non trovato. Il partner deve avere già un account registrato e attivo.'
            : 'User not found. The partner must already have a registered, activated account.'}
        </p>
      )}
    </div>
  );
}
