import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useAccommodationTypes, AccommodationType, AccommodationTypePayload } from '../hooks/useAccommodationTypes';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

const EMPTY: AccommodationTypePayload = {
  extra_item: {
    name: '', name_it: '', name_en: '', value: '',
    description: '', description_en: '', description_en_it: '',
    expiration_date: '2027-12-31',
  },
  location_id: '',
  occupants_per_room: '',
  available_rooms: '',
};

interface FormProps {
  initial?: AccommodationTypePayload;
  onSubmit: (data: AccommodationTypePayload) => Promise<void>;
  onCancel: () => void;
}

function AccommodationTypeForm({ initial = EMPTY, onSubmit, onCancel }: FormProps) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { locations, loading: locationsLoading } = useLocations(accessToken);
  const [form, setForm] = useState<AccommodationTypePayload>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setExtraItem = (field: keyof AccommodationTypePayload['extra_item'], value: string) =>
    setForm(f => ({ ...f, extra_item: { ...f.extra_item, [field]: value } }));

  const set = <K extends keyof AccommodationTypePayload>(field: K, value: AccommodationTypePayload[K]) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location_id) {
      setError(language === 'it' ? 'Seleziona una sede.' : 'Please select a location.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch {
      setError(language === 'it' ? 'Errore durante il salvataggio.' : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{language === 'it' ? 'Nome' : 'Name'}</Label>
          <Input value={form.extra_item.name} onChange={e => setExtraItem('name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>{language === 'it' ? 'Prezzo' : 'Price'}</Label>
          <Input type="number" min={0} step="0.01" value={form.extra_item.value}
            onChange={e => setExtraItem('value', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>{language === 'it' ? 'Nome (IT)' : 'Name (IT)'}</Label>
          <Input value={form.extra_item.name_it} onChange={e => setExtraItem('name_it', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>{language === 'it' ? 'Nome (EN)' : 'Name (EN)'}</Label>
          <Input value={form.extra_item.name_en} onChange={e => setExtraItem('name_en', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>{language === 'it' ? 'Scadenza vendita' : 'Sale expiration'}</Label>
          <Input type="date" value={form.extra_item.expiration_date}
            onChange={e => setExtraItem('expiration_date', e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{language === 'it' ? 'Sede / Hotel' : 'Location / Hotel'}</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          value={form.location_id}
          onChange={e => set('location_id', e.target.value ? Number(e.target.value) : '')}
          disabled={locationsLoading}
          required
        >
          <option value="">{language === 'it' ? 'Seleziona una sede...' : 'Select a location...'}</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{language === 'it' ? 'Occupanti per stanza' : 'Occupants per room'}</Label>
          <Input type="number" min={1} value={form.occupants_per_room}
            onChange={e => set('occupants_per_room', e.target.value ? Number(e.target.value) : '')} required />
        </div>
        <div className="space-y-2">
          <Label>{language === 'it' ? 'Stanze disponibili' : 'Available rooms'}</Label>
          <Input type="number" min={0} value={form.available_rooms}
            onChange={e => set('available_rooms', e.target.value ? Number(e.target.value) : '')} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{language === 'it' ? 'Descrizione' : 'Description'}</Label>
        <Textarea rows={2} value={form.extra_item.description}
          onChange={e => setExtraItem('description', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{language === 'it' ? 'Descrizione (IT)' : 'Description (IT)'}</Label>
        <Textarea rows={2} value={form.extra_item.description_en_it}
          onChange={e => setExtraItem('description_en_it', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{language === 'it' ? 'Descrizione (EN)' : 'Description (EN)'}</Label>
        <Textarea rows={2} value={form.extra_item.description_en}
          onChange={e => setExtraItem('description_en', e.target.value)} />
      </div>

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

export function AccommodationTypePanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { accommodationTypes, loading, error, create, update, remove } = useAccommodationTypes(accessToken);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AccommodationType | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async (data: AccommodationTypePayload) => {
    await create(data);
    setAddOpen(false);
  };

  const handleUpdate = async (data: AccommodationTypePayload) => {
    if (!editing) return;
    await update(editing.id, data);
    setEditing(null);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await remove(id); } finally { setDeletingId(null); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{language === 'it' ? 'Tipi di Alloggio' : 'Accommodation Types'}</CardTitle>
            <CardDescription>
              {language === 'it' ? 'Gestisci i tipi di alloggio disponibili' : 'Manage the available accommodation types'}
            </CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4 mr-2" />
                {language === 'it' ? 'Aggiungi' : 'Add'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{language === 'it' ? 'Nuovo Tipo di Alloggio' : 'New Accommodation Type'}</DialogTitle>
                <DialogDescription>
                  {language === 'it'
                    ? 'Compila i campi per creare un nuovo tipo di alloggio.'
                    : 'Fill in the fields to create a new accommodation type.'}
                </DialogDescription>
              </DialogHeader>
              <AccommodationTypeForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} />
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

        {error && <p className="text-sm text-red-500 py-4">{error}</p>}

        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'it' ? 'Nome' : 'Name'}</TableHead>
                <TableHead>{language === 'it' ? 'Sede' : 'Location'}</TableHead>
                <TableHead>{language === 'it' ? 'Prezzo' : 'Price'}</TableHead>
                <TableHead>{language === 'it' ? 'Occupanti' : 'Occupants'}</TableHead>
                <TableHead>{language === 'it' ? 'Stanze' : 'Rooms'}</TableHead>
                <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accommodationTypes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    {language === 'it' ? 'Nessun tipo di alloggio.' : 'No accommodation types yet.'}
                  </TableCell>
                </TableRow>
              )}
              {accommodationTypes.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.extra_item.name}</TableCell>
                  <TableCell>{item.location.name}</TableCell>
                  <TableCell>{item.extra_item.value}</TableCell>
                  <TableCell>{item.occupants_per_room}</TableCell>
                  <TableCell>{item.available_rooms}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog open={editing?.id === item.id} onOpenChange={open => !open && setEditing(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                            <Pencil className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{language === 'it' ? 'Modifica Tipo di Alloggio' : 'Edit Accommodation Type'}</DialogTitle>
                            <DialogDescription>{item.extra_item.name}</DialogDescription>
                          </DialogHeader>
                          <AccommodationTypeForm
                            initial={{
                              extra_item: {
                                name: item.extra_item.name,
                                name_it: item.extra_item.name_it,
                                name_en: item.extra_item.name_en,
                                value: item.extra_item.value,
                                description: item.extra_item.description ?? '',
                                description_en: item.extra_item.description_en ?? '',
                                description_en_it: item.extra_item.description_en_it ?? '',
                                expiration_date: item.extra_item.expiration_date.slice(0, 10),
                              },
                              location_id: item.location.id,
                              occupants_per_room: item.occupants_per_room,
                              available_rooms: item.available_rooms,
                            }}
                            onSubmit={handleUpdate}
                            onCancel={() => setEditing(null)}
                          />
                        </DialogContent>
                      </Dialog>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id)}
                      >
                        {deletingId === item.id
                          ? <Loader2 className="size-4 animate-spin" />
                          : <Trash2 className="size-4" />}
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
