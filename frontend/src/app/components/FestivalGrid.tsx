import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Loader2, Save, Copy, ClipboardPaste, X, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEvents, type EventItem, type EventPayload } from '../hooks/useEvents';
import { useEventTypes } from '../hooks/useEventTypes';
import { useRooms } from '../hooks/useRooms';
import { useLevels } from '../hooks/useLevels';
import { useArtists } from '../hooks/useArtists';
import { useGenres } from '../hooks/useGenres';
import { useStyles } from '../hooks/useStyles';
import { useFestivalDays, type FestivalDay, type FestivalRoom } from '../hooks/useFestivalDays';
import { MultiSearchSelect } from './MultiSearchSelect';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { authFetch } from '../../lib/api';

// ── Grid constants ────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64;            // px per hour
const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 28;           // 04:00 next day
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

function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
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
  const { levels, loading: loadingLevels } = useLevels(accessToken);
  const { artists, loading: loadingArtists } = useArtists(accessToken);
  const { genres, loading: loadingGenres } = useGenres(accessToken);
  const { styles, loading: loadingStyles } = useStyles(accessToken);

  const isEdit = !!editEvent;

  const [name, setName] = useState(editEvent?.name ?? '');
  const [eventTypeId, setEventTypeId] = useState(editEvent?.event_type.id.toString() ?? '');
  const [levelId, setLevelId] = useState(editEvent?.level?.id.toString() ?? '');
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

  const computeTimings = () => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const crossesMidnight = endMin < startMin;
    const duration = crossesMidnight ? (24 * 60 - startMin) + endMin : endMin - startMin;
    const endDate = crossesMidnight ? addOneDay(date) : date;
    return { duration, endDate };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    const { duration, endDate } = computeTimings();
    if (duration <= 0) { setError('Start and end time cannot be the same.'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload: EventPayload = {
        name,
        status,
        event_type_id: Number(eventTypeId),
        type: festival.type,
        start_date: `${date}T${startTime}:00`,
        end_date: `${endDate}T${endTime}:00`,
        duration,
        room_id: roomId,
        capacity: Number(capacity) || festival.capacity,
        level_id: levelId ? Number(levelId) : null,
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Event Type *</Label>
              <Select value={eventTypeId} onValueChange={setEventTypeId} disabled={loadingTypes}>
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  {eventTypes.map(et => <SelectItem key={et.id} value={et.id.toString()}>{et.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Select value={levelId || 'none'} onValueChange={v => setLevelId(v === 'none' ? '' : v)} disabled={loadingLevels}>
                <SelectTrigger><SelectValue placeholder={loadingLevels ? 'Loading…' : 'None'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {levels.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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

// ── Add-room dialog ───────────────────────────────────────────────────────────

function AddRoomDialog({
  day,
  accessToken,
  onClose,
  onAdded,
}: {
  day: FestivalDay;
  accessToken: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { rooms, loading } = useRooms(accessToken);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingIds = new Set(day.rooms.map(fr => fr.room.id));
  const available = rooms.filter(r => !existingIds.has(r.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/api/festival/festival-rooms/', accessToken, {
        method: 'POST',
        body: JSON.stringify({ festival_day: day.id, room_id: Number(selectedRoomId) }),
      });
      if (!res.ok) throw new Error('Failed to add room.');
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add room.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Add Room</DialogTitle>
          <DialogDescription>
            {formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Room *</Label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId} disabled={loading || available.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? 'Loading…' : available.length === 0 ? 'All rooms already assigned' : 'Select room…'} />
              </SelectTrigger>
              <SelectContent>
                {available.map(r => (
                  <SelectItem key={r.id} value={r.id.toString()}>
                    {r.name} — {r.location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving || !selectedRoomId}>
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
  copiedEvent,
  onSlotClick,
  onEventClick,
  onEventDrop,
  onCopy,
  onPaste,
}: {
  festivalRoom: FestivalRoom;
  dayDate: string;
  dayEvents: EventItem[];
  copiedEvent: EventItem | null;
  onSlotClick: (slot: AddSlot) => void;
  onEventClick: (event: EventItem) => void;
  onEventDrop: (eventId: number, room: FestivalRoom, date: string, startMin: number) => void;
  onCopy: (event: EventItem) => void;
  onPaste: (slot: AddSlot) => void;
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
    const slot: AddSlot = {
      room: festivalRoom,
      date: dayDate,
      startTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
    };
    if (copiedEvent) {
      onPaste(slot);
    } else {
      onSlotClick(slot);
    }
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

  const colCursor = copiedEvent ? 'cursor-copy' : 'cursor-crosshair';

  return (
    <div
      ref={colRef}
      className={`relative border-l border-gray-100 select-none transition-colors ${colCursor} ${dragOver ? 'bg-orange-50' : copiedEvent ? 'bg-amber-50/40' : ''}`}
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
        const rawEndM = eventMinutes(ev.end_date);
        const crossesMidnight = ev.end_date.slice(0, 10) > ev.start_date.slice(0, 10);
        const endM = crossesMidnight ? rawEndM + 24 * 60 : rawEndM;
        const top = minutesToTop(startM);
        const height = Math.max((endM - startM) * PIXELS_PER_MINUTE, 20);
        const isCopied = copiedEvent?.id === ev.id;
        return (
          <div
            key={ev.id}
            draggable={!copiedEvent}
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('eventId', String(ev.id));
              const rect = e.currentTarget.getBoundingClientRect();
              e.dataTransfer.setData('offsetY', String(e.clientY - rect.top));
            }}
            className={`group absolute left-1 right-1 rounded text-white text-xs px-1.5 py-1 overflow-hidden shadow-sm z-10 hover:opacity-90 ${copiedEvent ? 'cursor-copy' : 'cursor-grab active:cursor-grabbing'} ${isCopied ? 'ring-2 ring-white ring-offset-1' : ''}`}
            style={{ top, height, backgroundColor: ev.color ?? '#e67e22' }}
            onClick={e => { e.stopPropagation(); if (!copiedEvent) onEventClick(ev); }}
          >
            <div className="flex items-start gap-1">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate leading-tight">{ev.name}</div>
                <div className="opacity-80 text-[10px]">{formatTime(ev.start_date)}–{formatTime(ev.end_date)}</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onCopy(ev); }}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/25 transition-opacity cursor-copy"
                title="Copy event"
              >
                <Copy className="size-2.5" />
              </button>
            </div>
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
  copiedEvent,
  removingRoomId,
  onSlotClick,
  onEventClick,
  onEventDrop,
  onCopy,
  onPaste,
  onAddRoom,
  onRemoveRoom,
}: {
  day: FestivalDay;
  festival: EventItem;
  allEvents: EventItem[];
  copiedEvent: EventItem | null;
  removingRoomId: number | null;
  onSlotClick: (slot: AddSlot) => void;
  onEventClick: (event: EventItem) => void;
  onEventDrop: (eventId: number, room: FestivalRoom, date: string, startMin: number) => void;
  onCopy: (event: EventItem) => void;
  onPaste: (slot: AddSlot) => void;
  onAddRoom: () => void;
  onRemoveRoom: (fr: FestivalRoom) => void;
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
            className="group border-l px-2 py-2 text-sm font-medium text-gray-700 bg-gray-50 flex items-center justify-between gap-1"
            style={{ width: ROOM_COL_W, flexShrink: 0 }}
          >
            <span className="truncate">{fr.room.name}</span>
            <button
              onClick={() => onRemoveRoom(fr)}
              disabled={removingRoomId === fr.id}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 disabled:opacity-40"
              title="Remove room"
            >
              {removingRoomId === fr.id
                ? <Loader2 className="size-3 animate-spin" />
                : <X className="size-3" />}
            </button>
          </div>
        ))}
        {/* Add room button */}
        <div className="border-l px-2 py-2 bg-gray-50 flex items-center" style={{ flexShrink: 0 }}>
          <button
            onClick={onAddRoom}
            className="text-gray-400 hover:text-[#e67e22] transition-colors"
            title="Add room"
          >
            <Plus className="size-4" />
          </button>
        </div>
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
            copiedEvent={copiedEvent}
            onSlotClick={onSlotClick}
            onEventClick={onEventClick}
            onEventDrop={onEventDrop}
            onCopy={onCopy}
            onPaste={onPaste}
          />
        ))}
      </div>
    </div>
  );
}

// ── Festival info tab ─────────────────────────────────────────────────────────

function FestivalInfoTab({ festival, onSaved }: { festival: EventItem; onSaved: () => void }) {
  const { accessToken } = useAuth();
  const { rooms, loading: loadingRooms } = useRooms(accessToken);
  const { levels, loading: loadingLevels } = useLevels(accessToken);
  const { artists, loading: loadingArtists } = useArtists(accessToken);
  const { genres, loading: loadingGenres } = useGenres(accessToken);
  const { styles, loading: loadingStyles } = useStyles(accessToken);

  const [form, setForm] = useState({
    name:            festival.name,
    status:          festival.status,
    type:            festival.type,
    startDate:       festival.start_date.slice(0, 10),
    startTime:       festival.start_date.slice(11, 16),
    endDate:         festival.end_date.slice(0, 10),
    endTime:         festival.end_date.slice(11, 16),
    duration:        String(festival.duration),
    capacity:        String(festival.capacity),
    roomId:          String(festival.room.id),
    levelId:         festival.level ? String(festival.level.id) : '',
    info:            festival.info ?? '',
    multi_events:    festival.multi_events,
    selectedArtists: festival.artists.map(a => ({ id: a.id, name: a.full_name })),
    selectedGenres:  festival.genres.map(g => ({ id: g.id, name: g.name })),
    selectedStyles:  festival.styles.map(s => ({ id: s.id, name: s.name })),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [saved, setSaved]   = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: EventPayload = {
        name:           form.name,
        status:         form.status,
        event_type_id:  festival.event_type.id,
        type:           form.type,
        start_date:     `${form.startDate}T${form.startTime}:00`,
        end_date:       `${form.endDate}T${form.endTime}:00`,
        duration:       Number(form.duration),
        room_id:        Number(form.roomId),
        capacity:       Number(form.capacity),
        level_id:       form.levelId ? Number(form.levelId) : null,
        artist_ids:     form.selectedArtists.map(a => a.id),
        genre_ids:      form.selectedGenres.map(g => g.id),
        style_ids:      form.selectedStyles.map(s => s.id),
        info:           form.info || null,
        multi_events:   form.multi_events,
      };
      const res = await authFetch(`/api/events/events/${festival.id}/`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(body));
      }
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Festival Name *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Access</Label>
          <Select value={form.type} onValueChange={v => set('type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="members">Members</SelectItem>
              <SelectItem value="collaboration">Collaboration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 flex items-center gap-3">
          <input
            id="fi-multi"
            type="checkbox"
            checked={form.multi_events}
            onChange={e => set('multi_events', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 accent-[#e67e22]"
          />
          <Label htmlFor="fi-multi" className="cursor-pointer">
            Multi-events festival
            <span className="ml-1.5 font-normal text-gray-400 text-xs">(status changes cascade to child events only)</span>
          </Label>
        </div>

        <div className="space-y-1.5">
          <Label>Start date *</Label>
          <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Start time *</Label>
          <Input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>End date *</Label>
          <Input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>End time *</Label>
          <Input type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label>Duration (minutes) *</Label>
          <Input type="number" value={form.duration} onChange={e => set('duration', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Capacity *</Label>
          <Input type="number" value={form.capacity} onChange={e => set('capacity', e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label>Main Venue *</Label>
          <Select value={form.roomId} onValueChange={v => set('roomId', v)} disabled={loadingRooms}>
            <SelectTrigger><SelectValue placeholder={loadingRooms ? 'Loading…' : 'Select room'} /></SelectTrigger>
            <SelectContent>
              {rooms.map(r => (
                <SelectItem key={r.id} value={r.id.toString()}>{r.name} — {r.location.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Level</Label>
          <Select value={form.levelId || 'none'} onValueChange={v => set('levelId', v === 'none' ? '' : v)} disabled={loadingLevels}>
            <SelectTrigger><SelectValue placeholder={loadingLevels ? 'Loading…' : 'Select level'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {levels.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <MultiSearchSelect
            label="Artists"
            items={artists.map(a => ({ id: a.id, name: a.full_name }))}
            selected={form.selectedArtists}
            loading={loadingArtists}
            placeholder="Search artist…"
            onChange={v => set('selectedArtists', v)}
          />
        </div>
        <div className="col-span-2">
          <MultiSearchSelect
            label="Genres"
            items={genres}
            selected={form.selectedGenres}
            loading={loadingGenres}
            placeholder="Search genre…"
            onChange={v => set('selectedGenres', v)}
          />
        </div>
        <div className="col-span-2">
          <MultiSearchSelect
            label="Styles"
            items={styles}
            selected={form.selectedStyles}
            loading={loadingStyles}
            placeholder="Search style…"
            onChange={v => set('selectedStyles', v)}
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>Info</Label>
          <Textarea value={form.info} onChange={e => set('info', e.target.value)} rows={3} placeholder="Additional festival information…" />
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>}
      {saved && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded">Saved.</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}

// ── Main FestivalGrid ─────────────────────────────────────────────────────────

export function FestivalGrid({ festival, onBack }: { festival: EventItem; onBack: () => void }) {
  const { accessToken } = useAuth();
  const { days, loading: loadingDays, refetch: refetchDays } = useFestivalDays(accessToken, festival.id);
  const { events: allEvents, refetch: refetchEvents } = useEvents(accessToken);

  const [selectedTab, setSelectedTab] = useState<'info' | number>('info');
  const [addingSlot, setAddingSlot] = useState<AddSlot | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [copiedEvent, setCopiedEvent] = useState<EventItem | null>(null);
  const [addingDay, setAddingDay] = useState(false);
  const [removingDayId, setRemovingDayId] = useState<number | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [addRoomDay, setAddRoomDay] = useState<FestivalDay | null>(null);
  const [removingRoomId, setRemovingRoomId] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCopiedEvent(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keep festival in sync with the live events list so festival.events reflects newly added children
  const liveFestival = allEvents.find(e => e.id === festival.id) ?? festival;

  const selectedDay = typeof selectedTab === 'number'
    ? (days.find(d => d.id === selectedTab) ?? days[0] ?? null)
    : null;

  const formatDayLabel = (date: string) =>
    formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' });

  const handleSaved = () => {
    setAddingSlot(null);
    setEditingEvent(null);
    refetchEvents();
  };

  const handleRemoveDay = async (day: FestivalDay) => {
    if (!accessToken) return;
    const festivalIds = new Set(liveFestival.events);
    const hasEvents = allEvents.some(
      e => festivalIds.has(e.id) && e.start_date.slice(0, 10) === day.date
    );
    if (hasEvents) {
      setDayError(`Cannot remove ${formatDayLabel(day.date)} — it still has classes scheduled.`);
      setTimeout(() => setDayError(null), 4000);
      return;
    }
    setRemovingDayId(day.id);
    try {
      await authFetch(`/api/festival/festival-days/${day.id}/`, accessToken, { method: 'DELETE' });
      if (selectedTab === day.id) setSelectedTab('info');
      await refetchDays();
    } finally {
      setRemovingDayId(null);
    }
  };

  const handleRemoveRoom = async (fr: FestivalRoom, day: FestivalDay) => {
    if (!accessToken) return;
    const festivalIds = new Set(liveFestival.events);
    const hasEvents = allEvents.some(
      e => festivalIds.has(e.id) && e.start_date.slice(0, 10) === day.date && e.room.id === fr.room.id
    );
    if (hasEvents) {
      setDayError(`Cannot remove "${fr.room.name}" — it still has classes scheduled on this day.`);
      setTimeout(() => setDayError(null), 4000);
      return;
    }
    setRemovingRoomId(fr.id);
    try {
      await authFetch(`/api/festival/festival-rooms/${fr.id}/`, accessToken, { method: 'DELETE' });
      await refetchDays();
    } finally {
      setRemovingRoomId(null);
    }
  };

  const handleAddNextDay = async () => {
    if (!accessToken || days.length === 0) return;
    const lastDate = days[days.length - 1].date;
    const nextDate = addOneDay(lastDate);
    setAddingDay(true);
    try {
      const res = await authFetch('/api/festival/festival-days/', accessToken, {
        method: 'POST',
        body: JSON.stringify({ event_id: festival.id, date: nextDate }),
      });
      if (res.ok) {
        const created = await res.json();
        await refetchDays();
        setSelectedTab(created.id);
      }
    } finally {
      setAddingDay(false);
    }
  };

  const handlePaste = async (slot: AddSlot) => {
    if (!copiedEvent || !accessToken) return;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const startMin = parseInt(slot.startTime.slice(0, 2), 10) * 60 + parseInt(slot.startTime.slice(3, 5), 10);
    const endMin = startMin + copiedEvent.duration;
    const toISO = (totalMin: number) => {
      const effectiveDate = totalMin >= 24 * 60 ? addOneDay(slot.date) : slot.date;
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      return `${effectiveDate}T${pad(h)}:${pad(m)}:00`;
    };
    try {
      const res = await authFetch('/api/events/events/', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          name: copiedEvent.name,
          status: copiedEvent.status,
          event_type_id: copiedEvent.event_type.id,
          type: copiedEvent.type,
          start_date: toISO(startMin),
          end_date: toISO(endMin),
          duration: copiedEvent.duration,
          room_id: slot.room.room.id,
          capacity: copiedEvent.capacity,
          level_id: copiedEvent.level?.id ?? null,
          artist_ids: copiedEvent.artists.map(a => a.id),
          genre_ids: copiedEvent.genres.map(g => g.id),
          style_ids: copiedEvent.styles.map(s => s.id),
          color: copiedEvent.color,
        } satisfies EventPayload),
      });
      if (!res.ok) return;
      const created: EventItem = await res.json();
      await authFetch(`/api/events/events/${liveFestival.id}/`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ event_ids: [...liveFestival.events, created.id] }),
      });
      refetchEvents();
    } catch {
      // silently ignore — user can try again
    }
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
      const effectiveDate = totalMin >= 24 * 60 ? addOneDay(date) : date;
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      return `${effectiveDate}T${pad(h)}:${pad(m)}:00`;
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

      {/* Tabs: Info + one per day */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setSelectedTab('info')}
          className={[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            selectedTab === 'info'
              ? 'border-[#e67e22] text-[#e67e22]'
              : 'border-transparent text-gray-500 hover:text-gray-800',
          ].join(' ')}
        >
          Info
        </button>
        {loadingDays ? (
          <span className="px-4 py-2"><Loader2 className="size-4 animate-spin text-gray-400" /></span>
        ) : (
          <>
            {days.map(day => (
              <div
                key={day.id}
                className={[
                  'group flex items-center gap-1 border-b-2 -mb-px transition-colors',
                  selectedTab === day.id
                    ? 'border-[#e67e22] text-[#e67e22]'
                    : 'border-transparent text-gray-500 hover:text-gray-800',
                ].join(' ')}
              >
                <button
                  onClick={() => setSelectedTab(day.id)}
                  className="px-3 py-2 text-sm font-medium"
                >
                  {formatDayLabel(day.date)}
                </button>
                <button
                  onClick={() => handleRemoveDay(day)}
                  disabled={removingDayId === day.id}
                  className="pr-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 disabled:opacity-40"
                  title="Remove day"
                >
                  {removingDayId === day.id
                    ? <Loader2 className="size-3 animate-spin" />
                    : <X className="size-3" />}
                </button>
              </div>
            ))}
            {days.length > 0 && (
              <button
                onClick={handleAddNextDay}
                disabled={addingDay}
                className="px-3 py-2 text-sm font-medium border-b-2 border-transparent -mb-px text-gray-400 hover:text-[#e67e22] transition-colors disabled:opacity-40"
                title={days.length ? `Add ${formatDayLabel(addOneDay(days[days.length - 1].date))}` : 'Add day'}
              >
                {addingDay ? <Loader2 className="size-4 animate-spin" /> : '+'}
              </button>
            )}
          </>
        )}
      </div>

      {dayError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {dayError}
        </p>
      )}

      {/* Copy/paste banner */}
      {copiedEvent && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <ClipboardPaste className="size-4 text-amber-600 flex-shrink-0" />
          <span className="text-amber-800">
            Click a slot to paste <strong>{copiedEvent.name}</strong>
          </span>
          <button
            onClick={() => setCopiedEvent(null)}
            className="ml-auto text-amber-500 hover:text-amber-800 transition-colors"
            title="Cancel (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {selectedTab === 'info' && (
        <FestivalInfoTab festival={liveFestival} onSaved={refetchEvents} />
      )}

      {selectedTab !== 'info' && (
        selectedDay ? (
          <DayGrid
            day={selectedDay}
            festival={liveFestival}
            allEvents={allEvents}
            copiedEvent={copiedEvent}
            removingRoomId={removingRoomId}
            onSlotClick={setAddingSlot}
            onEventClick={setEditingEvent}
            onEventDrop={handleEventDrop}
            onCopy={setCopiedEvent}
            onPaste={handlePaste}
            onAddRoom={() => setAddRoomDay(selectedDay)}
            onRemoveRoom={fr => handleRemoveRoom(fr, selectedDay)}
          />
        ) : (
          !loadingDays && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No days configured for this festival.
            </div>
          )
        )
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

      {/* Add room dialog */}
      {addRoomDay && accessToken && (
        <AddRoomDialog
          day={addRoomDay}
          accessToken={accessToken}
          onClose={() => setAddRoomDay(null)}
          onAdded={() => { setAddRoomDay(null); refetchDays(); }}
        />
      )}
    </div>
  );
}
