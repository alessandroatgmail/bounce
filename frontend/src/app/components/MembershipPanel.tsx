import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useMemberships, Membership, MembershipPayload, MEMBERSHIP_TYPES } from '../hooks/useMemberships';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';

const EMPTY: MembershipPayload = {
  name: '',
  type: 'single',
  contribution: 0,
  max_courses: 0,
  max_parties: 0,
  color: null,
  event_ids: [],
};

interface FormProps {
  initial?: MembershipPayload;
  onSubmit: (data: MembershipPayload) => Promise<void>;
  onCancel: () => void;
}

function MembershipForm({ initial = EMPTY, onSubmit, onCancel }: FormProps) {
  const { language } = useLanguage();
  const [form, setForm] = useState<MembershipPayload>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof MembershipPayload>(field: K, value: MembershipPayload[K]) =>
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
        <div className="col-span-2 space-y-2">
          <Label htmlFor="m-name">{language === 'it' ? 'Nome' : 'Name'} *</Label>
          <Input
            id="m-name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>{language === 'it' ? 'Tipo' : 'Type'}</Label>
          <Select value={form.type} onValueChange={v => set('type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MEMBERSHIP_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="m-contribution">{language === 'it' ? 'Quota (€)' : 'Contribution (€)'}</Label>
          <Input
            id="m-contribution"
            type="number"
            min={0}
            value={form.contribution}
            onChange={e => set('contribution', parseInt(e.target.value) || 0)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="m-courses">{language === 'it' ? 'Max Corsi' : 'Max Courses'}</Label>
          <Input
            id="m-courses"
            type="number"
            min={0}
            value={form.max_courses}
            onChange={e => set('max_courses', parseInt(e.target.value) || 0)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="m-parties">{language === 'it' ? 'Max Feste' : 'Max Parties'}</Label>
          <Input
            id="m-parties"
            type="number"
            min={0}
            value={form.max_parties}
            onChange={e => set('max_parties', parseInt(e.target.value) || 0)}
          />
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="m-color">{language === 'it' ? 'Colore' : 'Color'}</Label>
          <div className="flex gap-3 items-center">
            <input
              id="m-color"
              type="color"
              value={form.color ?? '#e67e22'}
              onChange={e => set('color', e.target.value)}
              className="h-9 w-16 rounded border cursor-pointer p-1"
            />
            <Input
              value={form.color ?? ''}
              onChange={e => set('color', e.target.value || null)}
              placeholder="#rrggbb"
              className="flex-1"
            />
            {form.color && (
              <Button type="button" variant="ghost" size="sm" onClick={() => set('color', null)}>
                {language === 'it' ? 'Rimuovi' : 'Clear'}
              </Button>
            )}
          </div>
        </div>
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

export function MembershipPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { memberships, loading, error, create, update, remove } = useMemberships(accessToken);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async (data: MembershipPayload) => {
    await create(data);
    setAddOpen(false);
  };

  const handleUpdate = async (data: MembershipPayload) => {
    if (!editing) return;
    await update(editing.id, data);
    setEditing(null);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await remove(id);
    } finally {
      setDeletingId(null);
    }
  };

  const toPayload = (m: Membership): MembershipPayload => ({
    name: m.name,
    type: m.type,
    contribution: m.contribution,
    max_courses: m.max_courses,
    max_parties: m.max_parties,
    color: m.color,
    event_ids: m.events,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{language === 'it' ? 'Piani di Iscrizione' : 'Membership Plans'}</CardTitle>
            <CardDescription>
              {language === 'it' ? 'Gestisci i piani di iscrizione' : 'Manage membership plans'}
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
                <DialogTitle>{language === 'it' ? 'Nuovo Piano' : 'New Membership Plan'}</DialogTitle>
                <DialogDescription>
                  {language === 'it' ? 'Crea un nuovo piano di iscrizione.' : 'Create a new membership plan.'}
                </DialogDescription>
              </DialogHeader>
              <MembershipForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} />
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
                <TableHead>{language === 'it' ? 'Tipo' : 'Type'}</TableHead>
                <TableHead>{language === 'it' ? 'Quota' : 'Contribution'}</TableHead>
                <TableHead>{language === 'it' ? 'Max Corsi' : 'Max Courses'}</TableHead>
                <TableHead>{language === 'it' ? 'Max Feste' : 'Max Parties'}</TableHead>
                <TableHead>{language === 'it' ? 'Colore' : 'Color'}</TableHead>
                <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    {language === 'it' ? 'Nessun piano di iscrizione.' : 'No membership plans yet.'}
                  </TableCell>
                </TableRow>
              )}
              {memberships.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.type}</Badge>
                  </TableCell>
                  <TableCell>€{m.contribution}</TableCell>
                  <TableCell>{m.max_courses}</TableCell>
                  <TableCell>{m.max_parties}</TableCell>
                  <TableCell>
                    {m.color ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block size-5 rounded border"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-xs text-gray-500">{m.color}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog open={editing?.id === m.id} onOpenChange={open => !open && setEditing(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                            <Pencil className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>{language === 'it' ? 'Modifica Piano' : 'Edit Membership Plan'}</DialogTitle>
                            <DialogDescription>{m.name}</DialogDescription>
                          </DialogHeader>
                          <MembershipForm
                            initial={toPayload(m)}
                            onSubmit={handleUpdate}
                            onCancel={() => setEditing(null)}
                          />
                        </DialogContent>
                      </Dialog>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        disabled={deletingId === m.id}
                        onClick={() => handleDelete(m.id)}
                      >
                        {deletingId === m.id
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
