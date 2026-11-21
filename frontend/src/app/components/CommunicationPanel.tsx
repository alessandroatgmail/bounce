import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useCommunications, Communication, CommunicationPayload, CommunicationTarget } from '../hooks/useCommunications';
import { useEvents } from '../hooks/useEvents';
import { useExtraItems } from '../hooks/useExtraItems';
import { useMemberships } from '../hooks/useMemberships';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { MultiSearchSelect } from './MultiSearchSelect';

const EMPTY: CommunicationPayload = {
  event_ids: [],
  extra_item_ids: [],
  plan_ids: [],
  title: '',
  title_it: '',
  title_en: '',
  desc: '',
  desc_it: '',
  desc_en: '',
  recurrent: false,
};

interface FormProps {
  initial?: CommunicationPayload;
  initialTargets?: { events: CommunicationTarget[]; extraItems: CommunicationTarget[]; plans: CommunicationTarget[] };
  onSubmit: (data: CommunicationPayload) => Promise<void>;
  onCancel: () => void;
}

function CommunicationForm({
  initial = EMPTY,
  initialTargets = { events: [], extraItems: [], plans: [] },
  onSubmit,
  onCancel,
}: FormProps) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { events, loading: eventsLoading } = useEvents(accessToken);
  const { extraItems, loading: extraItemsLoading } = useExtraItems(accessToken);
  const { memberships, loading: plansLoading } = useMemberships(accessToken);

  const [form, setForm] = useState<CommunicationPayload>(initial);
  const [selectedEvents, setSelectedEvents] = useState<CommunicationTarget[]>(initialTargets.events);
  const [selectedExtraItems, setSelectedExtraItems] = useState<CommunicationTarget[]>(initialTargets.extraItems);
  const [selectedPlans, setSelectedPlans] = useState<CommunicationTarget[]>(initialTargets.plans);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CommunicationPayload>(field: K, value: CommunicationPayload[K]) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        event_ids: selectedEvents.map(i => i.id),
        extra_item_ids: selectedExtraItems.map(i => i.id),
        plan_ids: selectedPlans.map(i => i.id),
      });
    } catch {
      setError(language === 'it' ? 'Errore durante il salvataggio.' : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label>{language === 'it' ? 'Titolo' : 'Title'}</Label>
        <Textarea rows={2} value={form.title} onChange={e => set('title', e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>{language === 'it' ? 'Titolo (IT)' : 'Title (IT)'}</Label>
        <Textarea rows={2} value={form.title_it} onChange={e => set('title_it', e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>{language === 'it' ? 'Titolo (EN)' : 'Title (EN)'}</Label>
        <Textarea rows={2} value={form.title_en} onChange={e => set('title_en', e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>{language === 'it' ? 'Descrizione' : 'Description'}</Label>
        <Textarea rows={5} value={form.desc} onChange={e => set('desc', e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>{language === 'it' ? 'Descrizione (IT)' : 'Description (IT)'}</Label>
        <Textarea rows={5} value={form.desc_it} onChange={e => set('desc_it', e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>{language === 'it' ? 'Descrizione (EN)' : 'Description (EN)'}</Label>
        <Textarea rows={5} value={form.desc_en} onChange={e => set('desc_en', e.target.value)} required />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="recurrent"
          checked={form.recurrent}
          onCheckedChange={checked => set('recurrent', checked === true)}
        />
        <Label htmlFor="recurrent" className="cursor-pointer">
          {language === 'it'
            ? 'Ricorrente — richiedi nuovamente ad ogni occasione'
            : 'Recurrent — ask again every time it applies'}
        </Label>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <MultiSearchSelect
          label={language === 'it' ? 'Eventi' : 'Events'}
          items={events}
          selected={selectedEvents}
          loading={eventsLoading}
          placeholder={language === 'it' ? 'Cerca un evento...' : 'Search an event...'}
          onChange={setSelectedEvents}
        />
        <MultiSearchSelect
          label={language === 'it' ? 'Extra' : 'Extra Items'}
          items={extraItems}
          selected={selectedExtraItems}
          loading={extraItemsLoading}
          placeholder={language === 'it' ? 'Cerca un extra...' : 'Search an extra item...'}
          onChange={setSelectedExtraItems}
        />
        <MultiSearchSelect
          label={language === 'it' ? 'Piani' : 'Plans'}
          items={memberships}
          selected={selectedPlans}
          loading={plansLoading}
          placeholder={language === 'it' ? 'Cerca un piano...' : 'Search a plan...'}
          onChange={setSelectedPlans}
        />
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

function targetNames(targets: CommunicationTarget[]) {
  return targets.map(t => t.name).join(', ');
}

export function CommunicationPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { communications, loading, error, create, update, remove } = useCommunications(accessToken);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Communication | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async (data: CommunicationPayload) => {
    await create(data);
    setAddOpen(false);
  };

  const handleUpdate = async (data: CommunicationPayload) => {
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
            <CardTitle>{language === 'it' ? 'Comunicazioni' : 'Communications'}</CardTitle>
            <CardDescription>
              {language === 'it'
                ? 'Gestisci gli avvisi che gli studenti devono vedere e accettare'
                : 'Manage the notices students must see and agree to'}
            </CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4 mr-2" />
                {language === 'it' ? 'Aggiungi' : 'Add'}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[42rem] max-w-[95vw] min-w-[28rem] max-h-[90vh] min-h-[20rem] resize overflow-auto">
              <DialogHeader>
                <DialogTitle>{language === 'it' ? 'Nuova Comunicazione' : 'New Communication'}</DialogTitle>
                <DialogDescription>
                  {language === 'it'
                    ? 'Compila i campi per creare una nuova comunicazione.'
                    : 'Fill in the fields to create a new communication.'}
                </DialogDescription>
              </DialogHeader>
              <CommunicationForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} />
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
                <TableHead>{language === 'it' ? 'Titolo' : 'Title'}</TableHead>
                <TableHead>{language === 'it' ? 'Eventi' : 'Events'}</TableHead>
                <TableHead>{language === 'it' ? 'Extra' : 'Extra Items'}</TableHead>
                <TableHead>{language === 'it' ? 'Piani' : 'Plans'}</TableHead>
                <TableHead>{language === 'it' ? 'Ricorrente' : 'Recurrent'}</TableHead>
                <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {communications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    {language === 'it' ? 'Nessuna comunicazione.' : 'No communications yet.'}
                  </TableCell>
                </TableRow>
              )}
              {communications.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell className="text-sm text-gray-500">{targetNames(item.events) || '—'}</TableCell>
                  <TableCell className="text-sm text-gray-500">{targetNames(item.extra_items) || '—'}</TableCell>
                  <TableCell className="text-sm text-gray-500">{targetNames(item.plans) || '—'}</TableCell>
                  <TableCell>{item.recurrent ? (language === 'it' ? 'Sì' : 'Yes') : (language === 'it' ? 'No' : 'No')}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog open={editing?.id === item.id} onOpenChange={open => !open && setEditing(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                            <Pencil className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[42rem] max-w-[95vw] min-w-[28rem] max-h-[90vh] min-h-[20rem] resize overflow-auto">
                          <DialogHeader>
                            <DialogTitle>{language === 'it' ? 'Modifica Comunicazione' : 'Edit Communication'}</DialogTitle>
                            <DialogDescription>{item.title}</DialogDescription>
                          </DialogHeader>
                          <CommunicationForm
                            initial={{
                              event_ids: item.events.map(e => e.id),
                              extra_item_ids: item.extra_items.map(e => e.id),
                              plan_ids: item.plans.map(e => e.id),
                              title: item.title,
                              title_it: item.title_it,
                              title_en: item.title_en,
                              desc: item.desc,
                              desc_it: item.desc_it,
                              desc_en: item.desc_en,
                              recurrent: item.recurrent,
                            }}
                            initialTargets={{ events: item.events, extraItems: item.extra_items, plans: item.plans }}
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
