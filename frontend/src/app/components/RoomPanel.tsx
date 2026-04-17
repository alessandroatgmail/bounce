import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useRooms, Room, RoomPayload } from '../hooks/useRooms';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

const EMPTY: RoomPayload = { name: '', capacity: '', location_id: '' };

interface FormProps {
  initial?: RoomPayload;
  onSubmit: (data: RoomPayload) => Promise<void>;
  onCancel: () => void;
}

function RoomForm({ initial = EMPTY, onSubmit, onCancel }: FormProps) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { locations } = useLocations(accessToken);
  const [form, setForm] = useState<RoomPayload>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof RoomPayload, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <div className="space-y-2">
        <Label>{language === 'it' ? 'Nome' : 'Name'}</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>{language === 'it' ? 'Capienza' : 'Capacity'}</Label>
        <Input
          type="number"
          min={1}
          value={form.capacity}
          onChange={e => set('capacity', parseInt(e.target.value, 10) || '')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{language === 'it' ? 'Sede' : 'Location'}</Label>
        <Select
          value={form.location_id === '' ? '' : String(form.location_id)}
          onValueChange={v => set('location_id', parseInt(v, 10))}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder={language === 'it' ? 'Seleziona sede...' : 'Select location...'} />
          </SelectTrigger>
          <SelectContent>
            {locations.map(l => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.name} — {l.city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

export function RoomPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { rooms, loading, error, create, update, remove } = useRooms(accessToken);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async (data: RoomPayload) => {
    await create(data);
    setAddOpen(false);
  };

  const handleUpdate = async (data: RoomPayload) => {
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
            <CardTitle>{language === 'it' ? 'Sale' : 'Rooms'}</CardTitle>
            <CardDescription>
              {language === 'it' ? 'Gestisci le sale' : 'Manage rooms'}
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
                <DialogTitle>{language === 'it' ? 'Nuova Sala' : 'New Room'}</DialogTitle>
                <DialogDescription>
                  {language === 'it' ? 'Compila i campi per creare una nuova sala.' : 'Fill in the fields to create a new room.'}
                </DialogDescription>
              </DialogHeader>
              <RoomForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} />
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
                <TableHead>{language === 'it' ? 'Capienza' : 'Capacity'}</TableHead>
                <TableHead>{language === 'it' ? 'Sede' : 'Location'}</TableHead>
                <TableHead>{language === 'it' ? 'Città' : 'City'}</TableHead>
                <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    {language === 'it' ? 'Nessuna sala.' : 'No rooms yet.'}
                  </TableCell>
                </TableRow>
              )}
              {rooms.map(room => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell>{room.capacity}</TableCell>
                  <TableCell>{room.location.name}</TableCell>
                  <TableCell>{room.location.city.name}</TableCell>
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
                            <DialogTitle>{language === 'it' ? 'Modifica Sala' : 'Edit Room'}</DialogTitle>
                            <DialogDescription>{room.name}</DialogDescription>
                          </DialogHeader>
                          <RoomForm
                            initial={{ name: room.name, capacity: room.capacity, location_id: room.location.id }}
                            onSubmit={handleUpdate}
                            onCancel={() => setEditing(null)}
                          />
                        </DialogContent>
                      </Dialog>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        disabled={deletingId === room.id}
                        onClick={() => handleDelete(room.id)}
                      >
                        {deletingId === room.id
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
