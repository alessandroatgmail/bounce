import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useEventTypes, EventType, EventTypePayload, FREQUENCIES } from '../hooks/useEventTypes';
import { usePartnerRoles, PartnerRole } from '../hooks/usePartnerRoles';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { MultiSearchSelect } from './MultiSearchSelect';

const EMPTY: EventTypePayload = { name: '', frequency: '', partners: 0, role_ids: [] };

interface FormProps {
  initial?: EventTypePayload;
  initialRoles?: PartnerRole[];
  availableRoles: PartnerRole[];
  loadingRoles: boolean;
  onSubmit: (data: EventTypePayload) => Promise<void>;
  onCancel: () => void;
}

function EventTypeForm({ initial = EMPTY, initialRoles = [], availableRoles, loadingRoles, onSubmit, onCancel }: FormProps) {
  const { language } = useLanguage();
  const [form, setForm] = useState<EventTypePayload>(initial);
  const [selectedRoles, setSelectedRoles] = useState<PartnerRole[]>(initialRoles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof EventTypePayload, value: string | number | number[]) =>
    setForm(f => ({ ...f, [field]: value }));

  const handlePartnersChange = (value: number) => {
    set('partners', value);
    if (value === 0) setSelectedRoles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.partners > 0 && selectedRoles.length !== form.partners) {
      setError(
        language === 'it'
          ? `Seleziona esattamente ${form.partners} ruolo/i.`
          : `Select exactly ${form.partners} role(s).`
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...form, role_ids: selectedRoles.map(r => r.id) });
    } catch {
      setError(language === 'it' ? 'Errore durante il salvataggio.' : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="et-name">{language === 'it' ? 'Nome' : 'Name'}</Label>
        <Input
          id="et-name"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{language === 'it' ? 'Frequenza' : 'Frequency'}</Label>
        <Select value={form.frequency} onValueChange={v => set('frequency', v)}>
          <SelectTrigger>
            <SelectValue placeholder={language === 'it' ? 'Seleziona...' : 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCIES.map(f => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="et-partners">{language === 'it' ? 'Partner' : 'Partners'}</Label>
        <Input
          id="et-partners"
          type="number"
          min={0}
          value={form.partners}
          onChange={e => handlePartnersChange(parseInt(e.target.value, 10) || 0)}
          required
        />
      </div>

      {form.partners > 0 && (
        <div className="space-y-1">
          <MultiSearchSelect
            label={
              language === 'it'
                ? `Ruoli Partner (seleziona esattamente ${form.partners})`
                : `Partner Roles (select exactly ${form.partners})`
            }
            items={availableRoles}
            selected={selectedRoles}
            loading={loadingRoles}
            placeholder={language === 'it' ? 'Cerca ruolo...' : 'Search role...'}
            onChange={roles => {
              if (roles.length <= form.partners) setSelectedRoles(roles);
            }}
          />
          <p className="text-xs text-gray-400">
            {selectedRoles.length}/{form.partners} {language === 'it' ? 'selezionati' : 'selected'}
          </p>
        </div>
      )}

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

export function EventTypePanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { eventTypes, loading, error, create, update, remove } = useEventTypes(accessToken);
  const { partnerRoles, loading: loadingRoles } = usePartnerRoles(accessToken);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EventType | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const resolveInitialRoles = (et: EventType): PartnerRole[] =>
    partnerRoles.filter(r => et.partner_roles.some(pr => pr.id === r.id));

  const handleCreate = async (data: EventTypePayload) => {
    await create(data);
    setAddOpen(false);
  };

  const handleUpdate = async (data: EventTypePayload) => {
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

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{language === 'it' ? 'Tipi di Evento' : 'Event Types'}</CardTitle>
            <CardDescription>
              {language === 'it' ? 'Gestisci i tipi di evento' : 'Manage event types'}
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
                <DialogTitle>{language === 'it' ? 'Nuovo Tipo di Evento' : 'New Event Type'}</DialogTitle>
                <DialogDescription>
                  {language === 'it' ? 'Compila i campi per creare un nuovo tipo.' : 'Fill in the fields to create a new type.'}
                </DialogDescription>
              </DialogHeader>
              <EventTypeForm
                availableRoles={partnerRoles}
                loadingRoles={loadingRoles}
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
                <TableHead>{language === 'it' ? 'Frequenza' : 'Frequency'}</TableHead>
                <TableHead>{language === 'it' ? 'Partner' : 'Partners'}</TableHead>
                <TableHead>{language === 'it' ? 'Ruoli' : 'Roles'}</TableHead>
                <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventTypes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    {language === 'it' ? 'Nessun tipo di evento.' : 'No event types yet.'}
                  </TableCell>
                </TableRow>
              )}
              {eventTypes.map(et => (
                <TableRow key={et.id}>
                  <TableCell className="font-medium">{et.name}</TableCell>
                  <TableCell>{et.frequency}</TableCell>
                  <TableCell>{et.partners}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {et.partner_roles.length === 0
                        ? <span className="text-gray-400 text-xs">—</span>
                        : et.partner_roles.map(role => (
                            <Badge key={role.id} variant="outline" className="text-xs">{role.name}</Badge>
                          ))
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {/* Edit */}
                      <Dialog open={editing?.id === et.id} onOpenChange={open => !open && setEditing(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(et)}>
                            <Pencil className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{language === 'it' ? 'Modifica Tipo di Evento' : 'Edit Event Type'}</DialogTitle>
                            <DialogDescription>{et.name}</DialogDescription>
                          </DialogHeader>
                          <EventTypeForm
                            initial={{ name: et.name, frequency: et.frequency, partners: et.partners, role_ids: [] }}
                            initialRoles={resolveInitialRoles(et)}
                            availableRoles={partnerRoles}
                            loadingRoles={loadingRoles}
                            onSubmit={handleUpdate}
                            onCancel={() => setEditing(null)}
                          />
                        </DialogContent>
                      </Dialog>

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        disabled={deletingId === et.id}
                        onClick={() => handleDelete(et.id)}
                      >
                        {deletingId === et.id
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
