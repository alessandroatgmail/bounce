import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEvents, type EventItem } from '../hooks/useEvents';
import { useFestivalDays, type FestivalDay, type FestivalRoom } from '../hooks/useFestivalDays';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

// ── Grid constants ────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64;
const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60;
const TIME_COL_W = 52;
const ROOM_COL_W = 160;

function formatDate(dateStr: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts);
}

function eventMinutes(iso: string) {
  return parseInt(iso.slice(11, 13), 10) * 60 + parseInt(iso.slice(14, 16), 10);
}

function eventsOverlap(a: EventItem, b: EventItem): boolean {
  return new Date(a.start_date).getTime() < new Date(b.end_date).getTime()
    && new Date(a.end_date).getTime() > new Date(b.start_date).getTime();
}

function computeDayBounds(dayEvents: EventItem[]) {
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
  blockedEventIds,
  canSelectMore,
  onToggleEvent,
}: {
  day: FestivalDay;
  dayEvents: EventItem[];
  selectedEventIds: Set<number>;
  blockedEventIds: Set<number>;
  canSelectMore: boolean;
  onToggleEvent: (id: number) => void;
}) {
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
    return <p className="text-sm text-gray-400 py-8 text-center">No rooms assigned to this day.</p>;
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

                const isSelected = selectedEventIds.has(ev.id);
                const isDisabled = !isSelected && (!canSelectMore || blockedEventIds.has(ev.id));

                return (
                  <div
                    key={ev.id}
                    onClick={() => !isDisabled && onToggleEvent(ev.id)}
                    className={[
                      'absolute left-1 right-1 rounded text-white text-xs px-1.5 py-1 overflow-hidden shadow-sm z-10 transition-all',
                      isDisabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer hover:brightness-110 active:scale-[0.98]',
                      isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent brightness-110' : '',
                    ].join(' ')}
                    style={{ top, height, backgroundColor: ev.color ?? '#e67e22' }}
                  >
                    {isSelected && (
                      <CheckCircle className="absolute top-1 right-1 size-3 text-white drop-shadow" />
                    )}
                    <div className="font-medium truncate leading-tight pr-4">{ev.name}</div>
                    <div className="opacity-80 text-[10px]">
                      {ev.start_date.slice(11, 16)}–{ev.end_date.slice(11, 16)}
                    </div>
                    {ev.level && (
                      <div className="opacity-75 text-[10px] truncate">{ev.level.name}</div>
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

// ── Registration panel (controlled) ──────────────────────────────────────────

function RegistrationPanel({
  festival,
  accessToken,
  selectedMembershipId,
  onMembershipChange,
  selectedRoleId,
  onRoleChange,
}: {
  festival: EventItem;
  accessToken: string | null;
  selectedMembershipId: string;
  onMembershipChange: (v: string) => void;
  selectedRoleId: string;
  onRoleChange: (v: string) => void;
}) {
  const hasRoles = festival.event_type.partners > 0 && festival.event_type.partner_roles.length > 0;
  const hasMemberships = festival.memberships.length > 0;

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const canRegister =
    (!hasMemberships || !!selectedMembershipId) &&
    (!hasRoles || !!selectedRoleId);

  const handleRegister = async () => {
    if (!accessToken) return;
    setStatus('loading');
    try {
      const body: Record<string, unknown> = { event_id: festival.id };
      if (selectedMembershipId) body.membership_id = Number(selectedMembershipId);
      if (selectedRoleId) body.role_id = Number(selectedRoleId);
      const res = await fetch('/api/booking/my-memberships/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (festival.already_booked || status === 'success') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
        <CheckCircle className="size-4 text-green-600 flex-shrink-0" />
        {festival.already_booked ? 'You are already registered for this festival.' : 'Successfully registered!'}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
      <h2 className="text-sm font-semibold text-[#2b2b2b] uppercase tracking-wide">Registration</h2>
      <div className="flex flex-wrap gap-3 items-end">
        {hasMemberships && (
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500">Membership</label>
            <Select value={selectedMembershipId} onValueChange={onMembershipChange}>
              <SelectTrigger className="min-w-48">
                <SelectValue placeholder="Select membership…" />
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
            <label className="text-xs text-gray-500">Role</label>
            <Select value={selectedRoleId} onValueChange={onRoleChange}>
              <SelectTrigger className="min-w-40">
                <SelectValue placeholder="Select role…" />
              </SelectTrigger>
              <SelectContent>
                {festival.event_type.partner_roles.map(r => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                ))}
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
          Register
        </Button>
      </div>
      {status === 'error' && (
        <p className="text-sm text-red-600 flex items-center gap-1.5">
          <AlertCircle className="size-4 flex-shrink-0" />
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function FestivalSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { events, loading: loadingEvents } = useEvents(accessToken);

  const festivalId = id ? Number(id) : null;
  const { days, loading: loadingDays } = useFestivalDays(accessToken, festivalId);

  const [openDays, setOpenDays] = useState<Set<number>>(new Set());
  const initializedRef = useRef(false);

  // Selection state
  const [selectedMembershipId, setSelectedMembershipId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());

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
  }, [selectedMembershipId]);

  const festival = useMemo(() => events.find(e => e.id === festivalId) ?? null, [events, festivalId]);

  const childEvents = useMemo(() => {
    if (!festival) return [];
    const ids = new Set(festival.events);
    return events.filter(e => ids.has(e.id));
  }, [events, festival]);

  // Events that conflict in time with any currently selected event
  const blockedEventIds = useMemo(() => {
    const selectedEvents = childEvents.filter(e => selectedEventIds.has(e.id));
    const blocked = new Set<number>();
    for (const ev of childEvents) {
      if (selectedEventIds.has(ev.id)) continue;
      if (selectedEvents.some(sel => eventsOverlap(ev, sel))) blocked.add(ev.id);
    }
    return blocked;
  }, [childEvents, selectedEventIds]);

  // Derive max_events from the selected membership (null = unlimited)
  const selectedMembership = useMemo(
    () => festival?.memberships.find(m => String(m.id) === selectedMembershipId) ?? null,
    [festival, selectedMembershipId],
  );
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

  const toggleEvent = (eventId: number) =>
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else if (canSelectMore && !blockedEventIds.has(eventId)) {
        next.add(eventId);
      }
      return next;
    });

  if (loadingEvents || loadingDays) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-[#e67e22]" />
      </div>
    );
  }

  if (!festival) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-gray-500">
        Festival not found.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#2b2b2b]">{festival.name}</h1>
          <p className="text-sm text-gray-500">
            {formatDate(festival.start_date, { day: 'numeric', month: 'long', year: 'numeric' })}
            {' – '}
            {formatDate(festival.end_date, { day: 'numeric', month: 'long', year: 'numeric' })}
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
      />

      {/* Event selection counter */}
      {showCounter && maxEvents !== null && (
        <div className="flex items-center gap-3 px-4 py-3 border rounded-lg bg-white">
          <span className="text-sm text-gray-600">Events selected:</span>
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
            <span className="text-xs text-amber-600 font-medium">Max reached — deselect to change</span>
          )}
        </div>
      )}

      {/* Days accordion */}
      {days.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No schedule available yet.</p>
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
                      {formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                    <span className="text-sm text-gray-400">
                      {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                    </span>
                    {daySelected > 0 && (
                      <span className="text-xs font-medium text-[#e67e22]">
                        {daySelected} selected
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
