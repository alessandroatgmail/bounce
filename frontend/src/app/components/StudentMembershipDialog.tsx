import { useState, useEffect } from 'react';
import { Loader2, Pencil, Trash2, Plus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useContributions, type Contribution, type ContributionPayload, type ContributionStatus } from '../hooks/useContributions';
import { useMemberships, type Membership } from '../hooks/useMemberships';
import { useEvents } from '../hooks/useEvents';
import { type UserListItem } from '../hooks/useUserList';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { MultiSearchSelect } from './MultiSearchSelect';

interface Props {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONTRIBUTION_STATUSES: { value: ContributionStatus; labelIt: string; labelEn: string }[] = [
  { value: 'received',  labelIt: 'Ricevuto',   labelEn: 'Received'  },
  { value: 'accepted',  labelIt: 'Accettato',  labelEn: 'Accepted'  },
  { value: 'confirmed', labelIt: 'Confermato', labelEn: 'Confirmed' },
];

const STATUS_BADGE: Record<ContributionStatus, string> = {
  received:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  accepted:  'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
};

interface FormState {
  membershipId: number | '';
  amount: string;
  status: ContributionStatus;
  selectedEvents: { id: number; name: string }[];
}

const emptyForm = (): FormState => ({ membershipId: '', amount: '', status: 'received', selectedEvents: [] });

export function StudentMembershipDialog({ user, open, onOpenChange }: Props) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { memberships } = useMemberships(accessToken);
  const { events } = useEvents(accessToken);
  const { contributions, loading, error, create, update, remove } = useContributions(
    accessToken,
    user?.id ?? null,
  );

  const [editing, setEditing] = useState<Contribution | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Parent events only
  const parentEvents = events.filter(e => e.events.length > 0).map(e => ({ id: e.id, name: e.name }));

  // When dialog closes, reset form state
  useEffect(() => {
    if (!open) {
      setEditing(null);
      setShowForm(false);
      setForm(emptyForm());
      setSaveError(null);
    }
  }, [open]);

  // Auto-fill amount when membership changes
  const handleMembershipChange = (val: string) => {
    const id = val === '' ? '' : Number(val);
    const membership: Membership | undefined = memberships.find(m => m.id === id);
    setForm(f => ({
      ...f,
      membershipId: id,
      amount: membership ? String(membership.contribution) : f.amount,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setSaveError(null);
    setShowForm(true);
  };

  const openEdit = (c: Contribution) => {
    const eventItems = c.events
      .map(eid => events.find(e => e.id === eid))
      .filter(Boolean)
      .map(e => ({ id: e!.id, name: e!.name }));
    setEditing(c);
    setForm({
      membershipId: c.membership ?? '',
      amount: c.amount,
      status: c.status,
      selectedEvents: eventItems,
    });
    setSaveError(null);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm());
    setSaveError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: ContributionPayload = {
        amount: form.amount,
        user: user.id,
        status: form.status,
        event_ids: form.selectedEvents.map(ev => ev.id),
        membership_id: form.membershipId === '' ? null : form.membershipId,
      };
      if (editing) {
        await update(editing.id, payload);
      } else {
        await create(payload);
      }
      cancelForm();
    } catch {
      setSaveError(language === 'it' ? 'Salvataggio fallito.' : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(language === 'it' ? 'Eliminare questo contributo?' : 'Delete this contribution?')) return;
    try {
      await remove(id);
    } catch {
      // silent
    }
  };

  const membershipName = (id: number | null) =>
    memberships.find(m => m.id === id)?.name ?? '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {user ? `${user.first_name} ${user.last_name}` : ''}
          </DialogTitle>
          <DialogDescription>
            {language === 'it' ? 'Gestisci i contributi di iscrizione' : 'Manage membership contributions'}
          </DialogDescription>
        </DialogHeader>

        {/* Contributions list */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <div className="space-y-2">
            {contributions.length === 0 && !showForm && (
              <p className="text-sm text-gray-400 py-2">
                {language === 'it' ? 'Nessun contributo.' : 'No contributions yet.'}
              </p>
            )}
            {contributions.map(c => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{membershipName(c.membership)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${STATUS_BADGE[c.status]}`}>
                      {CONTRIBUTION_STATUSES.find(s => s.value === c.status)?.[language === 'it' ? 'labelIt' : 'labelEn'] ?? c.status}
                    </span>
                  </div>
                  <span className="text-gray-500">
                    €{c.amount}
                    {c.events.length > 0 && (
                      <span className="ml-2 text-xs text-gray-400">
                        {c.events.length} {language === 'it' ? 'evento/i' : 'event(s)'}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => openEdit(c)}
                    disabled={showForm}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(c.id)}
                    disabled={showForm}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline form */}
        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium">
              {editing
                ? (language === 'it' ? 'Modifica contributo' : 'Edit contribution')
                : (language === 'it' ? 'Nuovo contributo' : 'New contribution')}
            </p>

            <div className="space-y-1">
              <Label>{language === 'it' ? 'Piano' : 'Plan'}</Label>
              <Select
                value={form.membershipId === '' ? '' : String(form.membershipId)}
                onValueChange={handleMembershipChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'it' ? 'Seleziona piano...' : 'Select plan...'} />
                </SelectTrigger>
                <SelectContent>
                  {memberships.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      <span className="flex items-center gap-2">
                        {m.color && (
                          <span
                            className="inline-block size-3 rounded-full"
                            style={{ backgroundColor: m.color }}
                          />
                        )}
                        {m.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{language === 'it' ? 'Importo (€)' : 'Amount (€)'}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{language === 'it' ? 'Stato' : 'Status'}</Label>
              <Select
                value={form.status}
                onValueChange={v => setForm(f => ({ ...f, status: v as ContributionStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRIBUTION_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      {language === 'it' ? s.labelIt : s.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <MultiSearchSelect
              label={language === 'it' ? 'Eventi' : 'Events'}
              items={parentEvents}
              selected={form.selectedEvents}
              placeholder={language === 'it' ? 'Cerca evento...' : 'Search event...'}
              onChange={items => setForm(f => ({ ...f, selectedEvents: items }))}
            />

            {saveError && <p className="text-sm text-red-500">{saveError}</p>}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={cancelForm} disabled={saving}>
                <X className="size-3.5 mr-1" />
                {language === 'it' ? 'Annulla' : 'Cancel'}
              </Button>
              <Button type="submit" size="sm" disabled={saving || form.amount === ''}>
                {saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                {language === 'it' ? 'Salva' : 'Save'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="border-t pt-4">
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="size-3.5 mr-1" />
              {language === 'it' ? 'Aggiungi contributo' : 'Add contribution'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
