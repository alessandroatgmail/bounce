import { useState, useRef } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEvents, type EventItem, type EventPayload } from '../hooks/useEvents';
import { useEventTypes } from '../hooks/useEventTypes';
import { useArtists } from '../hooks/useArtists';
import { useGenres } from '../hooks/useGenres';
import { useStyles } from '../hooks/useStyles';
import { useFestivalDays, type FestivalDay, type FestivalRoom } from '../hooks/useFestivalDays';
import { MultiSearchSelect } from './MultiSearchSelect';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { authFetch } from '../../lib/api';

// ── Grid constants ────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64;            // px per hour
const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 25;           // 01:00 next day
const DAY_START_MIN = DAY_START_HOUR * 60;
const DAY_END_MIN = DAY_END_HOUR * 60;
const TOTAL_MINUTES = DAY_END_MIN - DAY_START_MIN;
const GRID_HEIGHT = TOTAL_MINUTES * PIXELS_PER_MINUTE;
const TIME_COL_W = 56;
const ROOM_COL_W = 180;

const TIME_LABELS: { minutes: number; label: string }[] = [];
for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 30) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  TIME_LABELS.push({ minutes: m, label: `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}` });
}

function minutesToTop(totalMinutes: number) {
  return (totalMinutes - DAY_START_MIN) * PIXELS_PER_MINUTE;
}

function formatTime(iso: string) {
  return iso.slice(11, 16);
}

function eventMinutes(iso: string) {
  return parseInt(iso.slice(11, 13), 10) * 60 + parseInt(iso.slice(14, 16), 10);
}

// Parse YYYY-MM-DD without timezone conversion
function formatDate(dateStr: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts);
}

// ── Add-event mini form ───────────────────────────────────────────────────────

interface AddSlot {
  room: FestivalRoom;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM
}

function EventSlotDialog({
  slot,
  editEvent,
  festival,
  onClose,
  onSaved,
}: {
  slot?: AddSlot;
  editEvent?: EventItem;
  festival: EventItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { accessToken } = useAuth();
  const { eventTypes, loading: loadingTypes } = useEventTypes(accessToken);
  const { artists, loading: loadingArtists } = useArtists(accessToken);
  const { genres, loading: loadingGenres } = useGenres(accessToken);
  const { styles, loading: loadingStyles } = useStyles(accessToken);

  const isEdit = !!editEvent;

  const [name, setName] = useState(editEvent?.name ?? '');
  const [eventTypeId, setEventTypeId] = useState(editEvent?.event_type.id.toString() ?? '');
  const [status, setStatus] = useState(editEvent?.status ?? 'draft');
  const [startTime, setStartTime] = useState(
    editEvent ? formatTime(editEvent.start_date) : (slot?.startTime ?? '')
  );
  const [endTime, setEndTime] = useState(editEvent ? formatTime(editEvent.end_date) : '');
  const [capacity, setCapacity] = useState(editEvent?.capacity.toString() ?? '');
  const [color, setColor] = useState(editEvent?.color ?? '#e67e22');
  const [selectedArtists, setSelectedArtists] = useState<{ id: number; name: string }[]>(
    editEvent?.artists.map(a => ({ id: a.id, name: a.full_name })) ?? []
  );
  const [selectedGenres, setSelectedGenres] = useState<{ id: number; name: string }[]>(
    editEvent?.genres ?? []
  );
  const [selectedStyles, setSelectedStyles] = useState<{ id: number; name: string }[]>(
    editEvent?.styles ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = editEvent ? editEvent.start_date.slice(0, 10) : slot!.date;
  const roomId = editEvent ? editEvent.room.id : slot!.room.room.id;
  const roomName = editEvent ? editEvent.room.name : slot!.room.room.name;

  const computeDuration = () => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    const duration = computeDuration();
    if (duration <= 0) { setError('End time must be after start time.'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload: EventPayload = {
        name,
        status,
        event_type_id: Number(eventTypeId),
        type: festival.type,
        start_date: `${date}T${startTime}:00`,
        end_date: `${date}T${endTime}:00`,
        duration,
        room_id: roomId,
        capacity: Number(capacity) || festival.capacity,
        artist_ids: selectedArtists.map(a => a.id),
        genre_ids: selectedGenres.map(g => g.id),
        style_ids: selectedStyles.map(s => s.id),
        color: color || null,
      };

      if (isEdit) {
        const res = await authFetch(`/api/events/events/${editEvent!.id}/`, accessToken, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(JSON.stringify(body));
        }
      } else {
        const res = await authFetch('/api/events/events/', accessToken, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(JSON.stringify(body));
        }
        const created: EventItem = await res.json();
        const patchRes = await authFetch(`/api/events/events/${festival.id}/`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify({ event_ids: [...festival.events, created.id] }),
        });
        if (!patchRes.ok) throw new Error('Event created but failed to link to festival.');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Event' : 'Add Event'}</DialogTitle>
          <DialogDescription>
            {roomName} · {formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })} · {startTime}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="ae-name">Name *</Label>
            <Input id="ae-name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Event Type *</Label>
            <Select value={eventTypeId} onValueChange={setEventTypeId} disabled={loadingTypes}>
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {eventTypes.map(et => <SelectItem key={et.id} value={et.id.toString()}>{et.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start *</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ae-end">End *</Label>
              <Input id="ae-end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ae-cap">Capacity</Label>
              <Input id="ae-cap" type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder={String(festival.capacity)} />
            </div>
          </div>

          <MultiSearchSelect label="Artists" items={artists.map(a => ({ id: a.id, name: a.full_name }))} selected={selectedArtists} loading={loadingArtists} placeholder="Search artist…" onChange={setSelectedArtists} />
          <MultiSearchSelect label="Genres" items={genres} selected={selectedGenres} loading={loadingGenres} placeholder="Search genre…" onChange={setSelectedGenres} />
          <MultiSearchSelect label="Styles" items={styles} selected={selectedStyles} loading={loadingStyles} placeholder="Search style…" onChange={setSelectedStyles} />

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={color ?? '#e67e22'} onChange={e => setColor(e.target.value)} className="h-8 w-12 rounded border cursor-pointer p-0.5" />
              <Input value={color ?? ''} onChange={e => setColor(e.target.value || null as any)} placeholder="#rrggbb" className="flex-1 h-8 text-sm" />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving || !eventTypeId}>
              {saving && <Loader2 className="size-3 mr-1 animate-spin" />}Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Single room column ────────────────────────────────────────────────────────

function RoomColumn({
  festivalRoom,
  dayDate,
  dayEvents,
  onSlotClick,
  onEventClick,
  onEventDrop,
}: {
  festivalRoom: FestivalRoom;
  dayDate: string;
  dayEvents: EventItem[];
  onSlotClick: (slot: AddSlot) => void;
  onEventClick: (event: EventItem) => void;
  onEventDrop: (eventId: number, room: FestivalRoom, date: string, startMin: number) => void;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const roomEvents = dayEvents.filter(e => e.room.id === festivalRoom.room.id);

  const yToMinutes = (y: number) =>
    Math.round((y / PIXELS_PER_MINUTE + DAY_START_MIN) / 15) * 15;

  const handleClick = (e: React.MouseEvent) => {
    if (!colRef.current) return;
    const rect = colRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + colRef.current.scrollTop;
    const minutes = Math.floor(y / PIXELS_PER_MINUTE / 30) * 30 + DAY_START_MIN;
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    onSlotClick({
      room: festivalRoom,
      date: dayDate,
      startTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!colRef.current) return;
    const eventId = Number(e.dataTransfer.getData('eventId'));
    const offsetY = Number(e.dataTransfer.getData('offsetY'));
    const rect = colRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + colRef.current.scrollTop - offsetY;
    const startMin = Math.max(DAY_START_MIN, Math.min(yToMinutes(y), DAY_END_MIN - 15));
    onEventDrop(eventId, festivalRoom, dayDate, startMin);
  };

  return (
    <div
      ref={colRef}
      className={`relative border-l border-gray-100 cursor-crosshair select-none transition-colors ${dragOver ? 'bg-orange-50' : ''}`}
      style={{ width: ROOM_COL_W, height: GRID_HEIGHT, flexShrink: 0 }}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragEnter={() => setDragOver(true)}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* 30-min grid lines */}
      {TIME_LABELS.map(({ minutes }) => (
        <div
          key={minutes}
          className={`absolute w-full border-t ${minutes % 60 === 0 ? 'border-gray-200' : 'border-gray-100 border-dashed'}`}
          style={{ top: minutesToTop(minutes) }}
        />
      ))}

      {/* Events */}
      {roomEvents.map(ev => {
        const startM = eventMinutes(ev.start_date);
        const endM = eventMinutes(ev.end_date);
        const top = minutesToTop(startM);
        const height = Math.max((endM - startM) * PIXELS_PER_MINUTE, 20);
        return (
          <div
            key={ev.id}
            draggable
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('eventId', String(ev.id));
              const rect = e.currentTarget.getBoundingClientRect();
              e.dataTransfer.setData('offsetY', String(e.clientY - rect.top));
            }}
            className="absolute left-1 right-1 rounded text-white text-xs px-1.5 py-1 overflow-hidden shadow-sm z-10 cursor-grab active:cursor-grabbing hover:opacity-90"
            style={{ top, height, backgroundColor: ev.color ?? '#e67e22' }}
            onClick={e => { e.stopPropagation(); onEventClick(ev); }}
          >
            <div className="font-medium truncate leading-tight">{ev.name}</div>
            <div className="opacity-80 text-[10px]">{formatTime(ev.start_date)}–{formatTime(ev.end_date)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Day grid ──────────────────────────────────────────────────────────────────

function DayGrid({
  day,
  festival,
  allEvents,
  onSlotClick,
  onEventClick,
  onEventDrop,
}: {
  day: FestivalDay;
  festival: EventItem;
  allEvents: EventItem[];
  onSlotClick: (slot: AddSlot) => void;
  onEventClick: (event: EventItem) => void;
  onEventDrop: (eventId: number, room: FestivalRoom, date: string, startMin: number) => void;
}) {
  // Events belonging to this festival that fall on this day
  const festivalEventIds = new Set(festival.events);
  const dayEvents = allEvents.filter(e =>
    festivalEventIds.has(e.id) &&
    e.start_date.slice(0, 10) === day.date
  );

  if (day.rooms.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        No rooms assigned to this day yet.
      </div>
    );
  }

  return (
    <div className="overflow-auto border rounded-lg">
      {/* Header row */}
      <div className="flex sticky top-0 z-20 bg-white border-b">
        <div style={{ width: TIME_COL_W, flexShrink: 0 }} className="border-r" />
        {day.rooms.map(fr => (
          <div
            key={fr.id}
            className="border-l px-2 py-2 text-sm font-medium text-gray-700 bg-gray-50"
            style={{ width: ROOM_COL_W, flexShrink: 0 }}
          >
            {fr.room.name}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex">
        {/* Time labels */}
        <div className="relative border-r" style={{ width: TIME_COL_W, height: GRID_HEIGHT, flexShrink: 0 }}>
          {TIME_LABELS.map(({ minutes, label }) => (
            minutes % 60 === 0 && (
              <div
                key={minutes}
                className="absolute right-2 text-[10px] text-gray-400 leading-none"
                style={{ top: minutesToTop(minutes) - 6 }}
              >
                {label}
              </div>
            )
          ))}
          {/* Half-hour tick marks */}
          {TIME_LABELS.map(({ minutes }) => (
            <div
              key={minutes}
              className={`absolute right-0 ${minutes % 60 === 0 ? 'w-3 border-t border-gray-300' : 'w-1.5 border-t border-gray-200'}`}
              style={{ top: minutesToTop(minutes) }}
            />
          ))}
        </div>

        {/* Room columns */}
        {day.rooms.map(fr => (
          <RoomColumn
            key={fr.id}
            festivalRoom={fr}
            dayDate={day.date}
            dayEvents={dayEvents}
            onSlotClick={onSlotClick}
            onEventClick={onEventClick}
            onEventDrop={onEventDrop}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main FestivalGrid ─────────────────────────────────────────────────────────

export function FestivalGrid({ festival, onBack }: { festival: EventItem; onBack: () => void }) {
  const { accessToken } = useAuth();
  const { days, loading: loadingDays } = useFestivalDays(accessToken, festival.id);
  const { events: allEvents, refetch: refetchEvents } = useEvents(accessToken);

  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [addingSlot, setAddingSlot] = useState<AddSlot | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  // Keep festival in sync with the live events list so festival.events reflects newly added children
  const liveFestival = allEvents.find(e => e.id === festival.id) ?? festival;

  const selectedDay = days.find(d => d.id === selectedDayId) ?? days[0] ?? null;

  const formatDayLabel = (date: string) =>
    formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' });

  const handleSaved = () => {
    setAddingSlot(null);
    setEditingEvent(null);
    refetchEvents();
  };

  const handleEventDrop = async (
    draggedId: number,
    targetRoom: FestivalRoom,
    targetDate: string,
    newStartMin: number,
  ) => {
    if (!accessToken) return;
    const dragged = allEvents.find(e => e.id === draggedId);
    if (!dragged) return;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const toISO = (date: string, totalMin: number) => {
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      return `${date}T${pad(h)}:${pad(m)}:00`;
    };

    // All other festival events in the target room on the target date, sorted by start
    const festivalIds = new Set(liveFestival.events);
    const siblings = allEvents
      .filter(e => festivalIds.has(e.id) && e.id !== draggedId && e.room.id === targetRoom.room.id && e.start_date.slice(0, 10) === targetDate)
      .map(e => ({ id: e.id, start: eventMinutes(e.start_date), duration: e.duration }))
      .sort((a, b) => a.start - b.start);

    // Build sorted list including the moved event at its new position
    const sorted = [{ id: draggedId, start: newStartMin, duration: dragged.duration }, ...siblings]
      .sort((a, b) => a.start - b.start);

    // Cascade: if event[i] end > event[i+1] start, push event[i+1] down
    const updates = new Map<number, number>(sorted.map(e => [e.id, e.start]));
    for (let i = 0; i < sorted.length - 1; i++) {
      const currStart = updates.get(sorted[i].id)!;
      const currEnd = currStart + sorted[i].duration;
      const nextStart = updates.get(sorted[i + 1].id)!;
      if (nextStart < currEnd) {
        updates.set(sorted[i + 1].id, currEnd);
        sorted[i + 1] = { ...sorted[i + 1], start: currEnd };
      }
    }

    // PUT all changed events in parallel
    await Promise.all(
      Array.from(updates.entries()).map(([id, startMin]) => {
        const ev = id === draggedId ? dragged : allEvents.find(e => e.id === id)!;
        const date = id === draggedId ? targetDate : ev.start_date.slice(0, 10);
        const endMin = startMin + ev.duration;
        return authFetch(`/api/events/events/${id}/`, accessToken, {
          method: 'PUT',
          body: JSON.stringify({
            name: ev.name,
            status: ev.status,
            event_type_id: ev.event_type.id,
            type: ev.type,
            start_date: toISO(date, startMin),
            end_date: toISO(date, endMin),
            duration: ev.duration,
            room_id: id === draggedId ? targetRoom.room.id : ev.room.id,
            capacity: ev.capacity,
            artist_ids: ev.artists.map(a => a.id),
            genre_ids: ev.genres.map(g => g.id),
            style_ids: ev.styles.map(s => s.id),
            color: ev.color,
          } satisfies EventPayload),
        });
      })
    );

    refetchEvents();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4 mr-1" /> Festivals
          </Button>
          <div>
            <h2 className="font-semibold text-lg text-[#2b2b2b]">{liveFestival.name}</h2>
            <p className="text-xs text-gray-500">
              {formatDate(liveFestival.start_date, { day: 'numeric', month: 'short', year: 'numeric' })}
              {' – '}
              {formatDate(liveFestival.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <Badge variant="outline">{liveFestival.status}</Badge>
      </div>

      {/* Day tabs */}
      {loadingDays ? (
        <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-gray-400" /></div>
      ) : days.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No days configured for this festival.</div>
      ) : (
        <>
          <div className="flex gap-1 border-b">
            {days.map(day => (
              <button
                key={day.id}
                onClick={() => setSelectedDayId(day.id)}
                className={[
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  (selectedDay?.id === day.id)
                    ? 'border-[#e67e22] text-[#e67e22]'
                    : 'border-transparent text-gray-500 hover:text-gray-800',
                ].join(' ')}
              >
                {formatDayLabel(day.date)}
              </button>
            ))}
          </div>

          {selectedDay && (
            <DayGrid
              day={selectedDay}
              festival={liveFestival}
              allEvents={allEvents}
              onSlotClick={setAddingSlot}
              onEventClick={setEditingEvent}
              onEventDrop={handleEventDrop}
            />
          )}
        </>
      )}

      {/* Create event dialog */}
      {addingSlot && (
        <EventSlotDialog
          slot={addingSlot}
          festival={liveFestival}
          onClose={() => setAddingSlot(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Edit event dialog */}
      {editingEvent && (
        <EventSlotDialog
          editEvent={editingEvent}
          festival={liveFestival}
          onClose={() => setEditingEvent(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
