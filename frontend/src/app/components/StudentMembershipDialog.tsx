import { useState, useEffect } from 'react';
import { Loader2, Pencil, Trash2, Plus, X, Euro } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useContributions, type Contribution, type ContributionPayload, type ContributionStatus } from '../hooks/useContributions';
import { useDiscounts } from '../hooks/useDiscounts';
import { useExtraItems } from '../hooks/useExtraItems';
import { useMemberships, type Membership } from '../hooks/useMemberships';
import { usePayments } from '../hooks/usePayments';
import { type UserListItem } from '../hooks/useUserList';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { MultiSearchSelect } from './MultiSearchSelect';
import { EventMultiSearchSelect } from './EventMultiSearchSelect';
import { UserPickerInput } from './UserPickerInput';
import { NewPaymentDialog } from './NewPaymentDialog';

interface Props {
  user: Pick<UserListItem, 'id' | 'first_name' | 'last_name'> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a contribution is created, updated or deleted, so the parent list can refresh. */
  onChanged?: () => void;
}

const CONTRIBUTION_STATUSES: { value: ContributionStatus; labelIt: string; labelEn: string }[] = [
  { value: 'received',  labelIt: 'Ricevuto',   labelEn: 'Received'  },
  { value: 'accepted',  labelIt: 'Accettato',  labelEn: 'Accepted'  },
  { value: 'confirmed', labelIt: 'Confermato', labelEn: 'Confirmed' },
  { value: 'payed',     labelIt: 'Pagato',     labelEn: 'Paid'      },
  { value: 'cancelled', labelIt: 'Annullato',  labelEn: 'Cancelled' },
  { value: 'waiting',   labelIt: 'In attesa',  labelEn: 'Waiting'   },
  { value: 'approving', labelIt: 'In approvazione', labelEn: 'Approving' },
];

const STATUS_BADGE: Record<ContributionStatus, string> = {
  received:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  accepted:  'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  payed:     'bg-purple-100 text-purple-800 border-purple-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  waiting:   'bg-gray-100 text-gray-600 border-gray-200',
  approving: 'bg-orange-100 text-orange-800 border-orange-200',
};

interface FormState {
  membershipId: number | '';
  amount: string;
  status: ContributionStatus;
  selectedEvents: { id: number; name: string }[];
  selectedDiscounts: { id: number; name: string }[];
  selectedExtraItems: { id: number; name: string }[];
  notes: string;
  partner: UserListItem | null;
  partnerEmail: string;
}

const emptyForm = (): FormState => ({
  membershipId: '', amount: '', status: 'received',
  selectedEvents: [], selectedDiscounts: [], selectedExtraItems: [], notes: '',
  partner: null, partnerEmail: '',
});

export function StudentMembershipDialog({ user, open, onOpenChange, onChanged }: Props) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { memberships } = useMemberships(accessToken);
  const { discounts } = useDiscounts(accessToken);
  const { extraItems } = useExtraItems(accessToken);
  const { contributions, loading, error, create, update, remove } = useContributions(
    accessToken,
    user?.id ?? null,
  );
  const { create: createPayment, update: updatePayment } = usePayments(accessToken, user?.id ?? null);

  const [editing, setEditing] = useState<Contribution | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [payingContribution, setPayingContribution] = useState<Contribution | null>(null);

  const discountItems = discounts.map(d => ({ id: d.id, name: d.name_ext || d.name }));
  const extraItemItems = extraItems.map(ei => ({ id: ei.id, name: `${ei.name} (+€${ei.value})` }));

  // When dialog closes, reset form state
  useEffect(() => {
    if (!open) {
      setEditing(null);
      setShowForm(false);
      setForm(emptyForm());
      setSaveError(null);
      setPayingContribution(null);
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
    setEditing(c);
    setForm({
      membershipId: c.membership ?? '',
      amount: c.amount,
      status: c.status,
      selectedEvents: c.events,
      selectedDiscounts: c.discounts.map(d => ({ id: d.id, name: d.name_ext || d.name })),
      selectedExtraItems: c.extra_items.map(ei => ({ id: ei.id, name: `${ei.name} (+€${ei.value})` })),
      notes: c.notes ?? '',
      partner: c.partner
        ? { ...c.partner, phone: '', role: '', memberships: [] }
        : null,
      partnerEmail: c.partner_email ?? '',
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
        discount_ids: form.selectedDiscounts.map(d => d.id),
        extra_item_ids: form.selectedExtraItems.map(ei => ei.id),
        notes: form.notes.trim() === '' ? null : form.notes,
        partner_id: form.partner?.id ?? null,
        partner_email: form.partnerEmail.trim() === '' ? null : form.partnerEmail,
      };
      if (editing) {
        await update(editing.id, payload);
      } else {
        await create(payload);
      }
      onChanged?.();
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
      onChanged?.();
    } catch {
      // silent
    }
  };

  const membershipName = (id: number | null) =>
    memberships.find(m => m.id === id)?.name ?? '—';

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                    {c.discounts.length > 0 ? (
                      <>
                        <span className="line-through text-gray-400 mr-1">€{c.amount}</span>
                        <span className="font-medium text-gray-700">€{c.discounted_amount}</span>
                      </>
                    ) : (
                      <>€{c.amount}</>
                    )}
                  </span>
                  {c.events.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {c.events.map(ev => (
                        <Badge key={ev.id} variant="outline" className="text-xs">
                          {ev.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {c.discounts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {c.discounts.map(d => (
                        <Badge key={d.id} variant="outline" className="text-xs">
                          {d.name_ext || d.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {c.extra_items.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {c.extra_items.map(ei => (
                        <Badge key={ei.id} variant="outline" className="text-xs bg-blue-50">
                          {language === 'it' ? ei.name_it : ei.name_en} (+€{ei.value})
                        </Badge>
                      ))}
                    </div>
                  )}
                  {(c.partner || c.partner_email) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      <span className="font-medium text-gray-600">Partner: </span>
                      {c.partner
                        ? `${c.partner.first_name} ${c.partner.last_name} (${c.partner.email})`
                        : c.partner_email}
                    </p>
                  )}
                  {c.notes && (
                    <p className="text-xs text-gray-500 italic mt-0.5">{c.notes}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setPayingContribution(c)}
                    disabled={showForm}
                    title={language === 'it' ? 'Registra pagamento' : 'Record payment'}
                  >
                    <Euro className="size-3.5" />
                  </Button>
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

            <EventMultiSearchSelect
              token={accessToken}
              label={language === 'it' ? 'Eventi' : 'Events'}
              selected={form.selectedEvents}
              placeholder={language === 'it' ? 'Cerca evento...' : 'Search event...'}
              onChange={items => setForm(f => ({ ...f, selectedEvents: items }))}
            />

            <MultiSearchSelect
              label={language === 'it' ? 'Sconti' : 'Discounts'}
              items={discountItems}
              selected={form.selectedDiscounts}
              placeholder={language === 'it' ? 'Cerca sconto...' : 'Search discount...'}
              onChange={items => setForm(f => ({ ...f, selectedDiscounts: items }))}
            />

            <MultiSearchSelect
              label={language === 'it' ? 'Articoli extra' : 'Extra items'}
              items={extraItemItems}
              selected={form.selectedExtraItems}
              placeholder={language === 'it' ? 'Cerca articolo extra...' : 'Search extra item...'}
              onChange={items => setForm(f => ({ ...f, selectedExtraItems: items }))}
            />

            <UserPickerInput
              token={accessToken}
              label="Partner"
              value={form.partner}
              onChange={partner => setForm(f => ({ ...f, partner }))}
              placeholder={language === 'it' ? 'Cerca per nome, cognome o email...' : 'Search by name, last name or email...'}
            />

            <div className="space-y-1">
              <Label>{language === 'it' ? 'Email partner' : 'Partner email'}</Label>
              <Input
                type="email"
                value={form.partnerEmail}
                onChange={e => setForm(f => ({ ...f, partnerEmail: e.target.value }))}
                placeholder={language === 'it' ? 'Email del partner (opzionale)' : "Partner's email (optional)"}
              />
            </div>

            <div className="space-y-1">
              <Label>{language === 'it' ? 'Note (interne)' : 'Notes (internal)'}</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={language === 'it' ? 'Note visibili solo agli admin...' : 'Notes visible to admins only...'}
                className="min-h-20"
              />
            </div>

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

    <NewPaymentDialog
      open={!!payingContribution}
      onOpenChange={open => { if (!open) setPayingContribution(null); }}
      onCreate={async payload => { await createPayment(payload); onChanged?.(); }}
      onUpdate={updatePayment}
      prefillUser={user}
      prefillContributionId={payingContribution?.id ?? null}
    />
    </>
  );
}
