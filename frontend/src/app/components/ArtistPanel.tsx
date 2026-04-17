import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useArtists, Artist, ArtistPayload } from '../hooks/useArtists';
import { useArtistTypes } from '../hooks/useArtistTypes';
import { useStyles } from '../hooks/useStyles';
import { useGenres } from '../hooks/useGenres';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

interface MultiSelectProps {
  label: string;
  options: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              selected.includes(opt.id)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-input hover:bg-accent'
            }`}
          >
            {opt.name}
          </button>
        ))}
        {options.length === 0 && <span className="text-sm text-gray-400">—</span>}
      </div>
    </div>
  );
}

const EMPTY: ArtistPayload = { first_name: '', last_name: '', type_ids: [], style_ids: [], genre_ids: [] };

interface FormProps {
  initial?: ArtistPayload;
  onSubmit: (data: ArtistPayload) => Promise<void>;
  onCancel: () => void;
}

function ArtistForm({ initial = EMPTY, onSubmit, onCancel }: FormProps) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { artistTypes } = useArtistTypes(accessToken);
  const { styles } = useStyles(accessToken);
  const { genres } = useGenres(accessToken);

  const [form, setForm] = useState<ArtistPayload>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof ArtistPayload, value: string | number[]) =>
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{language === 'it' ? 'Nome' : 'First Name'}</Label>
          <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>{language === 'it' ? 'Cognome' : 'Last Name'}</Label>
          <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
        </div>
      </div>

      <MultiSelect
        label={language === 'it' ? 'Tipi' : 'Types'}
        options={artistTypes}
        selected={form.type_ids}
        onChange={ids => set('type_ids', ids)}
      />

      <MultiSelect
        label={language === 'it' ? 'Stili' : 'Styles'}
        options={styles}
        selected={form.style_ids}
        onChange={ids => set('style_ids', ids)}
      />

      <MultiSelect
        label={language === 'it' ? 'Generi' : 'Genres'}
        options={genres}
        selected={form.genre_ids}
        onChange={ids => set('genre_ids', ids)}
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

export function ArtistPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { artists, loading, error, create, update, remove } = useArtists(accessToken);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Artist | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async (data: ArtistPayload) => {
    await create(data);
    setAddOpen(false);
  };

  const handleUpdate = async (data: ArtistPayload) => {
    if (!editing) return;
    await update(editing.id, data);
    setEditing(null);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await remove(id); } finally { setDeletingId(null); }
  };

  const toPayload = (a: Artist): ArtistPayload => ({
    first_name: a.first_name ?? '',
    last_name: a.last_name ?? '',
    type_ids: a.types.map(t => t.id),
    style_ids: a.styles.map(s => s.id),
    genre_ids: a.genres.map(g => g.id),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{language === 'it' ? 'Artisti' : 'Artists'}</CardTitle>
            <CardDescription>
              {language === 'it' ? 'Gestisci gli artisti' : 'Manage artists'}
            </CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4 mr-2" />
                {language === 'it' ? 'Aggiungi' : 'Add'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{language === 'it' ? 'Nuovo Artista' : 'New Artist'}</DialogTitle>
                <DialogDescription>
                  {language === 'it' ? 'Compila i campi per creare un nuovo artista.' : 'Fill in the fields to create a new artist.'}
                </DialogDescription>
              </DialogHeader>
              <ArtistForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} />
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
                <TableHead>{language === 'it' ? 'Tipi' : 'Types'}</TableHead>
                <TableHead>{language === 'it' ? 'Stili' : 'Styles'}</TableHead>
                <TableHead>{language === 'it' ? 'Generi' : 'Genres'}</TableHead>
                <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artists.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    {language === 'it' ? 'Nessun artista.' : 'No artists yet.'}
                  </TableCell>
                </TableRow>
              )}
              {artists.map(artist => (
                <TableRow key={artist.id}>
                  <TableCell className="font-medium">{artist.full_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {artist.types.map(t => <Badge key={t.id} variant="secondary">{t.name}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {artist.styles.map(s => <Badge key={s.id} variant="outline">{s.name}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {artist.genres.map(g => <Badge key={g.id} variant="outline">{g.name}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog open={editing?.id === artist.id} onOpenChange={open => !open && setEditing(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(artist)}>
                            <Pencil className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>{language === 'it' ? 'Modifica Artista' : 'Edit Artist'}</DialogTitle>
                            <DialogDescription>{artist.full_name}</DialogDescription>
                          </DialogHeader>
                          <ArtistForm
                            initial={toPayload(artist)}
                            onSubmit={handleUpdate}
                            onCancel={() => setEditing(null)}
                          />
                        </DialogContent>
                      </Dialog>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        disabled={deletingId === artist.id}
                        onClick={() => handleDelete(artist.id)}
                      >
                        {deletingId === artist.id
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
