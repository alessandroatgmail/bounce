import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDiscounts, Discount, DiscountPayload } from '../hooks/useDiscounts';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';

const EMPTY_PAYLOAD: DiscountPayload = {
  name: '',
  name_ext: '',
  description: '',
  rate: null,
  amount: null,
};

interface FormProps {
  initial?: DiscountPayload;
  onSubmit: (data: DiscountPayload) => Promise<void>;
  onCancel: () => void;
}

function DiscountForm({ initial = EMPTY_PAYLOAD, onSubmit, onCancel }: FormProps) {
  const { language } = useLanguage();
  const [form, setForm] = useState<DiscountPayload>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof DiscountPayload>(field: K, value: DiscountPayload[K]) =>
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
          <Label htmlFor="d-name">
            {language === 'it' ? 'Codice' : 'Code'} * <span className="text-xs text-gray-400">(max 10)</span>
          </Label>
          <Input
            id="d-name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            maxLength={10}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="d-name-ext">{language === 'it' ? 'Nome' : 'Name'} *</Label>
          <Input
            id="d-name-ext"
            value={form.name_ext}
            onChange={e => set('name_ext', e.target.value)}
            maxLength={100}
            required
          />
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="d-description">{language === 'it' ? 'Descrizione' : 'Description'}</Label>
          <Textarea
            id="d-description"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="d-rate">{language === 'it' ? 'Percentuale (%)' : 'Rate (%)'}</Label>
          <Input
            id="d-rate"
            type="number"
            min={0}
            max={100}
            value={form.rate ?? ''}
            onChange={e => set('rate', e.target.value === '' ? null : parseInt(e.target.value))}
            placeholder="e.g. 10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="d-amount">{language === 'it' ? 'Importo fisso (€)' : 'Fixed amount (€)'}</Label>
          <Input
            id="d-amount"
            type="number"
            min={0}
            step="0.01"
            value={form.amount ?? ''}
            onChange={e => set('amount', e.target.value === '' ? null : e.target.value)}
            placeholder="e.g. 5.00"
          />
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

export function DiscountPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { discounts, loading, error, refetch, create, update, remove } = useDiscounts(accessToken);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async (data: DiscountPayload) => {
    await create(data);
    await refetch();
    setAddOpen(false);
  };

  const handleUpdate = async (data: DiscountPayload) => {
    if (!editing) return;
    await update(editing.id, data);
    await refetch();
    setEditing(null);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await remove(id); }
    finally { setDeletingId(null); }
  };

  const toPayload = (d: Discount): DiscountPayload => ({
    name: d.name,
    name_ext: d.name_ext,
    description: d.description,
    rate: d.rate,
    amount: d.amount,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{language === 'it' ? 'Sconti' : 'Discounts'}</CardTitle>
            <CardDescription>
              {language === 'it' ? 'Gestisci gli sconti applicabili' : 'Manage applicable discounts'}
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
                <DialogTitle>{language === 'it' ? 'Nuovo Sconto' : 'New Discount'}</DialogTitle>
                <DialogDescription>
                  {language === 'it' ? 'Crea un nuovo sconto.' : 'Create a new discount.'}
                </DialogDescription>
              </DialogHeader>
              <DiscountForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} />
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
                <TableHead>{language === 'it' ? 'Codice' : 'Code'}</TableHead>
                <TableHead>{language === 'it' ? 'Nome' : 'Name'}</TableHead>
                <TableHead>{language === 'it' ? 'Descrizione' : 'Description'}</TableHead>
                <TableHead>{language === 'it' ? 'Percentuale' : 'Rate'}</TableHead>
                <TableHead>{language === 'it' ? 'Importo' : 'Amount'}</TableHead>
                <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    {language === 'it' ? 'Nessuno sconto.' : 'No discounts yet.'}
                  </TableCell>
                </TableRow>
              )}
              {discounts.map(d => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{d.name}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{d.name_ext}</TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-xs truncate">{d.description}</TableCell>
                  <TableCell>
                    {d.rate != null
                      ? <Badge variant="secondary">{d.rate}%</Badge>
                      : <span className="text-xs text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>
                    {d.amount != null
                      ? `€${parseFloat(d.amount).toFixed(2)}`
                      : <span className="text-xs text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog open={editing?.id === d.id} onOpenChange={open => !open && setEditing(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(d)}>
                            <Pencil className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                          <DialogHeader>
                            <DialogTitle>{language === 'it' ? 'Modifica Sconto' : 'Edit Discount'}</DialogTitle>
                            <DialogDescription>{d.name_ext}</DialogDescription>
                          </DialogHeader>
                          <DiscountForm
                            initial={toPayload(d)}
                            onSubmit={handleUpdate}
                            onCancel={() => setEditing(null)}
                          />
                        </DialogContent>
                      </Dialog>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        disabled={deletingId === d.id}
                        onClick={() => handleDelete(d.id)}
                      >
                        {deletingId === d.id
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
