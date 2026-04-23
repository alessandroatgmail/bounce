import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useMemberships, Membership, MembershipPayload, MembershipRule, MEMBERSHIP_TYPES } from '../hooks/useMemberships';
import { useEventTypes } from '../hooks/useEventTypes';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';

interface RuleDraft {
  id?: number;
  event_type_id: number | '';
  max_events: number;
}

const EMPTY_PAYLOAD: MembershipPayload = {
  name: '',
  type: 'single',
  contribution: 0,
  color: null,
  max_events: 0,
  duration: 1,
};

interface FormProps {
  initial?: MembershipPayload;
  initialRules?: RuleDraft[];
  eventTypeOptions: { id: number; name: string }[];
  onSubmit: (data: MembershipPayload, rules: RuleDraft[]) => Promise<void>;
  onCancel: () => void;
}

function MembershipForm({ initial = EMPTY_PAYLOAD, initialRules = [], eventTypeOptions, onSubmit, onCancel }: FormProps) {
  const { language } = useLanguage();
  const [form, setForm] = useState<MembershipPayload>(initial);
  const [rules, setRules] = useState<RuleDraft[]>(initialRules);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof MembershipPayload>(field: K, value: MembershipPayload[K]) =>
    setForm(f => ({ ...f, [field]: value }));

  const addRule = () => setRules(r => [...r, { event_type_id: '', max_events: 1 }]);

  const removeRule = (i: number) => setRules(r => r.filter((_, j) => j !== i));

  const updateRule = (i: number, patch: Partial<RuleDraft>) =>
    setRules(r => r.map((row, j) => j === i ? { ...row, ...patch } : row));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form, rules);
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
          <Label htmlFor="m-max-events">{language === 'it' ? 'Max eventi' : 'Max events'}</Label>
          <Input
            id="m-max-events"
            type="number"
            min={0}
            value={form.max_events}
            onChange={e => set('max_events', parseInt(e.target.value) || 0)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="m-duration">{language === 'it' ? 'Durata (mesi)' : 'Duration (months)'}</Label>
          <Input
            id="m-duration"
            type="number"
            min={0}
            value={form.duration}
            onChange={e => set('duration', parseInt(e.target.value) || 0)}
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

        {/* Rules section */}
        <div className="col-span-2 space-y-2">
          <div className="flex justify-between items-center">
            <Label>{language === 'it' ? 'Regole per tipo evento' : 'Rules by event type'}</Label>
            <Button type="button" variant="outline" size="sm" onClick={addRule}>
              <Plus className="size-3 mr-1" />
              {language === 'it' ? 'Aggiungi regola' : 'Add rule'}
            </Button>
          </div>

          {rules.length === 0 ? (
            <p className="text-sm text-gray-400 py-1">
              {language === 'it' ? 'Nessuna regola.' : 'No rules yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select
                    value={rule.event_type_id === '' ? '' : String(rule.event_type_id)}
                    onValueChange={v => updateRule(i, { event_type_id: Number(v) })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={language === 'it' ? 'Tipo evento' : 'Event type'} />
                    </SelectTrigger>
                    <SelectContent>
                      {eventTypeOptions.map(et => (
                        <SelectItem key={et.id} value={String(et.id)}>{et.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    min={1}
                    value={rule.max_events}
                    onChange={e => updateRule(i, { max_events: parseInt(e.target.value) || 1 })}
                    className="w-24"
                    title={language === 'it' ? 'Max eventi' : 'Max events'}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRule(i)}
                    className="text-red-500 hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
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
  const { memberships, loading, error, refetch, create, update, remove, createRule, deleteRule } =
    useMemberships(accessToken);
  const { eventTypes } = useEventTypes(accessToken);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const syncRules = async (membershipId: number, oldRules: MembershipRule[], newRules: RuleDraft[]) => {
    for (const r of oldRules) await deleteRule(r.id);
    for (const r of newRules) {
      if (r.event_type_id !== '') {
        await createRule({ membership: membershipId, event_type_id: r.event_type_id as number, max_events: r.max_events });
      }
    }
  };

  const handleCreate = async (data: MembershipPayload, rules: RuleDraft[]) => {
    const membership = await create(data);
    await syncRules(membership.id, [], rules);
    await refetch();
    setAddOpen(false);
  };

  const handleUpdate = async (data: MembershipPayload, rules: RuleDraft[]) => {
    if (!editing) return;
    await update(editing.id, data);
    await syncRules(editing.id, editing.rules, rules);
    await refetch();
    setEditing(null);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await remove(id); }
    finally { setDeletingId(null); }
  };

  const toPayload = (m: Membership): MembershipPayload => ({
    name: m.name,
    type: m.type,
    contribution: m.contribution,
    color: m.color,
    max_events: m.max_events,
    duration: m.duration,
  });

  const toRuleDrafts = (rules: MembershipRule[]): RuleDraft[] =>
    rules.map(r => ({ id: r.id, event_type_id: r.event_type.id, max_events: r.max_events }));

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
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{language === 'it' ? 'Nuovo Piano' : 'New Membership Plan'}</DialogTitle>
                <DialogDescription>
                  {language === 'it' ? 'Crea un nuovo piano di iscrizione.' : 'Create a new membership plan.'}
                </DialogDescription>
              </DialogHeader>
              <MembershipForm
                eventTypeOptions={eventTypes}
                onSubmit={handleCreate}
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

        {error && <p className="text-sm text-red-500 py-4">{error}</p>}

        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'it' ? 'Nome' : 'Name'}</TableHead>
                <TableHead>{language === 'it' ? 'Tipo' : 'Type'}</TableHead>
                <TableHead>{language === 'it' ? 'Quota' : 'Contribution'}</TableHead>
                <TableHead>{language === 'it' ? 'Max eventi' : 'Max events'}</TableHead>
                <TableHead>{language === 'it' ? 'Durata' : 'Duration'}</TableHead>
                <TableHead>{language === 'it' ? 'Regole' : 'Rules'}</TableHead>
                <TableHead>{language === 'it' ? 'Colore' : 'Color'}</TableHead>
                <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
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
                  <TableCell>{m.max_events}</TableCell>
                  <TableCell>
                    {m.duration > 0
                      ? (language === 'it' ? `${m.duration} mesi` : `${m.duration} mo`)
                      : <span className="text-xs text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>
                    {m.rules.length === 0 ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {m.rules.map(r => (
                          <Badge key={r.id} variant="secondary" className="text-xs">
                            {r.event_type.name} × {r.max_events}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.color ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-block size-5 rounded border" style={{ backgroundColor: m.color }} />
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
                        <DialogContent className="max-w-xl">
                          <DialogHeader>
                            <DialogTitle>{language === 'it' ? 'Modifica Piano' : 'Edit Membership Plan'}</DialogTitle>
                            <DialogDescription>{m.name}</DialogDescription>
                          </DialogHeader>
                          <MembershipForm
                            initial={toPayload(m)}
                            initialRules={toRuleDrafts(m.rules)}
                            eventTypeOptions={eventTypes}
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
