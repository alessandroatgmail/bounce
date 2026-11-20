import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Loader2, Plus, Pencil, Trash2, FileDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { authFetch } from '../../lib/api';
import { type AccommodationRoomType, type EventDetail, type EventSimple } from '../hooks/useEvents';
import { useAccommodationTypes, type AccommodationType } from '../hooks/useAccommodationTypes';
import {
  useAccommodationRooms, useAccommodationTypeOccupancy,
  type AccommodationRoom, type AccommodationRoomPayload,
} from '../hooks/useAccommodationRooms';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { exportAccommodationRoomsPdf } from '../lib/accommodationRoomsPdf';

function FestivalRegisterTab() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [events, setEvents] = useState<EventSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChildren = useCallback(async () => {
    if (!accessToken || !eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/events/events/${eventId}/detail/`, accessToken);
      if (!res.ok) throw new Error(`${res.status}`);
      const data: EventDetail = await res.json();
      setEvents(data.events);
    } catch {
      setError(language === 'it' ? 'Errore nel caricamento degli eventi.' : 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, eventId, language]);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'it' ? 'Nome' : 'Name'}</TableHead>
                  <TableHead>{language === 'it' ? 'Livello' : 'Level'}</TableHead>
                  <TableHead>{language === 'it' ? 'Sala' : 'Room'}</TableHead>
                  <TableHead>{language === 'it' ? 'Inizio' : 'Start'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                      {language === 'it' ? 'Nessun evento.' : 'No events yet.'}
                    </TableCell>
                  </TableRow>
                ) : events.map(ev => (
                  <TableRow
                    key={ev.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/admin/events/${ev.id}/register`, {
                      state: { from: `/admin/festivals/${eventId}/manage` },
                    })}
                  >
                    <TableCell className="font-medium">{ev.name}</TableCell>
                    <TableCell>{ev.level?.name ?? '—'}</TableCell>
                    <TableCell>{ev.room.name}</TableCell>
                    <TableCell>
                      {new Date(ev.start_date).toLocaleString(language === 'it' ? 'it-IT' : 'en-GB', {
                        dateStyle: 'short', timeStyle: 'short',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserMultiSearch({
  selected, onChange,
}: {
  selected: { id: number; name: string }[];
  onChange: (selected: { id: number; name: string }[]) => void;
}) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!accessToken || !debounced) { setResults([]); return; }
    setLoading(true);
    authFetch(
      `/api/auth/users/?name=${encodeURIComponent(debounced)}&page_size=20`,
      accessToken,
    )
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) {
          setResults(data.results.map((u: { id: number; first_name: string; last_name: string; email: string }) => ({
            id: u.id, name: `${u.first_name} ${u.last_name} (${u.email})`,
          })));
        }
      })
      .finally(() => setLoading(false));
  }, [accessToken, debounced]);

  const filtered = results.filter(r => !selected.some(s => s.id === r.id));

  const add = (item: { id: number; name: string }) => {
    onChange([...selected, item]);
    setSearch('');
    setOpen(false);
  };

  const remove = (id: number) => onChange(selected.filter(s => s.id !== id));

  return (
    <div className="space-y-2">
      <Label>{language === 'it' ? 'Ospiti' : 'Occupants'}</Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(item => (
            <span key={item.id} className="flex items-center gap-1 bg-[#d4b896]/30 text-[#2b2b2b] text-sm px-2 py-1 rounded-full">
              {item.name}
              <button type="button" onClick={() => remove(item.id)} className="ml-1 text-gray-500 hover:text-red-500 leading-none">&times;</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          placeholder={language === 'it' ? 'Cerca per nome o email…' : 'Search by name or email…'}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && debounced && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-2 text-sm text-gray-500">{language === 'it' ? 'Ricerca…' : 'Searching…'}</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">{language === 'it' ? 'Nessun risultato' : 'No results'}</p>
            ) : (
              filtered.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#d4b896]/20"
                  onMouseDown={() => add(item)}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ROOM_TYPES: { value: AccommodationRoomType; labelIt: string; labelEn: string }[] = [
  { value: 'mixed', labelIt: 'Camera mista', labelEn: 'Mixed room' },
  { value: 'all males', labelIt: 'Camera solo uomini', labelEn: 'Men-only room' },
  { value: 'females', labelIt: 'Camera solo donne', labelEn: 'Women-only room' },
  { value: 'friends', labelIt: 'Camera con amici', labelEn: 'Room with friends' },
];

interface AccommodationRoomFormProps {
  eventId: number;
  accommodationTypes: AccommodationType[];
  initial?: { extra_item_id: number | ''; type?: AccommodationRoomType };
  initialUsers?: { id: number; name: string }[];
  onSubmit: (data: AccommodationRoomPayload) => Promise<void>;
  onCancel: () => void;
}

function AccommodationRoomForm({
  eventId, accommodationTypes, initial, initialUsers = [], onSubmit, onCancel,
}: AccommodationRoomFormProps) {
  const { language } = useLanguage();
  const [extraItemId, setExtraItemId] = useState<number | ''>(initial?.extra_item_id ?? '');
  const [roomType, setRoomType] = useState<AccommodationRoomType>(initial?.type ?? 'mixed');
  const [selectedUsers, setSelectedUsers] = useState<{ id: number; name: string }[]>(initialUsers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraItemId) {
      setError(language === 'it' ? 'Seleziona un tipo di alloggio.' : 'Please select an accommodation type.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        extra_item_id: extraItemId,
        event_id: eventId,
        type: roomType,
        user_ids: selectedUsers.map(u => u.id),
      });
    } catch {
      setError(language === 'it' ? 'Errore durante il salvataggio.' : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>{language === 'it' ? 'Tipo di Alloggio' : 'Accommodation Type'}</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          value={extraItemId}
          onChange={e => setExtraItemId(e.target.value ? Number(e.target.value) : '')}
          required
        >
          <option value="">{language === 'it' ? 'Seleziona...' : 'Select...'}</option>
          {accommodationTypes.map(t => (
            <option key={t.extra_item.id} value={t.extra_item.id}>
              {t.extra_item.name} — {t.location.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>{language === 'it' ? 'Tipo di Camera' : 'Room Type'}</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          value={roomType}
          onChange={e => setRoomType(e.target.value as AccommodationRoomType)}
        >
          {ROOM_TYPES.map(rt => (
            <option key={rt.value} value={rt.value}>
              {language === 'it' ? rt.labelIt : rt.labelEn}
            </option>
          ))}
        </select>
      </div>

      <UserMultiSearch
        selected={selectedUsers}
        onChange={setSelectedUsers}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {language === 'it' ? 'Annulla' : 'Cancel'}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
          {language === 'it' ? 'Salva' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

function AccommodationTab() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { eventId } = useParams();
  const numericEventId = eventId ? Number(eventId) : null;

  const [availableExtraItemIds, setAvailableExtraItemIds] = useState<number[]>([]);
  const [festivalName, setFestivalName] = useState('');
  useEffect(() => {
    if (!accessToken || !eventId) return;
    authFetch(`/api/events/events/${eventId}/detail/`, accessToken)
      .then(res => (res.ok ? res.json() : null))
      .then((data: EventDetail | null) => {
        if (data) {
          setAvailableExtraItemIds(data.available_extra_items.map(i => i.id));
          setFestivalName(data.name);
        }
      })
      .catch(() => {});
  }, [accessToken, eventId]);

  const { accommodationTypes, loading: loadingTypes } = useAccommodationTypes(accessToken);
  const relevantTypes = accommodationTypes.filter(t => availableExtraItemIds.includes(t.extra_item.id));

  const [typeFilter, setTypeFilter] = useState<number | ''>('');
  const [nameFilter, setNameFilter] = useState('');
  const [debouncedNameFilter, setDebouncedNameFilter] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedNameFilter(nameFilter), 300);
    return () => clearTimeout(timer);
  }, [nameFilter]);

  const { rooms, loading: loadingRooms, create, update, remove } = useAccommodationRooms(
    accessToken, numericEventId, { extra_item: typeFilter, name: debouncedNameFilter },
  );
  const { occupancy, refetch: refetchOccupancy } = useAccommodationTypeOccupancy(accessToken, numericEventId);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AccommodationRoom | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await remove(id); await refetchOccupancy(); } finally { setDeletingId(null); }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{language === 'it' ? 'Tipi di Alloggio' : 'Accommodation Types'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTypes ? (
            <Loader2 className="size-5 animate-spin text-gray-400" />
          ) : relevantTypes.length === 0 ? (
            <p className="text-sm text-gray-400">
              {language === 'it'
                ? 'Nessun tipo di alloggio associato a questo evento.'
                : 'No accommodation type linked to this event.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relevantTypes.map(t => (
                <div key={t.id} className="rounded-md border p-3 space-y-1">
                  <p className="font-medium">{t.extra_item.name}</p>
                  <p className="text-xs text-gray-500">{t.location.name}</p>
                  <p className="text-xs text-gray-500">
                    {language === 'it' ? 'Capienza' : 'Capacity'}: {t.occupants_per_room} ·{' '}
                    {language === 'it' ? 'Stanze' : 'Rooms'}: {t.available_rooms}
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {language === 'it' ? 'Occupazione' : 'Occupancy'}: {occupancy[t.extra_item.id]?.occupancy_rate ?? `0/${t.available_rooms}`}
                    </Badge>
                    <Badge variant="outline">
                      {language === 'it' ? 'Pagato' : 'Paid'}: {occupancy[t.extra_item.id]?.full_paid_rate ?? `0/${t.available_rooms}`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{language === 'it' ? 'Camere' : 'Rooms'}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={rooms.length === 0}
                onClick={() => { void exportAccommodationRoomsPdf(festivalName, relevantTypes, rooms, language); }}
              >
                <FileDown className="size-4 mr-2" />
                {language === 'it' ? 'Esporta PDF' : 'Export PDF'}
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button disabled={!numericEventId}>
                  <Plus className="size-4 mr-2" />
                  {language === 'it' ? 'Aggiungi' : 'Add'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{language === 'it' ? 'Nuova Camera' : 'New Room'}</DialogTitle>
                </DialogHeader>
                {numericEventId && (
                  <AccommodationRoomForm
                    eventId={numericEventId}
                    accommodationTypes={relevantTypes}
                    onSubmit={async data => { await create(data); await refetchOccupancy(); setAddOpen(false); }}
                    onCancel={() => setAddOpen(false)}
                  />
                )}
              </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <select
              className="flex h-9 w-56 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">{language === 'it' ? 'Tutti i tipi' : 'All types'}</option>
              {relevantTypes.map(t => (
                <option key={t.extra_item.id} value={t.extra_item.id}>{t.extra_item.name}</option>
              ))}
            </select>
            <Input
              className="w-64"
              placeholder={language === 'it' ? 'Cerca ospite…' : 'Search occupant…'}
              value={nameFilter}
              onChange={e => setNameFilter(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loadingRooms ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'it' ? 'Tipo' : 'Type'}</TableHead>
                  <TableHead>{language === 'it' ? 'Tipo di Camera' : 'Room Type'}</TableHead>
                  <TableHead>{language === 'it' ? 'Ospiti' : 'Occupants'}</TableHead>
                  <TableHead>{language === 'it' ? 'Occupazione' : 'Occupation'}</TableHead>
                  <TableHead>{language === 'it' ? 'Pagato' : 'Paid'}</TableHead>
                  <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                      {language === 'it' ? 'Nessuna camera.' : 'No rooms yet.'}
                    </TableCell>
                  </TableRow>
                ) : rooms.map(room => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.extra_item.name}</TableCell>
                    <TableCell>
                      {(() => {
                        const rt = ROOM_TYPES.find(r => r.value === room.type);
                        return rt ? (language === 'it' ? rt.labelIt : rt.labelEn) : room.type;
                      })()}
                    </TableCell>
                    <TableCell>
                      {room.users.length === 0
                        ? '—'
                        : room.users.map(u => `${u.first_name} ${u.last_name}`).join(', ')}
                    </TableCell>
                    <TableCell>{room.occupation_rate ?? '—'}</TableCell>
                    <TableCell>{room.paid_occupation_rate ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog open={editing?.id === room.id} onOpenChange={open => !open && setEditing(null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(room)}>
                              <Pencil className="size-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{language === 'it' ? 'Modifica Camera' : 'Edit Room'}</DialogTitle>
                            </DialogHeader>
                            {numericEventId && (
                              <AccommodationRoomForm
                                eventId={numericEventId}
                                accommodationTypes={relevantTypes}
                                initial={{ extra_item_id: room.extra_item.id, type: room.type }}
                                initialUsers={room.users.map(u => ({
                                  id: u.id, name: `${u.first_name} ${u.last_name} (${u.email})`,
                                }))}
                                onSubmit={async data => { await update(room.id, data); await refetchOccupancy(); setEditing(null); }}
                                onCancel={() => setEditing(null)}
                              />
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          disabled={deletingId === room.id}
                          onClick={() => handleDelete(room.id)}
                        >
                          {deletingId === room.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
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
    </div>
  );
}

export function FestivalManagePage() {
  const { language } = useLanguage();

  return (
    <Tabs defaultValue="register">
      <div className="bg-gray-50 pt-6 px-4">
        <TabsList className="container mx-auto">
          <TabsTrigger value="register">{language === 'it' ? 'Registri' : 'Register'}</TabsTrigger>
          <TabsTrigger value="accommodation">{language === 'it' ? 'Camere' : 'Accommodation'}</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="register">
        <FestivalRegisterTab />
      </TabsContent>
      <TabsContent value="accommodation">
        <AccommodationTab />
      </TabsContent>
    </Tabs>
  );
}
