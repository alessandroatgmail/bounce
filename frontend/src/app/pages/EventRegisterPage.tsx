import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, ClipboardList, Link2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { authFetch } from '../../lib/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

interface RegisterMember {
  id: number | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  contribution_id: number | null;
  /** Present only when the grid comes from consolidated Booking records. */
  attended?: boolean;
}

interface RegisterRow {
  couple: boolean;
  members: Record<string, RegisterMember | null>;
}

interface RegisterData {
  event_id: number;
  roles: string[];
  rows: RegisterRow[];
  /** False when the event is a child of another event. */
  parent: boolean;
  /** True when the rows come from Booking records instead of contributions. */
  consolidated: boolean;
}

function MemberCell({
  member,
  language,
  showAttended = false,
}: {
  member: RegisterMember | null;
  language: string;
  /** Children event registers show the (read-only) attendance flag. */
  showAttended?: boolean;
}) {
  if (!member) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Partner known only by email: no account in the system yet.
  if (member.id === null) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm">{member.email}</span>
        <Badge variant="outline" className="w-fit text-amber-700 border-amber-300 bg-amber-50">
          {language === 'it' ? 'Non registrato' : 'Not registered'}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">
        {member.first_name} {member.last_name}
      </span>
      <span className="text-xs text-muted-foreground">{member.email}</span>
      {member.status && member.status !== 'payed' && (
        <Badge variant="outline" className="w-fit text-amber-700 border-amber-300 bg-amber-50">
          {member.status}
        </Badge>
      )}
      {showAttended && member.attended !== undefined && (
        member.attended ? (
          <Badge variant="outline" className="w-fit text-green-700 border-green-300 bg-green-50">
            {language === 'it' ? 'Presente' : 'Present'}
          </Badge>
        ) : (
          <Badge variant="outline" className="w-fit text-gray-500 border-gray-300 bg-gray-50">
            {language === 'it' ? 'Assente' : 'Absent'}
          </Badge>
        )
      )}
    </div>
  );
}

export function EventRegisterPage() {
  const { user, accessToken } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [eventName, setEventName] = useState<string | null>(null);
  const [data, setData] = useState<RegisterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consolidating, setConsolidating] = useState(false);
  const [consolidateError, setConsolidateError] = useState<string | null>(null);
  const [consolidateResult, setConsolidateResult] = useState<{ created: number; updated: number } | null>(null);

  // Partners known only by email (no account) cannot be booked:
  // consolidation is blocked until they register or are removed.
  const hasUnregisteredPartner = useMemo(
    () =>
      (data?.rows ?? []).some(row =>
        Object.values(row.members).some(member => member !== null && member.id === null),
      ),
    [data],
  );

  const fetchRegister = useCallback(async () => {
    if (!accessToken || !eventId) return;
    setLoading(true);
    setError(null);
    try {
      const [registerRes, eventRes] = await Promise.all([
        authFetch(`/api/events/register/${eventId}/`, accessToken),
        authFetch(`/api/events/events/${eventId}/`, accessToken),
      ]);
      if (!registerRes.ok) throw new Error(`${registerRes.status}`);
      setData(await registerRes.json());
      if (eventRes.ok) {
        const event = await eventRes.json();
        setEventName(event.name ?? null);
      }
    } catch {
      setError(
        language === 'it'
          ? 'Errore nel caricamento del registro.'
          : 'Failed to load the register.',
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, eventId, language]);

  useEffect(() => { fetchRegister(); }, [fetchRegister]);

  const consolidate = async () => {
    if (!accessToken || !eventId || !data || hasUnregisteredPartner) return;
    setConsolidating(true);
    setConsolidateError(null);
    setConsolidateResult(null);
    try {
      const response = await authFetch(`/api/events/register/${eventId}/`, accessToken, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const result = await response.json();
      setConsolidateResult({ created: result.created, updated: result.updated });
      // Reload: from now on the grid comes from the Booking records.
      await fetchRegister();
    } catch {
      setConsolidateError(
        language === 'it'
          ? 'Errore durante il consolidamento del registro.'
          : 'Failed to consolidate the register.',
      );
    } finally {
      setConsolidating(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin')}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="size-4" />
          {language === 'it' ? 'Torna agli eventi' : 'Back to events'}
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-6 text-[#e67e22]" />
            <div>
              <h1 className="text-2xl font-bold text-[#2b2b2b]">
                {language === 'it' ? 'Registro Evento' : 'Event Register'}
              </h1>
              {eventName && <p className="text-sm text-gray-600">{eventName}</p>}
            </div>
          </div>
          {data?.parent && (
            <Button
              className="bg-[#e67e22] hover:bg-[#d35400] text-white"
              onClick={consolidate}
              disabled={consolidating || loading || hasUnregisteredPartner}
            >
              {consolidating && <Loader2 className="size-4 animate-spin" />}
              {language === 'it' ? 'Consolida' : 'Consolidate'}
            </Button>
          )}
        </div>

        {data?.parent && hasUnregisteredPartner && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-800"
          >
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>
              {language === 'it'
                ? 'Alcuni partner sono noti solo tramite email e non hanno un account: non è possibile consolidare il registro finché non si registrano.'
                : 'Some partners are known only by email and have no account: the register cannot be consolidated until they sign up.'}
            </span>
          </div>
        )}

        {consolidateError && (
          <p role="alert" className="text-sm text-red-600 mb-6">{consolidateError}</p>
        )}

        {consolidateResult && (
          <p className="text-sm text-green-700 mb-6">
            {language === 'it'
              ? `Registro consolidato: ${consolidateResult.created} presenze create, ${consolidateResult.updated} aggiornate.`
              : `Register consolidated: ${consolidateResult.created} bookings created, ${consolidateResult.updated} updated.`}
          </p>
        )}

        <Card>
          <CardContent className="pt-6">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && <p className="text-sm text-red-600 py-4">{error}</p>}

            {!loading && !error && data && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <span className="sr-only">{language === 'it' ? 'Coppia' : 'Couple'}</span>
                    </TableHead>
                    {data.roles.map(role => (
                      <TableHead key={role}>{role}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {row.couple && (
                          <Link2
                            className="size-4 text-[#e67e22]"
                            aria-label={language === 'it' ? 'Coppia' : 'Couple'}
                          />
                        )}
                      </TableCell>
                      {data.roles.map(role => (
                        <TableCell key={role} className="align-top">
                          <MemberCell
                            member={row.members[role] ?? null}
                            language={language}
                            showAttended={!data.parent && data.consolidated}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {data.rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={data.roles.length + 1}
                        className="text-center text-muted-foreground py-8"
                      >
                        {language === 'it' ? 'Nessun partecipante.' : 'No attendees.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
