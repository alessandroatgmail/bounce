import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import { apiUrl, authFetch } from '../../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { type EventDetail, type EventSimple } from '../hooks/useEvents';
import { useFestivalDays, type FestivalDay, type FestivalRoom } from '../hooks/useFestivalDays';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { PartnerEmailInput, partnerEmailUnresolved } from '../components/PartnerEmailInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

// Sentinel role value meaning "let me pick a role for each class
// individually" instead of one role applied to every selection.
const FLEXIBLE_ROLE = '__flexible__';

// ── Grid constants ────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64;
const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60;
const TIME_COL_W = 52;
const ROOM_COL_W = 160;

function formatDate(dateStr: string, opts: Intl.DateTimeFormatOptions, locale = 'en-GB') {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, opts);
}

function eventMinutes(iso: string) {
  return parseInt(iso.slice(11, 13), 10) * 60 + parseInt(iso.slice(14, 16), 10);
}

function eventsOverlap(a: EventSimple, b: EventSimple): boolean {
  return new Date(a.start_date).getTime() < new Date(b.end_date).getTime()
    && new Date(a.end_date).getTime() > new Date(b.start_date).getTime();
}

function computeDayBounds(dayEvents: EventSimple[]) {
  if (dayEvents.length === 0) return { startHour: 9, endHour: 22 };
  const startMins = dayEvents.map(e => eventMinutes(e.start_date));
  const endMins = dayEvents.map(e => {
    const m = eventMinutes(e.end_date);
    return e.end_date.slice(0, 10) > e.start_date.slice(0, 10) ? m + 24 * 60 : m;
  });
  const startHour = Math.max(0, Math.floor(Math.min(...startMins) / 60) - 1);
  const endHour = Math.min(28, Math.ceil(Math.max(...endMins) / 60) + 1);
  return { startHour, endHour };
}

// ── Day grid (interactive) ────────────────────────────────────────────────────

function DayScheduleGrid({
  day,
  dayEvents,
  selectedEventIds,
  fixedEventIds,
  blockedEventIds,
  canSelectMore,
  onToggleEvent,
}: {
  day: FestivalDay;
  dayEvents: EventSimple[];
  selectedEventIds: Set<number>;
  fixedEventIds: Set<number>;
  blockedEventIds: Set<number>;
  canSelectMore: boolean;
  onToggleEvent: (id: number) => void;
}) {
  const { t } = useLanguage();
  const { startHour, endHour } = computeDayBounds(dayEvents);
  const startMin = startHour * 60;
  const endMin = endHour * 60;
  const gridHeight = (endMin - startMin) * PIXELS_PER_MINUTE;

  const timeLabels: { minutes: number; label: string }[] = [];
  for (let m = startMin; m <= endMin; m += 30) {
    const h = Math.floor(m / 60) % 24;
    const min = m % 60;
    timeLabels.push({
      minutes: m,
      label: `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
    });
  }

  const minutesToTop = (totalMinutes: number) => (totalMinutes - startMin) * PIXELS_PER_MINUTE;

  if (day.rooms.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">{t('festival.schedule.noRooms')}</p>;
  }

  return (
    <div className="overflow-auto border rounded-lg">
      {/* Room headers */}
      <div className="flex sticky top-0 z-10 bg-white border-b">
        <div style={{ width: TIME_COL_W, flexShrink: 0 }} className="border-r" />
        {day.rooms.map(fr => (
          <div
            key={fr.id}
            className="border-l px-2 py-2 text-sm font-medium text-gray-700 bg-gray-50 text-center"
            style={{ width: ROOM_COL_W, flexShrink: 0 }}
          >
            {fr.room.name}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex">
        {/* Time column */}
        <div className="relative border-r" style={{ width: TIME_COL_W, height: gridHeight, flexShrink: 0 }}>
          {timeLabels.map(({ minutes, label }) =>
            minutes % 60 === 0 && (
              <div
                key={minutes}
                className="absolute right-2 text-[10px] text-gray-400 leading-none"
                style={{ top: minutesToTop(minutes) - 6 }}
              >
                {label}
              </div>
            )
          )}
          {timeLabels.map(({ minutes }) => (
            <div
              key={minutes}
              className={`absolute right-0 ${minutes % 60 === 0 ? 'w-3 border-t border-gray-300' : 'w-1.5 border-t border-gray-200'}`}
              style={{ top: minutesToTop(minutes) }}
            />
          ))}
        </div>

        {/* Room columns */}
        {day.rooms.map((fr: FestivalRoom) => {
          const roomEvents = dayEvents.filter(e => e.room.id === fr.room.id);
          return (
            <div
              key={fr.id}
              className="relative border-l border-gray-100"
              style={{ width: ROOM_COL_W, height: gridHeight, flexShrink: 0 }}
            >
              {timeLabels.map(({ minutes }) => (
                <div
                  key={minutes}
                  className={`absolute w-full border-t ${minutes % 60 === 0 ? 'border-gray-200' : 'border-gray-100 border-dashed'}`}
                  style={{ top: minutesToTop(minutes) }}
                />
              ))}
              {roomEvents.map(ev => {
                const startM = eventMinutes(ev.start_date);
                const rawEndM = eventMinutes(ev.end_date);
                const crossesMidnight = ev.end_date.slice(0, 10) > ev.start_date.slice(0, 10);
                const endM = crossesMidnight ? rawEndM + 24 * 60 : rawEndM;
                const top = minutesToTop(startM);
                const height = Math.max((endM - startM) * PIXELS_PER_MINUTE, 24);

                const isFixed = fixedEventIds.has(ev.id);
                const isSelected = isFixed || selectedEventIds.has(ev.id);
                const isDisabled = !isFixed && !isSelected && (!canSelectMore || blockedEventIds.has(ev.id));

                const tooltip = [
                  ev.name,
                  `${ev.start_date.slice(11, 16)}–${ev.end_date.slice(11, 16)}`,
                  ev.level?.name,
                  ev.artists.length > 0 ? ev.artists.map(a => a.full_name).join(', ') : null,
                ].filter(Boolean).join('\n');

                return (
                  <div
                    key={ev.id}
                    title={tooltip}
                    onClick={() => !isFixed && onToggleEvent(ev.id)}
                    className={[
                      'absolute left-1 right-1 rounded text-white text-xs px-1.5 py-1 overflow-hidden shadow-sm z-10 transition-all',
                      isFixed ? 'cursor-not-allowed' : isDisabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer hover:brightness-110 active:scale-[0.98]',
                      isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent brightness-110' : '',
                    ].join(' ')}
                    style={{ top, height, backgroundColor: ev.color ?? '#e67e22' }}
                  >
                    {isFixed ? (
                      <Lock className="absolute top-1 right-1 size-3 text-white drop-shadow" />
                    ) : isSelected && (
                      <CheckCircle className="absolute top-1 right-1 size-3 text-white drop-shadow" />
                    )}
                    <div className="font-medium truncate leading-tight pr-4">{ev.name}</div>
                    <div className="opacity-80 text-[10px]">
                      {ev.start_date.slice(11, 16)}–{ev.end_date.slice(11, 16)}
                    </div>
                    {ev.level && (
                      <div className="opacity-75 text-[10px] truncate">{ev.level.name}</div>
                    )}
                    {ev.artists.length > 0 && (
                      <div className="opacity-75 text-[10px] truncate">
                        {ev.artists.map(a => a.full_name).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A free-choice festival's children can each have their own event type —
// whether a class needs a role (and which roles) must be read off that
// specific child, never off the parent festival's own event_type, which
// may differ or have none at all.
function eventHasRoles(ev: EventSimple): boolean {
  // Mirrors the backend's own rule exactly (see
  // FreeFestivalEventEntrySerializer.validate()): only partner_roles
  // being defined matters — the separate `partners` count field isn't
  // checked there, and may be 0 on a child event's type even when its
  // partner_roles are set.
  return ev.event_type.partner_roles.length > 0;
}

// ── Registration panel (controlled) ──────────────────────────────────────────

function RegistrationPanel({
  festival,
  accessToken,
  selectedMembershipId,
  onMembershipChange,
  selectedRoleId,
  onRoleChange,
  maxEvents,
  selectedEvents,
  perEventRoleIds,
  onPerEventRoleChange,
  sharedPartner,
  onSharedPartnerChange,
  partnerEmail,
  onPartnerEmailChange,
  partnerId,
  onPartnerIdResolved,
  perEventPartnerEmails,
  onPerEventPartnerEmailChange,
  perEventPartnerIds,
  onPerEventPartnerIdResolved,
  onSuccess,
}: {
  festival: EventDetail;
  accessToken: string | null;
  selectedMembershipId: string;
  onMembershipChange: (v: string) => void;
  selectedRoleId: string;
  onRoleChange: (v: string) => void;
  maxEvents: number | null;
  selectedEvents: EventSimple[];
  perEventRoleIds: Record<number, string>;
  onPerEventRoleChange: (eventId: number, roleId: string) => void;
  sharedPartner: boolean;
  onSharedPartnerChange: (v: boolean) => void;
  partnerEmail: string;
  onPartnerEmailChange: (v: string) => void;
  partnerId: number | null;
  onPartnerIdResolved: (id: number | null) => void;
  perEventPartnerEmails: Record<number, string>;
  onPerEventPartnerEmailChange: (eventId: number, email: string) => void;
  perEventPartnerIds: Record<number, number | null>;
  onPerEventPartnerIdResolved: (eventId: number, id: number | null) => void;
  onSuccess: () => void;
}) {
  const { t, language } = useLanguage();
  // Shown preemptively off the whole festival's children, not just the
  // currently selected ones — otherwise this scaffolding (role picker,
  // "same partner" toggle) would pop in and out as the selection changes.
  const hasRoles = festival.events.some(eventHasRoles);
  // The single role picked once (non-flexible mode) needs a role list too
  // — the union of every selectable child's own roles, since the parent
  // festival's own event_type may not carry any of its own.
  const roleOptions = useMemo(() => {
    const byId = new Map<number, { id: number; name: string }>();
    for (const ev of festival.events) {
      if (!eventHasRoles(ev)) continue;
      for (const r of ev.event_type.partner_roles) byId.set(r.id, r);
    }
    return Array.from(byId.values());
  }, [festival.events]);
  const hasMemberships = festival.memberships.length > 0;
  const isFlexible = selectedRoleId === FLEXIBLE_ROLE;
  const selectedCount = selectedEvents.length;

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  // One consolidated list for the popup, plus a per-event map so the
  // specific offending row can also be flagged in red — both client-side
  // checks (unresolved partner email) and backend-reported errors
  // (already-booked partner, missing role, plan limit, …) feed into the
  // same two pieces of state instead of separate ad-hoc error UIs.
  const [dialogErrors, setDialogErrors] = useState<string[]>([]);
  const [perEventErrors, setPerEventErrors] = useState<Record<number, string>>({});

  const remaining = maxEvents !== null ? maxEvents - selectedCount : null;
  const hasSelectedAll = maxEvents === null || selectedCount >= maxEvents;
  // Only the selected classes that actually have roles need one picked —
  // a roleless class in the mix must never block registration.
  // Already-booked events don't need a role decision here at all — their
  // role was set by the earlier pairing and no picker is shown for them.
  const anySelectedHasRoles = selectedEvents.some(ev => !ev.already_booked && eventHasRoles(ev));
  const allPerEventRolesSet = selectedEvents.every(
    ev => ev.already_booked || !eventHasRoles(ev) || !!perEventRoleIds[ev.id],
  );
  const roleSatisfied = !anySelectedHasRoles || (isFlexible ? allPerEventRolesSet : !!selectedRoleId);
  // Only the rows that actually have something to show — a role picker,
  // a per-class partner input, or an error — so a roleless class doesn't
  // render an empty row next to the ones that do.
  const detailRows = selectedEvents.filter(ev =>
    !!perEventErrors[ev.id]
    || (!ev.already_booked && ((isFlexible && eventHasRoles(ev)) || (hasRoles && !sharedPartner))),
  );

  const canRegister =
    (!hasMemberships || !!selectedMembershipId) &&
    roleSatisfied &&
    hasSelectedAll;

  const handleRegister = async () => {
    if (!accessToken) return;
    setDialogErrors([]);
    setPerEventErrors({});

    // Unresolved partner emails are already known client-side — no point
    // sending a request that the backend would just reject for the same
    // reason, entry by entry.
    const unresolvedEvents = selectedEvents.filter(ev => {
      // Already booked here as someone else's partner — no partner input
      // is ever collected or sent for it (see handleRegister's payload),
      // so it can't be the one with an unresolved email either.
      if (ev.already_booked) return false;
      const email = sharedPartner ? partnerEmail : (perEventPartnerEmails[ev.id] ?? '');
      const id = sharedPartner ? partnerId : (perEventPartnerIds[ev.id] ?? null);
      return partnerEmailUnresolved(email, id);
    });
    if (unresolvedEvents.length > 0) {
      const message = t('festival.registration.partnerEmailNotFound');
      setPerEventErrors(Object.fromEntries(unresolvedEvents.map(ev => [ev.id, message])));
      setDialogErrors(unresolvedEvents.map(ev => `${ev.name}: ${message}`));
      return;
    }

    setStatus('loading');
    try {
      const body: Record<string, unknown> = {
        event_id: festival.id,
        event_ids: selectedEvents.map(ev => {
          // Already booked here as someone else's partner — this slot's
          // role/partner were set by that earlier pairing, not by this
          // registration, so nothing is resubmitted for it. The backend
          // preserves whatever it already has when these come in null.
          if (ev.already_booked) {
            return { event_id: ev.id, role_id: null, partner_id: null, partner_email: '' };
          }
          return {
            event_id: ev.id,
            // A role never applies to a class whose type doesn't define
            // one, regardless of flexible/shared mode.
            role_id: !eventHasRoles(ev) ? null : isFlexible
              ? (perEventRoleIds[ev.id] ? Number(perEventRoleIds[ev.id]) : null)
              : (selectedRoleId ? Number(selectedRoleId) : null),
            partner_id: sharedPartner ? partnerId : (perEventPartnerIds[ev.id] ?? null),
            // Sent alongside partner_id so the backend can still flag a
            // typo'd/unregistered email even if it never resolved to an id.
            partner_email: sharedPartner ? partnerEmail : (perEventPartnerEmails[ev.id] ?? ''),
          };
        }),
      };
      if (selectedMembershipId) body.membership_id = Number(selectedMembershipId);
      const res = await fetch('/api/booking/my-memberships/book-free-festival/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // event_ids comes back as a list positioned the same as the
        // entries we submitted (DRF's list serializer validates each one
        // independently), so index i maps straight onto selectedEvents[i].
        const entryErrors: unknown[] = Array.isArray(data?.event_ids) ? data.event_ids : [];
        const perEvent: Record<number, string> = {};
        const messages: string[] = [];
        entryErrors.forEach((entry, idx) => {
          const event = selectedEvents[idx];
          if (!event || !entry || typeof entry !== 'object') return;
          const texts = Object.values(entry as Record<string, unknown>)
            .flat()
            .map(String);
          if (texts.length === 0) return;
          perEvent[event.id] = texts.join(' ');
          messages.push(`${event.name}: ${texts.join(' ')}`);
        });
        // Anything else (membership_id, a top-level event_id, non_field_errors…)
        // still belongs in the same popup, just without a row to flag.
        Object.entries(data ?? {}).forEach(([key, value]) => {
          if (key === 'event_ids') return;
          const texts = Array.isArray(value) ? value.map(String) : [String(value)];
          messages.push(...texts);
        });
        setPerEventErrors(perEvent);
        setDialogErrors(messages.length > 0 ? messages : [t('festival.registration.error')]);
        setStatus('error');
        return;
      }
      setStatus('success');
      onSuccess();
    } catch {
      setDialogErrors([t('festival.registration.error')]);
      setStatus('error');
    }
  };

  if (festival.already_booked || status === 'success') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
        <CheckCircle className="size-4 text-green-600 flex-shrink-0" />
        {festival.already_booked ? t('festival.registration.alreadyBooked') : t('festival.registration.success')}
      </div>
    );
  }

  return (
    <>
    <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
      <h2 className="text-sm font-semibold text-[#2b2b2b] uppercase tracking-wide">{t('festival.registration.title')}</h2>
      <div className="flex flex-wrap gap-3 items-end">
        {hasMemberships && (
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500">{t('festival.registration.membership')}</label>
            <Select value={selectedMembershipId} onValueChange={onMembershipChange}>
              <SelectTrigger className="min-w-48">
                <SelectValue placeholder={t('festival.registration.selectMembership')} />
              </SelectTrigger>
              <SelectContent>
                {festival.memberships.map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}{m.contribution > 0 ? ` — €${m.contribution}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {hasRoles && (
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500">{t('festival.registration.role')}</label>
            <Select value={selectedRoleId} onValueChange={onRoleChange}>
              <SelectTrigger className="min-w-40">
                <SelectValue placeholder={t('festival.registration.selectRole')} />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map(r => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                ))}
                <SelectItem value={FLEXIBLE_ROLE}>{t('festival.registration.flexibleRole')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          disabled={!canRegister || status === 'loading'}
          onClick={handleRegister}
          className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white disabled:opacity-50"
        >
          {status === 'loading' && <Loader2 className="size-4 animate-spin mr-2" />}
          {t('festival.registration.register')}
        </Button>
      </div>
      {!!selectedMembershipId && remaining !== null && remaining > 0 && (
        <p className="text-xs text-amber-600">
          {language === 'it'
            ? `Seleziona ancora ${remaining} ${remaining === 1 ? 'lezione' : 'lezioni'} per iscriverti`
            : `Select ${remaining} more ${remaining === 1 ? 'event' : 'events'} to register`}
        </p>
      )}
      {hasRoles && (
        <div className="space-y-2 pt-1 border-t mt-2">
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="free-festival-shared-partner"
              checked={sharedPartner}
              onCheckedChange={v => onSharedPartnerChange(v === true)}
            />
            <Label htmlFor="free-festival-shared-partner" className="cursor-pointer font-normal text-sm">
              {t('festival.registration.samePartnerForAll')}
            </Label>
          </div>
          {sharedPartner && (
            <div className="max-w-sm">
              <PartnerEmailInput
                value={partnerEmail}
                onChange={onPartnerEmailChange}
                onResolved={onPartnerIdResolved}
                accessToken={accessToken}
                language={language}
              />
            </div>
          )}
        </div>
      )}
      {/* Fixed role/partner (set once, above) don't need a row here —
          this list only covers what's chosen per event: a flexible role
          and/or a partner that differs per class. It also surfaces,
          regardless of that, which specific class an error (from the
          popup below) belongs to. */}
      {detailRows.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {t('festival.registration.detailsPerClass')}
          </p>
          <div className="space-y-1.5">
            {detailRows.map(ev => (
              <div key={ev.id} className="space-y-1">
                <div className="flex items-center justify-between gap-3 bg-white border rounded-md px-3 py-1.5">
                  <span className="text-sm text-[#2b2b2b] truncate mr-2">
                    {ev.name} — {ev.start_date.slice(11, 16)}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isFlexible && eventHasRoles(ev) && (
                      <Select
                        value={perEventRoleIds[ev.id] ?? ''}
                        onValueChange={v => onPerEventRoleChange(ev.id, v)}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue placeholder={t('festival.registration.selectRole')} />
                        </SelectTrigger>
                        <SelectContent>
                          {ev.event_type.partner_roles.map(r => (
                            <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {hasRoles && !sharedPartner && (
                      <div className="w-44">
                        <PartnerEmailInput
                          value={perEventPartnerEmails[ev.id] ?? ''}
                          onChange={email => onPerEventPartnerEmailChange(ev.id, email)}
                          onResolved={id => onPerEventPartnerIdResolved(ev.id, id)}
                          accessToken={accessToken}
                          language={language}
                        />
                      </div>
                    )}
                  </div>
                </div>
                {perEventErrors[ev.id] && (
                  <p className="text-xs text-red-600 pl-1">{perEventErrors[ev.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    <AlertDialog open={dialogErrors.length > 0} onOpenChange={open => !open && setDialogErrors([])}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="size-5 text-red-500" />
            {t('festival.registration.errorDialogTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <ul className="list-disc pl-5 space-y-1 text-left">
              {dialogErrors.map((message, idx) => <li key={idx}>{message}</li>)}
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setDialogErrors([])}>
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function FestivalSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === 'it' ? 'it-IT' : 'en-GB';

  const festivalId = id ? Number(id) : null;
  const { days, loading: loadingDays } = useFestivalDays(accessToken, festivalId);

  // A single multi-events festival (plus its already-resolved children) via
  // the dedicated detail endpoint — not the whole events table paged in and
  // filtered client-side, which doesn't scale as the table grows.
  const [festival, setFestival] = useState<EventDetail | null>(null);
  const [loadingFestival, setLoadingFestival] = useState(true);

  const fetchFestival = useCallback(async () => {
    if (!festivalId) {
      setFestival(null);
      setLoadingFestival(false);
      return;
    }
    setLoadingFestival(true);
    try {
      const res = accessToken
        ? await authFetch(`/api/events/events/${festivalId}/detail/`, accessToken)
        : await fetch(apiUrl(`/api/events/events/${festivalId}/detail/`));
      if (!res.ok) throw new Error(`${res.status}`);
      setFestival(await res.json());
    } catch {
      setFestival(null);
    } finally {
      setLoadingFestival(false);
    }
  }, [festivalId, accessToken]);

  useEffect(() => { fetchFestival(); }, [fetchFestival]);

  const [openDays, setOpenDays] = useState<Set<number>>(new Set());
  const initializedRef = useRef(false);

  // Selection state
  const [selectedMembershipId, setSelectedMembershipId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
  // Per-class role, only used when selectedRoleId === FLEXIBLE_ROLE.
  const [perEventRoleIds, setPerEventRoleIds] = useState<Record<number, string>>({});
  // Partner: either one partner shared across every chosen event, or one
  // per event — mirrors the role/flexible-role split above.
  const [sharedPartner, setSharedPartner] = useState(true);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [perEventPartnerEmails, setPerEventPartnerEmails] = useState<Record<number, string>>({});
  const [perEventPartnerIds, setPerEventPartnerIds] = useState<Record<number, number | null>>({});

  // Open first day once loaded
  useEffect(() => {
    if (days.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      setOpenDays(new Set([days[0].id]));
    }
  }, [days]);

  // Reset event selection when membership changes
  useEffect(() => {
    setSelectedEventIds(new Set());
    setPerEventRoleIds({});
    setPerEventPartnerEmails({});
    setPerEventPartnerIds({});
  }, [selectedMembershipId]);

  // Already resolved by the detail endpoint — no separate full-table
  // fetch/filter needed to find this festival's children.
  const childEvents = festival?.events ?? [];

  // Events the viewer already has a Booking for — typically because
  // someone else named them as a partner on a free-festival entry, which
  // never gets its own Contribution. Shown pre-selected and locked (like
  // fix_events), but unlike fix_events these DO count toward max_events
  // and DO get resubmitted, so the backend can link them to the real
  // Contribution this registration creates (see
  // FreeFestivalContributionSerializer.create()'s merge-on-existing-row
  // handling).
  const alreadyBookedEventIds = useMemo(
    () => new Set(childEvents.filter(e => e.already_booked).map(e => e.id)),
    [childEvents],
  );

  // Re-add already-booked events after the reset above (same dependency,
  // so this runs right after it) and whenever the festival data itself
  // first reports them — the viewer never gets to start without them.
  useEffect(() => {
    if (alreadyBookedEventIds.size === 0) return;
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      alreadyBookedEventIds.forEach(id => next.add(id));
      return next;
    });
  }, [alreadyBookedEventIds, selectedMembershipId]);

  // Derive max_events from the selected membership (null = unlimited).
  const selectedMembership = useMemo(
    () => festival?.memberships.find(m => String(m.id) === selectedMembershipId) ?? null,
    [festival, selectedMembershipId],
  );

  // fix_events (bundled with the plan, e.g. a festival party) are shown
  // pre-selected and locked — the student can't remove them, and they
  // don't need to be (re)submitted: the backend adds them automatically.
  const fixedEventIds = useMemo(
    () => new Set(selectedMembership?.fix_events.map(e => e.id) ?? []),
    [selectedMembership],
  );
  const fixedChildEvents = useMemo(
    () => childEvents.filter(e => fixedEventIds.has(e.id)),
    [childEvents, fixedEventIds],
  );

  // What the grid renders as locked (Lock icon, not clickable) — both
  // fix_events and already-booked-as-partner events, even though only
  // the latter is part of selectedEventIds/the submitted payload.
  const lockedEventIds = useMemo(
    () => new Set([...fixedEventIds, ...alreadyBookedEventIds]),
    [fixedEventIds, alreadyBookedEventIds],
  );

  const selectedEvents = useMemo(
    () => childEvents.filter(e => selectedEventIds.has(e.id)),
    [childEvents, selectedEventIds],
  );

  // Events that conflict in time with any currently selected OR fixed event
  const blockedEventIds = useMemo(() => {
    const occupying = [...selectedEvents, ...fixedChildEvents];
    const blocked = new Set<number>();
    for (const ev of childEvents) {
      if (selectedEventIds.has(ev.id) || fixedEventIds.has(ev.id)) continue;
      if (occupying.some(sel => eventsOverlap(ev, sel))) blocked.add(ev.id);
    }
    return blocked;
  }, [childEvents, selectedEventIds, selectedEvents, fixedChildEvents, fixedEventIds]);

  // max_events is how many the student picks themselves — fix_events are
  // additional, booked on top, never counted against this number.
  const maxEvents: number | null = selectedMembership?.max_events ?? null;
  const remaining: number | null = maxEvents === null ? null : maxEvents - selectedEventIds.size;
  // Can select more if: unlimited (null), or remaining > 0
  const canSelectMore = remaining === null || remaining > 0;
  // Show the counter only when a membership is chosen (or the festival has no memberships)
  const showCounter = !!selectedMembershipId || (festival?.memberships.length === 0);

  const toggleDay = (dayId: number) =>
    setOpenDays(prev => {
      const next = new Set(prev);
      next.has(dayId) ? next.delete(dayId) : next.add(dayId);
      return next;
    });

  const toggleEvent = (eventId: number) => {
    if (alreadyBookedEventIds.has(eventId)) return;
    if (selectedEventIds.has(eventId)) {
      setSelectedEventIds(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      setPerEventRoleIds(prev => {
        const { [eventId]: _removed, ...rest } = prev;
        return rest;
      });
      setPerEventPartnerEmails(prev => {
        const { [eventId]: _removed, ...rest } = prev;
        return rest;
      });
      setPerEventPartnerIds(prev => {
        const { [eventId]: _removed, ...rest } = prev;
        return rest;
      });
      return;
    }
    if (blockedEventIds.has(eventId)) return;
    if (!canSelectMore) {
      toast.error(t('festival.schedule.maxEventsError'));
      return;
    }
    setSelectedEventIds(prev => new Set(prev).add(eventId));
  };

  const handlePerEventPartnerEmailChange = (eventId: number, email: string) =>
    setPerEventPartnerEmails(prev => ({ ...prev, [eventId]: email }));

  const handlePerEventPartnerIdResolved = (eventId: number, id: number | null) =>
    setPerEventPartnerIds(prev => ({ ...prev, [eventId]: id }));

  const handlePerEventRoleChange = (eventId: number, roleId: string) =>
    setPerEventRoleIds(prev => ({ ...prev, [eventId]: roleId }));

  if (loadingFestival || loadingDays) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-[#e67e22]" />
      </div>
    );
  }

  if (!festival) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-gray-500">
        {t('festival.schedule.notFound')}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4 mr-1" /> {t('festival.schedule.back')}
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#2b2b2b]">{festival.name}</h1>
          <p className="text-sm text-gray-500">
            {formatDate(festival.start_date, { day: 'numeric', month: 'long', year: 'numeric' }, locale)}
            {' – '}
            {formatDate(festival.end_date, { day: 'numeric', month: 'long', year: 'numeric' }, locale)}
          </p>
        </div>
      </div>

      {/* Registration */}
      <RegistrationPanel
        festival={festival}
        accessToken={accessToken}
        selectedMembershipId={selectedMembershipId}
        onMembershipChange={setSelectedMembershipId}
        selectedRoleId={selectedRoleId}
        onRoleChange={setSelectedRoleId}
        maxEvents={maxEvents}
        selectedEvents={selectedEvents}
        perEventRoleIds={perEventRoleIds}
        onPerEventRoleChange={handlePerEventRoleChange}
        sharedPartner={sharedPartner}
        onSharedPartnerChange={setSharedPartner}
        partnerEmail={partnerEmail}
        onPartnerEmailChange={setPartnerEmail}
        partnerId={partnerId}
        onPartnerIdResolved={setPartnerId}
        perEventPartnerEmails={perEventPartnerEmails}
        onPerEventPartnerEmailChange={handlePerEventPartnerEmailChange}
        perEventPartnerIds={perEventPartnerIds}
        onPerEventPartnerIdResolved={handlePerEventPartnerIdResolved}
        onSuccess={() => navigate('/events')}
      />

      {/* Event selection counter */}
      {showCounter && maxEvents !== null && (
        <div className="flex items-center gap-3 px-4 py-3 border rounded-lg bg-white">
          <span className="text-sm text-gray-600">{t('festival.schedule.eventsSelected')}</span>
          <span className="font-semibold text-[#2b2b2b]">
            {selectedEventIds.size} / {maxEvents}
          </span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#e67e22] rounded-full transition-all"
              style={{ width: `${Math.min((selectedEventIds.size / maxEvents) * 100, 100)}%` }}
            />
          </div>
          {remaining === 0 && (
            <span className="text-xs text-amber-600 font-medium">{t('festival.schedule.maxReached')}</span>
          )}
        </div>
      )}

      {/* Days accordion */}
      {days.length === 0 ? (
        <p className="text-center text-gray-400 py-12">{t('festival.schedule.noSchedule')}</p>
      ) : (
        <div className="space-y-3">
          {days.map(day => {
            const dayEvents = childEvents.filter(e => e.start_date.slice(0, 10) === day.date);
            const daySelected = dayEvents.filter(e => selectedEventIds.has(e.id)).length;
            const isOpen = openDays.has(day.id);
            return (
              <div key={day.id} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  onClick={() => toggleDay(day.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[#2b2b2b]">
                      {formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' }, locale)}
                    </span>
                    <span className="text-sm text-gray-400">
                      {dayEvents.length} {dayEvents.length === 1 ? t('festival.schedule.event') : t('festival.schedule.events')}
                    </span>
                    {daySelected > 0 && (
                      <span className="text-xs font-medium text-[#e67e22]">
                        {daySelected} {t('festival.schedule.selected')}
                      </span>
                    )}
                  </div>
                  {isOpen
                    ? <ChevronUp className="size-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="size-4 text-gray-400 flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="p-4">
                    <DayScheduleGrid
                      day={day}
                      dayEvents={dayEvents}
                      selectedEventIds={selectedEventIds}
                      fixedEventIds={lockedEventIds}
                      blockedEventIds={blockedEventIds}
                      canSelectMore={canSelectMore}
                      onToggleEvent={toggleEvent}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
