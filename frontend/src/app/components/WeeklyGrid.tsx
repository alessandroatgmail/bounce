import { useState, useRef, useEffect } from 'react';
import { Plus, Loader2, AlertTriangle, Upload, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { type EventItem, type EventPayload } from '../hooks/useEvents';
import { useEventsPaginated } from '../hooks/useEventsPaginated';
import { useEventTypes } from '../hooks/useEventTypes';
import { useArtists } from '../hooks/useArtists';
import { useGenres } from '../hooks/useGenres';
import { useStyles } from '../hooks/useStyles';
import { useRooms } from '../hooks/useRooms';
import { useLevels } from '../hooks/useLevels';
import { usePartnerRoles } from '../hooks/usePartnerRoles';
import { useMemberships } from '../hooks/useMemberships';
import { MultiSearchSelect } from './MultiSearchSelect';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { authFetch, authFetchFile } from '../../lib/api';

// ── Grid constants ─────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64;
const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60;
const DAY_START_HOUR = 18;
const DAY_END_HOUR = 24;
const DAY_START_MIN = DAY_START_HOUR * 60;
const DAY_END_MIN = DAY_END_HOUR * 60;
const GRID_HEIGHT = (DAY_END_MIN - DAY_START_MIN) * PIXELS_PER_MINUTE;
const TIME_COL_W = 56;
const LANE_W = 160;

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TIME_LABELS: { minutes: number; label: string }[] = [];
for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 30) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  TIME_LABELS.push({ minutes: m, label: `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}` });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function minutesToTop(m: number) {
  return (m - DAY_START_MIN) * PIXELS_PER_MINUTE;
}

function formatTime(iso: string) {
  return iso.slice(11, 16);
}

function eventMinutes(iso: string) {
  return parseInt(iso.slice(11, 13), 10) * 60 + parseInt(iso.slice(14, 16), 10);
}

// 0 = Monday … 4 = Friday, -1 = weekend
function getDayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const js = new Date(y, m - 1, d).getDay(); // 0=Sun … 6=Sat
  return js === 0 ? 6 : js - 1;              // 0=Mon … 6=Sun
}

// Next date (YYYY-MM-DD) that falls on dayIndex (0=Mon…4=Fri), from today
function nextOccurrence(dayIndex: number): string {
  const today = new Date();
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
  let ahead = dayIndex - todayIdx;
  if (ahead <= 0) ahead += 7;
  const d = new Date(today);
  d.setDate(today.getDate() + ahead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function toISO(date: string, totalMin: number) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${date}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun…6=Sat
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

// One lane per physical room, not interval packing — a room can never host
// two overlapping classes, so there's nothing to pack: every class in the
// same room belongs in the same lane, full stop. Lanes are handed out in
// order of each room's first class that day, so the grid stays stable
// class to class instead of a room hopping columns depending on what else
// happens to be running alongside it.
function computeLanes(events: EventItem[]): Map<number, number> {
  const sorted = [...events].sort((a, b) => eventMinutes(a.start_date) - eventMinutes(b.start_date));
  const roomLane = new Map<number, number>();
  const result = new Map<number, number>();
  for (const ev of sorted) {
    const roomId = ev.room?.id ?? -ev.id;
    let lane = roomLane.get(roomId);
    if (lane === undefined) { lane = roomLane.size; roomLane.set(roomId, lane); }
    result.set(ev.id, lane);
  }
  return result;
}

// ── Slot type ─────────────────────────────────────────────────────────────────

interface WeekSlot {
  dayIndex: number;
  startTime: string; // HH:MM
}

// ── Children (weekly occurrences) ───────────────────────────────────────────

// Everything a new occurrence clones from the parent template — only date
// and time are ever asked for when adding or editing one.
interface ChildTemplate {
  name: string;
  status: string;
  eventTypeId: string;
  roomId: string;
  capacity: string;
  levelId: string;
  color: string | null;
  artistIds: number[];
  genreIds: number[];
  styleIds: number[];
  acceptedRoleIds: number[];
  membershipIds: number[];
  paymentDays: string;
  warningThreshold: string;
  extras: string;
  blockPayment: boolean;
}

function formatChildDate(dateStr: string) {
  return new Date(dateStr.slice(0, 10) + 'T00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// Lists a weekly class's generated occurrences (one Event per week, linked
// via the parent's `events` M2M) with inline edit/delete, and lets the
// admin add one more occurrence that only varies by date/time — everything
// else is cloned from the parent form's current values.
function ChildrenSection({
  parentId,
  initialChildIds,
  accessToken,
  template,
}: {
  parentId: number;
  initialChildIds: number[];
  accessToken: string | null;
  template: ChildTemplate;
}) {
  const [childIds, setChildIds] = useState<number[]>(initialChildIds);
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<EventItem[] | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);
  const [savingChild, setSavingChild] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded || children !== null || !accessToken || childIds.length === 0) return;
    let cancelled = false;
    setLoadingChildren(true);
    setListError(null);
    Promise.all(
      childIds.map(id =>
        authFetch(`/api/events/events/${id}/`, accessToken).then(r => {
          if (!r.ok) throw new Error();
          return r.json() as Promise<EventItem>;
        }),
      ),
    )
      .then(list => { if (!cancelled) setChildren([...list].sort((a, b) => a.start_date.localeCompare(b.start_date))); })
      .catch(() => { if (!cancelled) setListError('Failed to load classes.'); })
      .finally(() => { if (!cancelled) setLoadingChildren(false); });
    return () => { cancelled = true; };
  }, [expanded, childIds, children, accessToken]);

  const startEdit = (child: EventItem) => {
    setEditingId(child.id);
    setEditDate(child.start_date.slice(0, 10));
    setEditStart(formatTime(child.start_date));
    setEditEnd(formatTime(child.end_date));
    setRowError(null);
  };

  const saveEdit = async (childId: number) => {
    if (!accessToken) return;
    const [sh, sm] = editStart.split(':').map(Number);
    const [eh, em] = editEnd.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    if (!editDate) { setRowError('Date is required.'); return; }
    if (duration <= 0) { setRowError('End time must be after start time.'); return; }
    setSavingChild(true);
    setRowError(null);
    try {
      const res = await authFetch(`/api/events/events/${childId}/`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({
          start_date: `${editDate}T${editStart}:00`,
          end_date: `${editDate}T${editEnd}:00`,
          duration,
        }),
      });
      if (!res.ok) throw new Error();
      const updated: EventItem = await res.json();
      setChildren(prev =>
        (prev?.map(c => (c.id === childId ? updated : c)) ?? [updated])
          .sort((a, b) => a.start_date.localeCompare(b.start_date)),
      );
      setEditingId(null);
    } catch {
      setRowError('Failed to save.');
    } finally {
      setSavingChild(false);
    }
  };

  const deleteChild = async (childId: number) => {
    if (!accessToken) return;
    setDeletingId(childId);
    setRowError(null);
    try {
      const res = await authFetch(`/api/events/events/${childId}/`, accessToken, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to delete.');
      }
      setChildIds(prev => prev.filter(id => id !== childId));
      setChildren(prev => prev?.filter(c => c.id !== childId) ?? null);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Failed to delete.');
    } finally {
      setDeletingId(null);
    }
  };

  const addChild = async () => {
    if (!accessToken) return;
    const [sh, sm] = newStart.split(':').map(Number);
    const [eh, em] = newEnd.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    if (!newDate) { setAddError('Date is required.'); return; }
    if (duration <= 0) { setAddError('End time must be after start time.'); return; }
    if (!template.roomId || !template.eventTypeId) { setAddError('Save the class first.'); return; }
    setSavingChild(true);
    setAddError(null);
    try {
      const payload: EventPayload = {
        name: `${template.name} - ${formatChildDate(newDate).replace(/ /g, '/')}`,
        status: template.status,
        event_type_id: Number(template.eventTypeId),
        type: 'members',
        start_date: `${newDate}T${newStart}:00`,
        end_date: `${newDate}T${newEnd}:00`,
        duration,
        room_id: Number(template.roomId),
        capacity: Number(template.capacity) || 20,
        artist_ids: template.artistIds,
        genre_ids: template.genreIds,
        style_ids: template.styleIds,
        color: template.color || null,
        level_id: template.levelId ? Number(template.levelId) : null,
        payment_days: Number(template.paymentDays) || 7,
        warning_threshold: Number(template.warningThreshold) || 5,
        extras: Number(template.extras) || 0,
        accepted_role_ids: template.acceptedRoleIds,
        membership_ids: template.membershipIds,
        block_payment: template.blockPayment,
      };
      const createRes = await authFetch('/api/events/events/', accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(JSON.stringify(body));
      }
      const created: EventItem = await createRes.json();
      const nextIds = [...childIds, created.id];
      // event_ids replaces the whole set server-side, so send the full
      // list back — PATCH (not PUT) so the rest of the parent's fields,
      // and the PUT-only cascade-to-children logic, are left untouched.
      const linkRes = await authFetch(`/api/events/events/${parentId}/`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ event_ids: nextIds }),
      });
      if (!linkRes.ok) throw new Error('Class was created but could not be linked to this event.');
      setChildIds(nextIds);
      setChildren(prev => (prev ? [...prev, created] : [created]).sort((a, b) => a.start_date.localeCompare(b.start_date)));
      setAdding(false);
      setNewDate(''); setNewStart(''); setNewEnd('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add.');
    } finally {
      setSavingChild(false);
    }
  };

  return (
    <div className="space-y-1.5 border-t pt-3">
      <button type="button" onClick={() => setExpanded(e => !e)} className="flex items-center justify-between w-full text-left">
        <Label className="cursor-pointer">Classes ({childIds.length})</Label>
        {expanded ? <ChevronUp className="size-3.5 text-gray-400" /> : <ChevronDown className="size-3.5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="space-y-2 pt-1">
          {loadingChildren && <Loader2 className="size-4 animate-spin text-gray-400" />}
          {listError && <p className="text-xs text-red-500">{listError}</p>}

          {children?.map(child => (
            <div key={child.id} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs">
              {editingId === child.id ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-7 text-xs" />
                    <Input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} className="h-7 text-xs" />
                    <Input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button type="button" size="sm" className="h-6 text-[10px] px-2" disabled={savingChild} onClick={() => saveEdit(child.id)}>
                      {savingChild ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span>{formatChildDate(child.start_date)} · {formatTime(child.start_date)}–{formatTime(child.end_date)}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => startEdit(child)} className="text-gray-400 hover:text-[#e67e22]" title="Edit">
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChild(child.id)}
                      disabled={deletingId === child.id}
                      className="text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      {deletingId === child.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {rowError && <p className="text-xs text-red-500">{rowError}</p>}

          {adding ? (
            <div className="rounded-md border border-dashed border-gray-300 px-2 py-1.5 space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5">
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-7 text-xs" />
                <Input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="h-7 text-xs" />
                <Input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="h-7 text-xs" />
              </div>
              {addError && <p className="text-[10px] text-red-500">{addError}</p>}
              <div className="flex justify-end gap-1.5">
                <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => { setAdding(false); setAddError(null); }}>Cancel</Button>
                <Button type="button" size="sm" className="h-6 text-[10px] px-2" disabled={savingChild} onClick={addChild}>
                  {savingChild ? <Loader2 className="size-3 animate-spin" /> : 'Add'}
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#e67e22] transition-colors">
              <Plus className="size-3.5" /> Add a class occurrence
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

function WeeklyEventDialog({
  slot,
  editEvent,
  onClose,
  onSaved,
}: {
  slot?: WeekSlot;
  editEvent?: EventItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { accessToken } = useAuth();
  const { eventTypes, loading: loadingTypes } = useEventTypes(accessToken);
  const { artists, loading: loadingArtists } = useArtists(accessToken);
  const { genres, loading: loadingGenres } = useGenres(accessToken);
  const { styles, loading: loadingStyles } = useStyles(accessToken);
  const { rooms, loading: loadingRooms } = useRooms(accessToken);
  const { levels, loading: loadingLevels } = useLevels(accessToken);
  const { partnerRoles, loading: loadingRoles } = usePartnerRoles(accessToken);
  const { memberships, loading: loadingMemberships } = useMemberships(accessToken);

  const isEdit = !!editEvent;
  const slotDayIndex = slot?.dayIndex ?? getDayIndex(editEvent!.start_date);

  const [name, setName] = useState(editEvent?.name ?? '');
  const [eventTypeId, setEventTypeId] = useState(editEvent?.event_type.id.toString() ?? '');
  const [roomId, setRoomId] = useState(editEvent?.room.id.toString() ?? '');
  const [status, setStatus] = useState(editEvent?.status ?? 'draft');
  const [startDate, setStartDate] = useState(
    editEvent ? editEvent.start_date.slice(0, 10) : nextOccurrence(slotDayIndex)
  );
  const [startTime, setStartTime] = useState(
    editEvent ? formatTime(editEvent.start_date) : (slot?.startTime ?? '')
  );
  const [endTime, setEndTime] = useState(editEvent ? formatTime(editEvent.end_date) : '');
  const [endDate, setEndDate] = useState(editEvent ? editEvent.end_date.slice(0, 10) : '');
  const [capacity, setCapacity] = useState(editEvent?.capacity.toString() ?? '');
  const [levelId, setLevelId] = useState(editEvent?.level?.id.toString() ?? '');
  const [color, setColor] = useState(editEvent?.color ?? '#e67e22');
  const [selectedArtists, setSelectedArtists] = useState<{ id: number; name: string }[]>(
    editEvent?.artists.map(a => ({ id: a.id, name: a.full_name })) ?? []
  );
  const [selectedGenres, setSelectedGenres] = useState<{ id: number; name: string }[]>(editEvent?.genres ?? []);
  const [selectedStyles, setSelectedStyles] = useState<{ id: number; name: string }[]>(editEvent?.styles ?? []);
  const [selectedRoles, setSelectedRoles] = useState<{ id: number; name: string }[]>(editEvent?.accepted_roles ?? []);
  const [selectedMemberships, setSelectedMemberships] = useState<{ id: number; name: string }[]>(
    editEvent?.memberships?.map(m => ({ id: m.id, name: m.name })) ?? []
  );
  const [paymentDays, setPaymentDays] = useState(editEvent?.payment_days?.toString() ?? '7');
  const [warningThreshold, setWarningThreshold] = useState(editEvent?.warning_threshold?.toString() ?? '5');
  const [extras, setExtras] = useState((editEvent?.extras ?? 0).toString());
  const [blockPayment, setBlockPayment] = useState(editEvent?.block_payment ?? false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(editEvent?.effective_image ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(editEvent?.effective_image ?? null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Day mismatch warning
  const startDateDayIndex = startDate ? getDayIndex(startDate) : null;
  const dayMismatch = startDate && startDateDayIndex !== null && startDateDayIndex !== slotDayIndex;
  const mismatchMsg = dayMismatch
    ? `${new Date(startDate + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} is a ${WEEKDAY_NAMES[startDateDayIndex!]}, not ${WEEKDAY_NAMES[slotDayIndex]}`
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    if (duration <= 0) { setError('End time must be after start time.'); return; }
    if (!roomId) { setError('Please select a room.'); return; }
    if (!endDate) { setError('End date (last occurrence) is required.'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload: EventPayload = {
        name,
        status,
        event_type_id: Number(eventTypeId),
        type: 'members',
        start_date: `${startDate}T${startTime}:00`,
        end_date: `${endDate}T${endTime}:00`,
        duration,
        room_id: Number(roomId),
        capacity: Number(capacity) || 20,
        artist_ids: selectedArtists.map(a => a.id),
        genre_ids: selectedGenres.map(g => g.id),
        style_ids: selectedStyles.map(s => s.id),
        color: color || null,
        level_id: levelId ? Number(levelId) : null,
        payment_days: Number(paymentDays) || 7,
        warning_threshold: Number(warningThreshold) || 5,
        extras: Number(extras) || 0,
        accepted_role_ids: selectedRoles.map(r => r.id),
        membership_ids: selectedMemberships.map(m => m.id),
        block_payment: blockPayment,
      };

      const url = isEdit ? `/api/events/events/${editEvent!.id}/` : '/api/events/events/';
      const res = await authFetch(url, accessToken, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(body));
      }
      const saved = await res.json();
      const savedId: number = isEdit ? editEvent!.id : saved.id;
      if (imageFile) {
        const form = new FormData();
        form.append('image', imageFile);
        await authFetchFile(`/api/events/events/${savedId}/`, accessToken, form);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Class' : 'Add Weekly Class'}</DialogTitle>
          <DialogDescription>{WEEKDAY_NAMES[slotDayIndex]} · {startTime}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Event Type *</Label>
            <Select value={eventTypeId} onValueChange={setEventTypeId} disabled={loadingTypes}>
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {eventTypes.filter(et => et.frequency === 'weekly').map(et => (
                  <SelectItem key={et.id} value={et.id.toString()}>{et.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Room *</Label>
            <Select value={roomId} onValueChange={setRoomId} disabled={loadingRooms}>
              <SelectTrigger><SelectValue placeholder="Select room…" /></SelectTrigger>
              <SelectContent>
                {rooms.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name} — {r.location.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Time *</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>End Time *</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First occurrence *</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Last occurrence *</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>
          {mismatchMsg && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="size-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
              {mismatchMsg}
            </div>
          )}
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
              <Label>Level</Label>
              <Select value={levelId || 'none'} onValueChange={v => setLevelId(v === 'none' ? '' : v)} disabled={loadingLevels}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {levels.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="20" />
            </div>
          </div>
          <MultiSearchSelect label="Artists" items={artists.map(a => ({ id: a.id, name: a.full_name }))} selected={selectedArtists} loading={loadingArtists} placeholder="Search artist…" onChange={setSelectedArtists} />
          <MultiSearchSelect label="Genres" items={genres} selected={selectedGenres} loading={loadingGenres} placeholder="Search genre…" onChange={setSelectedGenres} />
          <MultiSearchSelect label="Styles" items={styles} selected={selectedStyles} loading={loadingStyles} placeholder="Search style…" onChange={setSelectedStyles} />
          <MultiSearchSelect label="Accepted Roles" items={partnerRoles} selected={selectedRoles} loading={loadingRoles} placeholder="Search role…" onChange={setSelectedRoles} />
          <MultiSearchSelect
            label="Memberships"
            items={memberships.map(m => ({ id: m.id, name: m.name }))}
            selected={selectedMemberships}
            loading={loadingMemberships}
            placeholder="Search membership…"
            onChange={setSelectedMemberships}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Payment days</Label>
              <Input type="number" min={1} value={paymentDays} onChange={e => setPaymentDays(e.target.value)} placeholder="7" />
            </div>
            <div className="space-y-1.5">
              <Label>Warning threshold</Label>
              <Input type="number" min={0} value={warningThreshold} onChange={e => setWarningThreshold(e.target.value)} placeholder="5" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="we-block-payment"
              type="checkbox"
              checked={blockPayment}
              onChange={e => setBlockPayment(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-[#e67e22]"
            />
            <Label htmlFor="we-block-payment" className="cursor-pointer">
              Block payment
              <span className="ml-1.5 font-normal text-gray-400 text-xs">Bookings need manual approval instead of auto-accepting</span>
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label>Extras / Notes</Label>
            <Textarea value={extras} onChange={e => setExtras(e.target.value)} placeholder="Additional notes…" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={color ?? '#e67e22'} onChange={e => setColor(e.target.value)} className="h-8 w-12 rounded border cursor-pointer p-0.5" />
              <Input value={color ?? ''} onChange={e => setColor(e.target.value || null as any)} placeholder="#rrggbb" className="flex-1 h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Image</Label>
            {imagePreview ? (
              <div className="relative w-full h-32 rounded-md overflow-hidden border border-gray-200 group">
                <img src={imagePreview} alt="Event" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 rounded-md border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
              >
                <Upload className="size-4" />
                <span className="text-xs">Click to upload an image</span>
              </button>
            )}
            {imagePreview && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                Change image
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
          {isEdit && (
            <ChildrenSection
              parentId={editEvent!.id}
              initialChildIds={editEvent!.events}
              accessToken={accessToken}
              template={{
                name,
                status,
                eventTypeId,
                roomId,
                capacity,
                levelId,
                color,
                artistIds: selectedArtists.map(a => a.id),
                genreIds: selectedGenres.map(g => g.id),
                styleIds: selectedStyles.map(s => s.id),
                acceptedRoleIds: selectedRoles.map(r => r.id),
                membershipIds: selectedMemberships.map(m => m.id),
                paymentDays,
                warningThreshold,
                extras,
                blockPayment,
              }}
            />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving || !eventTypeId || !roomId}>
              {saving && <Loader2 className="size-3 mr-1 animate-spin" />}
              {isEdit ? 'Save' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Lane column ───────────────────────────────────────────────────────────────

function LaneColumn({
  dayIndex,
  laneEvents,
  onSlotClick,
  onEventClick,
  onEventDrop,
}: {
  dayIndex: number;
  laneEvents: EventItem[];
  onSlotClick: (slot: WeekSlot) => void;
  onEventClick: (ev: EventItem) => void;
  onEventDrop: (eventId: number, dayIndex: number, startMin: number) => void;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const yToMinutes = (y: number) =>
    Math.round((y / PIXELS_PER_MINUTE + DAY_START_MIN) / 15) * 15;

  const handleClick = (e: React.MouseEvent) => {
    if (!colRef.current) return;
    const y = e.clientY - colRef.current.getBoundingClientRect().top + colRef.current.scrollTop;
    const minutes = Math.floor(y / PIXELS_PER_MINUTE / 30) * 30 + DAY_START_MIN;
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    onSlotClick({ dayIndex, startTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}` });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!colRef.current) return;
    const eventId = Number(e.dataTransfer.getData('eventId'));
    const offsetY = Number(e.dataTransfer.getData('offsetY'));
    const y = e.clientY - colRef.current.getBoundingClientRect().top + colRef.current.scrollTop - offsetY;
    const startMin = Math.max(DAY_START_MIN, Math.min(yToMinutes(y), DAY_END_MIN - 15));
    onEventDrop(eventId, dayIndex, startMin);
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-400',
    confirmed: 'bg-blue-500',
    published: 'bg-green-500',
  };

  return (
    <div
      ref={colRef}
      className={`relative border-l border-gray-100 cursor-crosshair select-none transition-colors ${dragOver ? 'bg-orange-50' : ''}`}
      style={{ width: LANE_W, height: GRID_HEIGHT, flexShrink: 0 }}
      onClick={handleClick}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragEnter={() => setDragOver(true)}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {TIME_LABELS.map(({ minutes }) => (
        <div
          key={minutes}
          className={`absolute w-full border-t ${minutes % 60 === 0 ? 'border-gray-200' : 'border-gray-100 border-dashed'}`}
          style={{ top: minutesToTop(minutes) }}
        />
      ))}

      {laneEvents.map(ev => {
        const startM = Math.max(eventMinutes(ev.start_date), DAY_START_MIN);
        const endM = Math.min(startM + ev.duration, DAY_END_MIN);
        const top = minutesToTop(startM);
        const height = Math.max((endM - startM) * PIXELS_PER_MINUTE, 24);
        const evDayIdx = getDayIndex(ev.start_date);
        const wrongDay = evDayIdx !== dayIndex;

        return (
          <div
            key={ev.id}
            draggable
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('eventId', String(ev.id));
              e.dataTransfer.setData('offsetY', String(e.clientY - e.currentTarget.getBoundingClientRect().top));
            }}
            className="absolute left-1 right-1 rounded text-white text-xs px-1.5 py-1 overflow-hidden shadow-sm z-10 cursor-grab active:cursor-grabbing hover:opacity-90"
            style={{ top, height, backgroundColor: ev.color ?? '#e67e22' }}
            onClick={e => { e.stopPropagation(); onEventClick(ev); }}
          >
            <div className="font-medium truncate leading-tight">{ev.name}</div>
            <div className="opacity-80 text-[10px]">{formatTime(ev.start_date)}–{formatTime(toISO(ev.start_date.slice(0, 10), startM + ev.duration))}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`inline-block size-1.5 rounded-full flex-shrink-0 ${statusColor[ev.status] ?? 'bg-gray-400'}`} />
              <span className="opacity-70 text-[10px] capitalize">{ev.status}</span>
              {wrongDay && <AlertTriangle className="size-2.5 text-amber-300 ml-auto flex-shrink-0" title={`Start date is a ${WEEKDAY_NAMES[evDayIdx]}`} />}
            </div>
            {ev.artists.length > 0 && (
              <div className="opacity-70 text-[10px] truncate">{ev.artists.map(a => a.full_name).join(', ')}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Day column ─────────────────────────────────────────────────────────────────

function DayColumn({
  dayIndex,
  date,
  dayEvents,
  minLanes,
  onAddLane,
  onSlotClick,
  onEventClick,
  onEventDrop,
}: {
  dayIndex: number;
  date: string; // "YYYY-MM-DD" of this column in the selected week
  dayEvents: EventItem[];
  minLanes: number;
  onAddLane: () => void;
  onSlotClick: (slot: WeekSlot) => void;
  onEventClick: (ev: EventItem) => void;
  onEventDrop: (eventId: number, dayIndex: number, startMin: number) => void;
}) {
  const laneMap = computeLanes(dayEvents);
  const autoLanes = laneMap.size === 0 ? 0 : Math.max(...laneMap.values()) + 1;
  const totalLanes = Math.max(minLanes, autoLanes, 1);

  const groups: EventItem[][] = Array.from({ length: totalLanes }, () => []);
  dayEvents.forEach(ev => {
    const l = laneMap.get(ev.id) ?? 0;
    if (l < totalLanes) groups[l].push(ev);
  });

  return (
    <div className="flex flex-col" style={{ flexShrink: 0 }}>
      <div
        className="sticky top-0 z-20 bg-gray-50 border-l border-b px-2 py-1.5 flex items-center justify-between"
        style={{ width: totalLanes * LANE_W }}
      >
        <span className="text-xs font-semibold text-gray-700">
          {WEEKDAY_NAMES[dayIndex]}
          <span className="ml-1 font-normal text-gray-400">
            {new Date(date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </span>
        <button onClick={onAddLane} className="text-gray-400 hover:text-[#e67e22] transition-colors" title="Add lane">
          <Plus className="size-3.5" />
        </button>
      </div>
      {totalLanes > 1 && (
        <div className="flex border-l border-b sticky z-10 bg-white" style={{ top: 33 }}>
          {Array.from({ length: totalLanes }, (_, i) => (
            <div key={i} className="border-l text-[10px] text-gray-400 px-1 py-0.5 text-center" style={{ width: LANE_W }}>
              Lane {i + 1}
            </div>
          ))}
        </div>
      )}
      <div className="flex">
        {groups.map((evs, i) => (
          <LaneColumn
            key={i}
            dayIndex={dayIndex}
            laneEvents={evs}
            onSlotClick={onSlotClick}
            onEventClick={onEventClick}
            onEventDrop={onEventDrop}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main WeeklyGrid ────────────────────────────────────────────────────────────

export function WeeklyGrid() {
  const { accessToken } = useAuth();

  const [minLanes, setMinLanes] = useState<Record<number, number>>({});
  const [addingSlot, setAddingSlot] = useState<WeekSlot | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [weekMonday, setWeekMonday] = useState<Date>(() => getWeekMonday(new Date()));
  const [calOpen, setCalOpen] = useState(false);

  const prevWeek = () => setWeekMonday(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setWeekMonday(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const goToday  = () => setWeekMonday(getWeekMonday(new Date()));

  // Dates for Mon–Fri of the selected week
  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() + i);
    return toDateStr(d);
  });

  const weekFriday = new Date(weekMonday);
  weekFriday.setDate(weekFriday.getDate() + 4);
  const weekLabel = `${weekMonday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekFriday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const { events: visibleEvents, loading, refetch: onRefetch, setFilters } = useEventsPaginated(
    accessToken,
    {
      frequency: 'weekly',
      exclude_children: true,
      start_date_before: toDateStr(weekFriday),
      end_date_after: toDateStr(weekMonday),
    },
    20,
  );

  useEffect(() => {
    const friday = new Date(weekMonday);
    friday.setDate(friday.getDate() + 4);
    setFilters({
      frequency: 'weekly',
      exclude_children: true,
      start_date_before: toDateStr(friday),
      end_date_after: toDateStr(weekMonday),
    });
  }, [weekMonday, setFilters]);

  // Group by day of week (0=Mon…4=Fri)
  const byDay: EventItem[][] = Array.from({ length: 5 }, () => []);
  visibleEvents.forEach(ev => {
    const d = getDayIndex(ev.start_date);
    if (d >= 0 && d <= 4) byDay[d].push(ev);
  });

  const handleSaved = () => { setAddingSlot(null); setEditingEvent(null); onRefetch(); };

  const handleEventDrop = async (draggedId: number, newDayIndex: number, newStartMin: number) => {
    if (!accessToken) return;
    const ev = visibleEvents.find(e => e.id === draggedId);
    if (!ev) return;

    const oldDayIndex = getDayIndex(ev.start_date);
    const dayDelta = newDayIndex - oldDayIndex;

    const newStartDate = shiftDate(ev.start_date.slice(0, 10), dayDelta);
    const newEndDate = shiftDate(ev.end_date.slice(0, 10), dayDelta);

    await authFetch(`/api/events/events/${draggedId}/`, accessToken, {
      method: 'PUT',
      body: JSON.stringify({
        name: ev.name,
        status: ev.status,
        event_type_id: ev.event_type.id,
        type: ev.type,
        start_date: toISO(newStartDate, newStartMin),
        end_date: `${newEndDate}T${ev.start_date.slice(11, 16)}:00`,
        duration: ev.duration,
        room_id: ev.room.id,
        capacity: ev.capacity,
        artist_ids: ev.artists.map(a => a.id),
        genre_ids: ev.genres.map(g => g.id),
        style_ids: ev.styles.map(s => s.id),
        color: ev.color,
        payment_days: ev.payment_days,
        warning_threshold: ev.warning_threshold,
        extras: ev.extras ?? 0,
        accepted_role_ids: ev.accepted_roles.map(r => r.id),
        block_payment: ev.block_payment,
      } satisfies EventPayload),
    });
    onRefetch();
  };

  return (
    <div className="space-y-2">
      {/* Week selector */}
      <div className="flex items-center gap-1">
        <button onClick={prevWeek} className="p-1 rounded hover:bg-gray-100 transition-colors" title="Previous week">
          <ChevronLeft className="size-4 text-gray-600" />
        </button>
        <button onClick={nextWeek} className="p-1 rounded hover:bg-gray-100 transition-colors" title="Next week">
          <ChevronRight className="size-4 text-gray-600" />
        </button>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 transition-colors">
              <CalendarDays className="size-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{weekLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: weekMonday, to: weekFriday }}
              onDayClick={(day) => {
                setWeekMonday(getWeekMonday(day));
                setCalOpen(false);
              }}
              weekStartsOn={1}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <button onClick={goToday} className="ml-1 text-xs text-gray-500 hover:text-[#e67e22] underline transition-colors">
          Today
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-gray-400" /></div>
      ) : (
        <div className="overflow-auto border rounded-lg">
          <div className="flex">
            {/* Sticky time column */}
            <div className="sticky left-0 z-30 bg-white" style={{ flexShrink: 0 }}>
              <div className="sticky top-0 z-30 bg-white border-b border-r" style={{ height: 33, width: TIME_COL_W }} />
              <div className="relative border-r" style={{ width: TIME_COL_W, height: GRID_HEIGHT }}>
                {TIME_LABELS.map(({ minutes, label }) =>
                  minutes % 60 === 0 ? (
                    <div key={minutes} className="absolute right-2 text-[10px] text-gray-400 leading-none" style={{ top: minutesToTop(minutes) - 6 }}>
                      {label}
                    </div>
                  ) : null
                )}
                {TIME_LABELS.map(({ minutes }) => (
                  <div key={minutes} className={`absolute right-0 ${minutes % 60 === 0 ? 'w-3 border-t border-gray-300' : 'w-1.5 border-t border-gray-200'}`} style={{ top: minutesToTop(minutes) }} />
                ))}
              </div>
            </div>

            {/* Day columns */}
            {byDay.map((evs, i) => (
              <DayColumn
                key={i}
                dayIndex={i}
                date={weekDates[i]}
                dayEvents={evs}
                minLanes={minLanes[i] ?? 1}
                onAddLane={() => setMinLanes(prev => ({ ...prev, [i]: (prev[i] ?? 1) + 1 }))}
                onSlotClick={setAddingSlot}
                onEventClick={setEditingEvent}
                onEventDrop={handleEventDrop}
              />
            ))}
          </div>
        </div>
      )}

      {addingSlot && (
        <WeeklyEventDialog slot={addingSlot} onClose={() => setAddingSlot(null)} onSaved={handleSaved} />
      )}
      {editingEvent && (
        <WeeklyEventDialog editEvent={editingEvent} onClose={() => setEditingEvent(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
