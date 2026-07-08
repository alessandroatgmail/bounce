import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ClipboardList, Link2, Loader2 } from 'lucide-react';
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
}

interface RegisterRow {
  couple: boolean;
  members: Record<string, RegisterMember | null>;
}

interface RegisterData {
  event_id: number;
  roles: string[];
  rows: RegisterRow[];
}

function MemberCell({ member, language }: { member: RegisterMember | null; language: string }) {
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
      {member.status !== 'payed' && (
        <Badge variant="outline" className="w-fit text-amber-700 border-amber-300 bg-amber-50">
          {member.status}
        </Badge>
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
          <Button className="bg-[#e67e22] hover:bg-[#d35400] text-white">
            {language === 'it' ? 'Consolida' : 'Consolidate'}
          </Button>
        </div>

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
                          <MemberCell member={row.members[role] ?? null} language={language} />
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
