import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useLocations, Location, LocationPayload } from '../hooks/useLocations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { authFetch } from '../../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

interface CityOption { id: number; name: string; country_name: string; }

interface CitySearchProps {
  token: string | null;
  value: CityOption | null;
  onChange: (city: CityOption | null) => void;
}

function CitySearch({ token, value, onChange }: CitySearchProps) {
  const { language } = useLanguage();
  const [query, setQuery] = useState(value ? `${value.name}, ${value.country_name}` : '');
  const [results, setResults] = useState<CityOption[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    setQuery(q);
    onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/auth/cities/?q=${encodeURIComponent(q)}`, token);
        if (res.ok) {
          const data: CityOption[] = await res.json();
          setResults(data);
          setOpen(data.length > 0);
        }
      } catch { /* ignore */ }
    }, 300);
  };

  const select = (city: CityOption) => {
    onChange(city);
    setQuery(`${city.name}, ${city.country_name}`);
    setOpen(false);
    setResults([]);
  };

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={e => search(e.target.value)}
        placeholder={language === 'it' ? 'Cerca città...' : 'Search city...'}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 w-full mt-1 bg-white border rounded shadow-md max-h-48 overflow-y-auto text-sm">
          {results.map(c => (
            <li
              key={c.id}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              onMouseDown={() => select(c)}
            >
              {c.name}, {c.country_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const EMPTY: LocationPayload = { name: '', address: '', city_id: '' };

interface FormProps {
  initial?: LocationPayload;
  initialCity?: CityOption | null;
  onSubmit: (data: LocationPayload) => Promise<void>;
  onCancel: () => void;
}

function LocationForm({ initial = EMPTY, initialCity = null, onSubmit, onCancel }: FormProps) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const [form, setForm] = useState<LocationPayload>(initial);
  const [city, setCity] = useState<CityOption | null>(initialCity);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof LocationPayload, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city) {
      setError(language === 'it' ? 'Seleziona una città.' : 'Please select a city.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...form, city_id: city.id });
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
        <Label>{language === 'it' ? 'Indirizzo' : 'Address'}</Label>
        <Input value={form.address} onChange={e => set('address', e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>{language === 'it' ? 'Città' : 'City'}</Label>
        <CitySearch token={accessToken} value={city} onChange={setCity} />
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

export function LocationPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { locations, loading, error, create, update, remove } = useLocations(accessToken);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async (data: LocationPayload) => {
    await create(data);
    setAddOpen(false);
  };

  const handleUpdate = async (data: LocationPayload) => {
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
            <CardTitle>{language === 'it' ? 'Sedi' : 'Locations'}</CardTitle>
            <CardDescription>
              {language === 'it' ? 'Gestisci le sedi' : 'Manage locations'}
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
                <DialogTitle>{language === 'it' ? 'Nuova Sede' : 'New Location'}</DialogTitle>
                <DialogDescription>
                  {language === 'it' ? 'Compila i campi per creare una nuova sede.' : 'Fill in the fields to create a new location.'}
                </DialogDescription>
              </DialogHeader>
              <LocationForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} />
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
                <TableHead>{language === 'it' ? 'Indirizzo' : 'Address'}</TableHead>
                <TableHead>{language === 'it' ? 'Città' : 'City'}</TableHead>
                <TableHead>{language === 'it' ? 'Paese' : 'Country'}</TableHead>
                <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    {language === 'it' ? 'Nessuna sede.' : 'No locations yet.'}
                  </TableCell>
                </TableRow>
              )}
              {locations.map(loc => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell>{loc.address}</TableCell>
                  <TableCell>{loc.city.name}</TableCell>
                  <TableCell>{loc.city.country}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog open={editing?.id === loc.id} onOpenChange={open => !open && setEditing(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(loc)}>
                            <Pencil className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{language === 'it' ? 'Modifica Sede' : 'Edit Location'}</DialogTitle>
                            <DialogDescription>{loc.name}</DialogDescription>
                          </DialogHeader>
                          <LocationForm
                            initial={{ name: loc.name, address: loc.address, city_id: loc.city.id }}
                            initialCity={{ id: loc.city.id, name: loc.city.name, country_name: loc.city.country }}
                            onSubmit={handleUpdate}
                            onCancel={() => setEditing(null)}
                          />
                        </DialogContent>
                      </Dialog>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        disabled={deletingId === loc.id}
                        onClick={() => handleDelete(loc.id)}
                      >
                        {deletingId === loc.id
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
