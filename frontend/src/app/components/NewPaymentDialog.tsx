import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { type TransactionPayload } from '../hooks/usePayments';
import { useContributions } from '../hooks/useContributions';
import { useMemberships } from '../hooks/useMemberships';
import { type UserListItem } from '../hooks/useUserList';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { UserPickerInput } from './UserPickerInput';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: TransactionPayload) => Promise<void>;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const PAYABLE_STATUSES = ['received', 'accepted', 'confirmed', 'waiting'];

export function NewPaymentDialog({ open, onOpenChange, onSubmit }: Props) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { memberships } = useMemberships(accessToken);

  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const { contributions } = useContributions(accessToken ?? '', selectedUser?.id ?? null);
  const payableContributions = contributions.filter(c => PAYABLE_STATUSES.includes(c.status));

  const [method, setMethod] = useState<'cash' | 'bank'>('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [amountTotal, setAmountTotal] = useState('');
  const [date, setDate] = useState(todayIso());
  const [selectedContributionIds, setSelectedContributionIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedUser(null);
      setMethod('cash');
      setReceiptNumber('');
      setAmountTotal('');
      setDate(todayIso());
      setSelectedContributionIds([]);
      setSaveError(null);
    }
  }, [open]);

  // Reset selected contributions whenever the user changes
  useEffect(() => {
    setSelectedContributionIds([]);
  }, [selectedUser?.id]);

  const toggleContribution = (id: number) => {
    setSelectedContributionIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  };

  const membershipName = (id: number | null) => memberships.find(m => m.id === id)?.name ?? '—';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: TransactionPayload = {
        user: selectedUser.id,
        method,
        receipt_number: receiptNumber,
        amount_total: amountTotal,
        date: new Date(date).toISOString(),
        contribution_ids: selectedContributionIds,
      };
      await onSubmit(payload);
      onOpenChange(false);
    } catch {
      setSaveError(language === 'it' ? 'Salvataggio fallito.' : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{language === 'it' ? 'Nuovo pagamento' : 'New payment'}</DialogTitle>
          <DialogDescription>
            {language === 'it' ? 'Registra un pagamento in contanti o bonifico' : 'Record a cash or bank payment'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <UserPickerInput
            token={accessToken ?? ''}
            label={language === 'it' ? 'Utente' : 'User'}
            value={selectedUser}
            onChange={setSelectedUser}
            placeholder={language === 'it' ? 'Cerca utente...' : 'Search user...'}
          />

          {selectedUser && (
            <div className="space-y-1">
              <Label>{language === 'it' ? 'Contributi da saldare' : 'Contributions to settle'}</Label>
              {payableContributions.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {language === 'it' ? 'Nessun contributo da saldare.' : 'No contributions to settle.'}
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {payableContributions.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedContributionIds.includes(c.id)}
                        onChange={() => toggleContribution(c.id)}
                      />
                      {membershipName(c.membership)} — €{c.discounted_amount}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{language === 'it' ? 'Metodo' : 'Method'}</Label>
              <Select value={method} onValueChange={v => setMethod(v as 'cash' | 'bank')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{language === 'it' ? 'Contanti' : 'Cash'}</SelectItem>
                  <SelectItem value="bank">{language === 'it' ? 'Bonifico' : 'Bank transfer'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{language === 'it' ? 'Data' : 'Date'}</Label>
              <Input type="date" required value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{language === 'it' ? 'Importo (€)' : 'Amount (€)'}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                required
                value={amountTotal}
                onChange={e => setAmountTotal(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>{language === 'it' ? 'N. ricevuta' : 'Receipt no.'}</Label>
              <Input required value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} />
            </div>
          </div>

          {saveError && <p className="text-sm text-red-500">{saveError}</p>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              <X className="size-3.5 mr-1" />
              {language === 'it' ? 'Annulla' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !selectedUser || amountTotal === '' || receiptNumber === ''}
            >
              {saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              {language === 'it' ? 'Salva' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
