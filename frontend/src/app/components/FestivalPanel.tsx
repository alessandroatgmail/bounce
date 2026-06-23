import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useEvents, type EventItem, type EventPayload } from '../hooks/useEvents';
import { useEventTypes } from '../hooks/useEventTypes';
import { useRooms } from '../hooks/useRooms';
import { useLevels } from '../hooks/useLevels';
import { useArtists } from '../hooks/useArtists';
import { useGenres } from '../hooks/useGenres';
import { useStyles } from '../hooks/useStyles';
import { MultiSearchSelect } from './MultiSearchSelect';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { authFetch } from '../../lib/api';
import { FestivalGrid } from './FestivalGrid';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FestivalInfoData {
  name: string;
  status: string;
  accessType: string;
  levelId: string;
  roomId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  duration: string;
  capacity: string;
  info: string;
  selectedArtists: { id: number; name: string }[];
  selectedGenres: { id: number; name: string }[];
  selectedStyles: { id: number; name: string }[];
}

interface DayConfig {
  date: string;
  rooms: { id: number; name: string }[];
}

const EMPTY_INFO: FestivalInfoData = {
  name: '', status: 'draft', accessType: 'members', levelId: '', roomId: '',
  startDate: '', startTime: '', endDate: '', endTime: '',
  duration: '', capacity: '', info: '',
  selectedArtists: [], selectedGenres: [], selectedStyles: [],
};

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {[{ n: 1, label: 'Festival Info' }, { n: 2, label: 'Days & Rooms' }].map(({ n, label }, i) => (
        <div key={n} className="flex items-center gap-2">
          {i > 0 && <ChevronRight className="size-4 text-gray-300" />}
          <div className={`flex items-center gap-1.5 text-sm font-medium ${step === n ? 'text-[#2b2b2b]' : 'text-gray-400'}`}>
            <span className={`size-6 rounded-full flex items-center justify-center text-xs border-2 ${step === n ? 'border-[#2b2b2b] bg-[#2b2b2b] text-white' : step > n ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-gray-400'}`}>
              {step > n ? '✓' : n}
            </span>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Festival info ─────────────────────────────────────────────────────

function FestivalInfoStep({
  data,
  onChange,
  onNext,
  onCancel,
}: {
  data: FestivalInfoData;
  onChange: (d: FestivalInfoData) => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  const { accessToken } = useAuth();
  const { eventTypes, loading: loadingTypes } = useEventTypes(accessToken);
  const { rooms, loading: loadingRooms } = useRooms(accessToken);
  const { levels, loading: loadingLevels } = useLevels(accessToken);
  const { artists, loading: loadingArtists } = useArtists(accessToken);
  const { genres, loading: loadingGenres } = useGenres(accessToken);
  const { styles, loading: loadingStyles } = useStyles(accessToken);

  const festivalType = eventTypes.find(et => et.name === 'Festival');
  const set = <K extends keyof FestivalInfoData>(k: K, v: FestivalInfoData[K]) =>
    onChange({ ...data, [k]: v });

  const artistItems = artists.map(a => ({ id: a.id, name: a.full_name }));

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleNext} className="space-y-4">
      {/* Locked event type */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded border text-sm text-gray-600">
        {loadingTypes
          ? <Loader2 className="size-3 animate-spin" />
          : festivalType
            ? <><span className="font-medium">Event type:</span><Badge variant="outline" className="ml-1">Festival</Badge></>
            : <span className="text-amber-600">No "Festival" event type found — create one in Event Types first.</span>
        }
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="f-name">Festival Name *</Label>
          <Input id="f-name" value={data.name} onChange={e => set('name', e.target.value)} placeholder="e.g., Swing Summer Fest 2026" required />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={data.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Access</Label>
          <Select value={data.accessType} onValueChange={v => set('accessType', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="members">Members</SelectItem>
              <SelectItem value="collaboration">Collaboration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Level</Label>
          <Select value={data.levelId || 'none'} onValueChange={v => set('levelId', v === 'none' ? '' : v)} disabled={loadingLevels}>
            <SelectTrigger><SelectValue placeholder={loadingLevels ? 'Loading…' : 'Select level'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {levels.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Main Venue *</Label>
          <Select value={data.roomId} onValueChange={v => set('roomId', v)} disabled={loadingRooms}>
            <SelectTrigger><SelectValue placeholder={loadingRooms ? 'Loading…' : 'Select room'} /></SelectTrigger>
            <SelectContent>
              {rooms.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name} — {r.location.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-start-date">Start Date *</Label>
          <Input id="f-start-date" type="date" value={data.startDate} onChange={e => set('startDate', e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-start-time">Start Time *</Label>
          <Input id="f-start-time" type="time" value={data.startTime} onChange={e => set('startTime', e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-end-date">End Date *</Label>
          <Input id="f-end-date" type="date" value={data.endDate} onChange={e => set('endDate', e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-end-time">End Time *</Label>
          <Input id="f-end-time" type="time" value={data.endTime} onChange={e => set('endTime', e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-duration">Duration (minutes) *</Label>
          <Input id="f-duration" type="number" value={data.duration} onChange={e => set('duration', e.target.value)} placeholder="90" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-capacity">Capacity *</Label>
          <Input id="f-capacity" type="number" value={data.capacity} onChange={e => set('capacity', e.target.value)} placeholder="200" required />
        </div>

        <div className="col-span-2">
          <MultiSearchSelect label="Artists" items={artistItems} selected={data.selectedArtists} loading={loadingArtists} placeholder="Search artist…" onChange={v => set('selectedArtists', v)} />
        </div>
        <div className="col-span-2">
          <MultiSearchSelect label="Genres" items={genres} selected={data.selectedGenres} loading={loadingGenres} placeholder="Search genre…" onChange={v => set('selectedGenres', v)} />
        </div>
        <div className="col-span-2">
          <MultiSearchSelect label="Styles" items={styles} selected={data.selectedStyles} loading={loadingStyles} placeholder="Search style…" onChange={v => set('selectedStyles', v)} />
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="f-info">Info</Label>
          <Textarea id="f-info" value={data.info} onChange={e => set('info', e.target.value)} placeholder="Additional information about this festival…" rows={3} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!festivalType && !loadingTypes}>
          Next <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>
    </form>
  );
}

// ── Step 2: Days & rooms ──────────────────────────────────────────────────────

function generateDaysFromRange(startDate: string, endDate: string): DayConfig[] {
  const days: DayConfig[] = [];
  if (!startDate || !endDate) return days;
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const pad = (n: number) => String(n).padStart(2, '0');
  while (current <= end) {
    const dateStr = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`;
    days.push({ date: dateStr, rooms: [] });
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function FestivalDaysStep({
  infoData,
  days,
  onDaysChange,
  onBack,
  onSubmit,
  saving,
  error,
}: {
  infoData: FestivalInfoData;
  days: DayConfig[];
  onDaysChange: (days: DayConfig[]) => void;
  onBack: () => void;
  onSubmit: () => void;
  saving: boolean;
  error: string | null;
}) {
  const { accessToken } = useAuth();
  const { rooms } = useRooms(accessToken);
  const [extraDate, setExtraDate] = useState('');

  const addRoom = (dayIndex: number, room: { id: number; name: string }) => {
    onDaysChange(days.map((d, i) =>
      i === dayIndex && !d.rooms.find(r => r.id === room.id)
        ? { ...d, rooms: [...d.rooms, room] }
        : d
    ));
  };

  const removeRoom = (dayIndex: number, roomId: number) => {
    onDaysChange(days.map((d, i) =>
      i === dayIndex ? { ...d, rooms: d.rooms.filter(r => r.id !== roomId) } : d
    ));
  };

  const removeDay = (dayIndex: number) => {
    onDaysChange(days.filter((_, i) => i !== dayIndex));
  };

  const addExtraDay = () => {
    if (!extraDate || days.find(d => d.date === extraDate)) return;
    onDaysChange([...days, { date: extraDate, rooms: [] }].sort((a, b) => a.date.localeCompare(b.date)));
    setExtraDate('');
  };

  const formatDay = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Configure rooms for each day of <span className="font-medium text-gray-800">{infoData.name}</span>.
        Days are pre-filled from the festival date range.
      </p>

      {days.length === 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded border border-amber-200">
          No days generated — check the start and end dates in the previous step.
        </p>
      )}

      {days.map((day, i) => (
        <div key={day.date} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{formatDay(day.date)}</span>
            <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-7 w-7 p-0" onClick={() => removeDay(i)}>
              <Trash2 className="size-3" />
            </Button>
          </div>

          {day.rooms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {day.rooms.map(r => (
                <Badge key={r.id} variant="secondary" className="flex items-center gap-1 pr-1">
                  {r.name}
                  <button
                    type="button"
                    onClick={() => removeRoom(i, r.id)}
                    className="ml-1 rounded-full hover:text-red-500 leading-none"
                  >×</button>
                </Badge>
              ))}
            </div>
          )}

          <Select
            value=""
            onValueChange={v => {
              const room = rooms.find(r => r.id === Number(v));
              if (room) addRoom(i, { id: room.id, name: room.name });
            }}
          >
            <SelectTrigger className="h-8 text-sm w-52">
              <SelectValue placeholder="Add room…" />
            </SelectTrigger>
            <SelectContent>
              {rooms
                .filter(r => !day.rooms.find(dr => dr.id === r.id))
                .map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name} — {r.location.name}</SelectItem>)
              }
            </SelectContent>
          </Select>
        </div>
      ))}

      {/* Add extra day */}
      <div className="flex gap-2 items-center pt-1">
        <Input type="date" value={extraDate} onChange={e => setExtraDate(e.target.value)} className="w-44 h-8 text-sm" />
        <Button type="button" variant="outline" size="sm" onClick={addExtraDay} disabled={!extraDate}>
          <Plus className="size-3 mr-1" />Add day
        </Button>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
          <ChevronLeft className="size-4 mr-1" />Back
        </Button>
        <Button type="button" onClick={onSubmit} disabled={saving}>
          {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
          Create Festival
        </Button>
      </div>
    </div>
  );
}

// ── Wizard wrapper ────────────────────────────────────────────────────────────

function FestivalWizard({ onComplete, onCancel }: { onComplete: (festival: EventItem) => void; onCancel: () => void }) {
  const { accessToken } = useAuth();
  const { refetch } = useEvents(accessToken);
  const { eventTypes } = useEventTypes(accessToken);

  const [step, setStep] = useState<1 | 2>(1);
  const [infoData, setInfoData] = useState<FestivalInfoData>(EMPTY_INFO);
  const [days, setDays] = useState<DayConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    setDays(generateDaysFromRange(infoData.startDate, infoData.endDate));
    setStep(2);
  };

  const handleSubmit = async () => {
    const festivalType = eventTypes.find(et => et.name === 'Festival');
    if (!festivalType || !accessToken) return;

    setSaving(true);
    setError(null);
    try {
      // 1. Create the event
      const eventPayload: EventPayload = {
        name: infoData.name,
        status: infoData.status,
        event_type_id: festivalType.id,
        type: infoData.accessType,
        start_date: `${infoData.startDate}T${infoData.startTime}:00`,
        end_date: `${infoData.endDate}T${infoData.endTime}:00`,
        duration: Number(infoData.duration),
        room_id: Number(infoData.roomId),
        capacity: Number(infoData.capacity),
        level_id: infoData.levelId ? Number(infoData.levelId) : null,
        artist_ids: infoData.selectedArtists.map(a => a.id),
        genre_ids: infoData.selectedGenres.map(g => g.id),
        style_ids: infoData.selectedStyles.map(s => s.id),
        info: infoData.info || null,
        multi_events: true,
      };

      const eventRes = await authFetch('/api/events/events/', accessToken, {
        method: 'POST',
        body: JSON.stringify(eventPayload),
      });
      if (!eventRes.ok) {
        const body = await eventRes.json().catch(() => ({}));
        throw new Error(JSON.stringify(body));
      }
      const createdEvent = await eventRes.json();

      // 2. Create festival days and their rooms
      for (const day of days) {
        const dayRes = await authFetch('/api/festival/festival-days/', accessToken, {
          method: 'POST',
          body: JSON.stringify({ event_id: createdEvent.id, date: day.date }),
        });
        if (!dayRes.ok) throw new Error(`Failed to create day ${day.date}`);
        const createdDay = await dayRes.json();

        for (const room of day.rooms) {
          const roomRes = await authFetch('/api/festival/festival-rooms/', accessToken, {
            method: 'POST',
            body: JSON.stringify({ festival_day: createdDay.id, room_id: room.id }),
          });
          if (!roomRes.ok) throw new Error(`Failed to assign room "${room.name}" to ${day.date}`);
        }
      }

      await refetch();
      onComplete(createdEvent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create festival.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <StepIndicator step={step} />
      {step === 1 && (
        <FestivalInfoStep
          data={infoData}
          onChange={setInfoData}
          onNext={handleNext}
          onCancel={onCancel}
        />
      )}
      {step === 2 && (
        <FestivalDaysStep
          infoData={infoData}
          days={days}
          onDaysChange={setDays}
          onBack={() => setStep(1)}
          onSubmit={handleSubmit}
          saving={saving}
          error={error}
        />
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function FestivalPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { events, loading, refetch, remove } = useEvents(accessToken);

  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedFestival, setSelectedFestival] = useState<EventItem | null>(null);

  const festivals = events.filter(e => e.event_type.name === 'Festival');

  // Keep selectedFestival in sync if events reload
  const activeFestival = selectedFestival
    ? (events.find(e => e.id === selectedFestival.id) ?? selectedFestival)
    : null;

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await remove(id); }
    finally { setDeletingId(null); }
  };

  // Show grid view when a festival is selected
  if (activeFestival) {
    return <FestivalGrid festival={activeFestival} onBack={() => setSelectedFestival(null)} />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{language === 'it' ? 'Festival' : 'Festivals'}</CardTitle>
            <CardDescription>
              {language === 'it' ? 'Gestisci i festival multi-giorno' : 'Manage multi-day festivals'}
            </CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-2" />{language === 'it' ? 'Nuovo Festival' : 'New Festival'}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{language === 'it' ? 'Crea Festival' : 'Create Festival'}</DialogTitle>
                <DialogDescription>
                  {language === 'it' ? 'Configura il festival in due passi.' : 'Set up your festival in two steps.'}
                </DialogDescription>
              </DialogHeader>
              <FestivalWizard
                onComplete={festival => { setAddOpen(false); setSelectedFestival(festival); }}
                onCancel={() => setAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-gray-400" />
          </div>
        )}
        {!loading && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'it' ? 'Nome' : 'Name'}</TableHead>
                <TableHead>{language === 'it' ? 'Stato' : 'Status'}</TableHead>
                <TableHead>{language === 'it' ? 'Inizio' : 'Start'}</TableHead>
                <TableHead>{language === 'it' ? 'Fine' : 'End'}</TableHead>
                <TableHead>{language === 'it' ? 'Capienza' : 'Capacity'}</TableHead>
                <TableHead>Info</TableHead>
                <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {festivals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    {language === 'it' ? 'Nessun festival.' : 'No festivals yet.'}
                  </TableCell>
                </TableRow>
              )}
              {festivals.map(f => (
                <TableRow key={f.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedFestival(f)}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell><Badge variant="outline">{f.status}</Badge></TableCell>
                  <TableCell>{new Date(f.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell>{new Date(f.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell>{f.capacity}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm text-gray-500">{f.info || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" disabled={deletingId === f.id} onClick={e => { e.stopPropagation(); handleDelete(f.id); }}>
                        {deletingId === f.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
