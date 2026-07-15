import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ClipboardList,
  Link2,
  Loader2,
  Lock,
  Plus,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { authFetch } from '../../lib/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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

interface UserSearchResult {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

/** A cell position in the register grid. */
interface CellRef {
  row: number;
  role: string;
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
  const [consolidateResult, setConsolidateResult] = useState<{ created: number; deleted: number } | null>(null);

  // Grid editing (parent events only): pick a member, then a destination
  // cell to swap them; couples booked together stay locked on their row.
  const [moveSource, setMoveSource] = useState<CellRef | null>(null);
  const [addTarget, setAddTarget] = useState<CellRef | null>(null);
  // Adds/removes are persisted immediately through the staff bookings
  // API; only swaps/moves still need a consolidate to be saved.
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // PartnerRole name → pk, needed to write the Booking role FKs.
  const [partnerRoleIds, setPartnerRoleIds] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const canEdit = !!data?.parent;

  // Partners known only by email (no account) cannot be booked:
  // consolidation is blocked until they register or are removed.
  const hasUnregisteredPartner = useMemo(
    () =>
      (data?.rows ?? []).some(row =>
        Object.values(row.members).some(member => member !== null && member.id === null),
      ),
    [data],
  );

  const userIdsInGrid = useMemo(() => {
    const ids = new Set<number>();
    for (const row of data?.rows ?? []) {
      for (const member of Object.values(row.members)) {
        if (member?.id != null) ids.add(member.id);
      }
    }
    return ids;
  }, [data]);

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
      setMoveSource(null);
      setDirty(false);
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

  // Partner role ids, needed when writing bookings (role/partner_role FKs).
  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const response = await authFetch('/api/events/partner-roles/', accessToken);
        if (!response.ok) return;
        const json = await response.json();
        const roles: { id: number; name: string }[] = json.results ?? json;
        setPartnerRoleIds(Object.fromEntries(roles.map(role => [role.name, role.id])));
      } catch {
        // Bookings will be written without a role.
      }
    })();
  }, [accessToken]);

  // User search for the "add user to a cell" dialog.
  useEffect(() => {
    if (addTarget === null || !accessToken) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await authFetch(
          `/api/auth/users/?name=${encodeURIComponent(searchQuery)}&page_size=20`,
          accessToken,
        );
        if (response.ok) {
          const json = await response.json();
          setSearchResults(json.results ?? []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [addTarget, searchQuery, accessToken]);

  // markDirty=false for edits already persisted through the bookings API.
  const withClonedRows = (mutate: (rows: RegisterRow[]) => void, markDirty = true) => {
    setData(prev => {
      if (!prev) return prev;
      const rows = prev.rows.map(row => ({ ...row, members: { ...row.members } }));
      mutate(rows);
      return { ...prev, rows };
    });
    if (markDirty) setDirty(true);
  };

  /** The other occupied cell of a row: [roleName, member] or null. */
  const mateOf = (row: RegisterRow | undefined, role: string) =>
    Object.entries(row?.members ?? {}).find(
      ([mateRole, member]) => mateRole !== role && member !== null,
    ) ?? null;

  /** Resolve a user's Booking for this event through the staff bookings API. */
  const findBooking = async (userId: number): Promise<{ id: number } | null> => {
    const response = await authFetch(
      `/api/booking/bookings/?user=${userId}&event=${eventId}`,
      accessToken!,
    );
    if (!response.ok) throw new Error(`${response.status}`);
    const bookings = await response.json();
    return bookings[0] ?? null;
  };

  const swapCells = (a: CellRef, b: CellRef) => {
    withClonedRows(rows => {
      const first = rows[a.row].members[a.role] ?? null;
      rows[a.row].members[a.role] = rows[b.row].members[b.role] ?? null;
      rows[b.row].members[b.role] = first;
    });
    setMoveSource(null);
  };

  const addRow = () => {
    setData(prev => {
      if (!prev) return prev;
      const members = Object.fromEntries(prev.roles.map(role => [role, null]));
      return { ...prev, rows: [...prev.rows, { couple: false, members }] };
    });
  };

  // Adding a user (no contribution needed) books them directly through
  // the staff bookings API. When the row already holds a mate (e.g. a
  // follower waiting for a leader), the new booking carries the mate as
  // partner AND the mate's booking is updated to point back at the new
  // user.
  const insertUser = async (found: UserSearchResult) => {
    if (!addTarget || !accessToken || !eventId || !data || mutating) return;
    const target = addTarget;
    const [mateRole, mate] = mateOf(data.rows[target.row], target.role) ?? [null, null];

    setMutating(true);
    setActionError(null);
    try {
      const createRes = await authFetch('/api/booking/bookings/', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          user: found.id,
          event: Number(eventId),
          role: partnerRoleIds[target.role] ?? null,
          partner: mate?.id ?? null,
          partner_email: mate?.email ?? null,
          partner_role: mateRole ? partnerRoleIds[mateRole] ?? null : null,
        }),
      });
      if (!createRes.ok) throw new Error(`${createRes.status}`);

      if (mate?.id != null) {
        const mateBooking = await findBooking(mate.id);
        if (mateBooking) {
          const patchRes = await authFetch(
            `/api/booking/bookings/${mateBooking.id}/`,
            accessToken,
            {
              method: 'PATCH',
              body: JSON.stringify({
                partner: found.id,
                partner_email: found.email,
                partner_role: partnerRoleIds[target.role] ?? null,
              }),
            },
          );
          if (!patchRes.ok) throw new Error(`${patchRes.status}`);
        }
      }

      withClonedRows(rows => {
        rows[target.row].members[target.role] = {
          id: found.id,
          email: found.email,
          first_name: found.first_name,
          last_name: found.last_name,
          status: null,
          contribution_id: null,
        };
      }, false);
      setAddTarget(null);
      setSearchQuery('');
    } catch {
      setActionError(
        language === 'it'
          ? "Errore durante l'aggiunta dell'utente al registro."
          : 'Failed to add the user to the register.',
      );
      await fetchRegister();
    } finally {
      setMutating(false);
    }
  };

  // Removing a member deletes their booking; the row mate keeps theirs
  // but no longer points at the removed user.
  const removeMember = async (cell: CellRef) => {
    if (!accessToken || !eventId || !data || mutating) return;
    const member = data.rows[cell.row]?.members[cell.role];
    if (!member || member.id === null || member.status === 'payed') return;
    const [, mate] = mateOf(data.rows[cell.row], cell.role) ?? [null, null];

    setMutating(true);
    setActionError(null);
    try {
      const booking = await findBooking(member.id);
      if (booking) {
        const deleteRes = await authFetch(
          `/api/booking/bookings/${booking.id}/`,
          accessToken,
          { method: 'DELETE' },
        );
        if (!deleteRes.ok) throw new Error(`${deleteRes.status}`);
      }
      if (mate?.id != null) {
        const mateBooking = await findBooking(mate.id);
        if (mateBooking) {
          const patchRes = await authFetch(
            `/api/booking/bookings/${mateBooking.id}/`,
            accessToken,
            {
              method: 'PATCH',
              body: JSON.stringify({
                partner: null,
                partner_email: null,
                partner_role: null,
              }),
            },
          );
          if (!patchRes.ok) throw new Error(`${patchRes.status}`);
        }
      }
      withClonedRows(rows => {
        rows[cell.row].members[cell.role] = null;
      }, false);
      setMoveSource(null);
    } catch {
      setActionError(
        language === 'it'
          ? "Errore durante la rimozione dell'utente dal registro."
          : 'Failed to remove the user from the register.',
      );
      await fetchRegister();
    } finally {
      setMutating(false);
    }
  };

  const consolidate = async () => {
    if (!accessToken || !eventId || !data || hasUnregisteredPartner) return;
    setConsolidating(true);
    setConsolidateError(null);
    setConsolidateResult(null);
    try {
      // Consolidation rebuilds the children events' bookings from the
      // parent's (always up-to-date) bookings; no payload needed.
      const response = await authFetch(`/api/events/register/${eventId}/`, accessToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const result = await response.json();
      setConsolidateResult({ created: result.created, deleted: result.deleted });
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

  const isSource = (cell: CellRef) =>
    moveSource !== null && moveSource.row === cell.row && moveSource.role === cell.role;

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
            <div className="flex items-center gap-3">
              {dirty && (
                <span className="text-sm text-amber-700">
                  {language === 'it'
                    ? 'Modifiche non salvate — consolida per salvarle'
                    : 'Unsaved changes — consolidate to save them'}
                </span>
              )}
              <Button
                className="bg-[#e67e22] hover:bg-[#d35400] text-white"
                onClick={consolidate}
                disabled={consolidating || loading || hasUnregisteredPartner}
              >
                {consolidating && <Loader2 className="size-4 animate-spin" />}
                {language === 'it' ? 'Consolida' : 'Consolidate'}
              </Button>
            </div>
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

        {actionError && (
          <p role="alert" className="text-sm text-red-600 mb-6">{actionError}</p>
        )}

        {consolidateResult && (
          <p className="text-sm text-green-700 mb-6">
            {language === 'it'
              ? `Registro consolidato: ${consolidateResult.created} presenze create sui sotto-eventi, ${consolidateResult.deleted} precedenti eliminate.`
              : `Register consolidated: ${consolidateResult.created} bookings created on the children events, ${consolidateResult.deleted} previous ones deleted.`}
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
              <>
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
                            <span className="flex items-center gap-1">
                              <Link2
                                className="size-4 text-[#e67e22]"
                                aria-label={language === 'it' ? 'Coppia' : 'Couple'}
                              />
                              {canEdit && (
                                <Lock
                                  className="size-3 text-gray-400"
                                  aria-label={
                                    language === 'it'
                                      ? 'Le coppie non possono essere separate'
                                      : 'Couples cannot be split'
                                  }
                                />
                              )}
                            </span>
                          )}
                        </TableCell>
                        {data.roles.map(role => {
                          const cell: CellRef = { row: index, role };
                          const member = row.members[role] ?? null;
                          const editable = canEdit && !row.couple;
                          return (
                            <TableCell key={role} className="align-top">
                              <div className="flex items-start justify-between gap-2">
                                <MemberCell
                                  member={member}
                                  language={language}
                                  showAttended={!data.parent && data.consolidated}
                                />
                                {editable && (
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    {member && (
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className={
                                            isSource(cell)
                                              ? 'text-white bg-[#e67e22] hover:bg-[#d35400] hover:text-white'
                                              : 'text-gray-400 hover:text-[#e67e22]'
                                          }
                                          title={language === 'it' ? 'Sposta' : 'Move'}
                                          onClick={() =>
                                            setMoveSource(isSource(cell) ? null : cell)
                                          }
                                        >
                                          <ArrowLeftRight className="size-4" />
                                        </Button>
                                        {member.id !== null && member.status !== 'payed' && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-gray-400 hover:text-red-600"
                                            title={language === 'it' ? 'Rimuovi' : 'Remove'}
                                            disabled={mutating}
                                            onClick={() => removeMember(cell)}
                                          >
                                            <X className="size-4" />
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                    {moveSource && !isSource(cell) && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => swapCells(moveSource, cell)}
                                      >
                                        {member
                                          ? language === 'it' ? 'Scambia' : 'Swap'
                                          : language === 'it' ? 'Sposta qui' : 'Move here'}
                                      </Button>
                                    )}
                                    {!member && !moveSource && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-gray-400 hover:text-[#e67e22]"
                                        title={language === 'it' ? 'Aggiungi utente' : 'Add user'}
                                        onClick={() => {
                                          setSearchQuery('');
                                          setSearchResults([]);
                                          setAddTarget(cell);
                                        }}
                                      >
                                        <UserPlus className="size-4" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
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
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 flex items-center gap-1"
                    onClick={addRow}
                  >
                    <Plus className="size-4" />
                    {language === 'it' ? 'Aggiungi riga' : 'Add row'}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={addTarget !== null}
          onOpenChange={open => { if (!open) setAddTarget(null); }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {language === 'it' ? 'Aggiungi utente al registro' : 'Add user to the register'}
              </DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              placeholder={language === 'it' ? 'Cerca per nome…' : 'Search by name…'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
              {searching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!searching && searchResults.filter(u => !userIdsInGrid.has(u.id)).length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  {language === 'it' ? 'Nessun utente trovato.' : 'No users found.'}
                </p>
              )}
              {!searching &&
                searchResults
                  .filter(u => !userIdsInGrid.has(u.id))
                  .map(found => (
                    <button
                      key={found.id}
                      type="button"
                      className="flex flex-col items-start rounded-md px-3 py-2 text-left hover:bg-gray-100 disabled:opacity-50"
                      disabled={mutating}
                      onClick={() => insertUser(found)}
                    >
                      <span className="text-sm font-medium">
                        {found.first_name} {found.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">{found.email}</span>
                    </button>
                  ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
