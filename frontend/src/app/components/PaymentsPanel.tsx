import { useState } from 'react';
import { Loader2, Plus, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePayments, type PaymentMethod, type PaymentStatus, type Transaction } from '../hooks/usePayments';
import { type UserListItem } from '../hooks/useUserList';
import { type AdminEventItem } from '../hooks/useAdminEventsPaginated';
import { useStyles } from '../hooks/useStyles';
import { useLevels } from '../hooks/useLevels';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { UserPickerInput } from './UserPickerInput';
import { EventPickerInput } from './EventPickerInput';
import { NewPaymentDialog } from './NewPaymentDialog';

const METHOD_LABELS: Record<PaymentMethod, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  stripe: { label: 'Stripe', variant: 'default' },
  cash:   { label: 'Cash',   variant: 'secondary' },
  bank:   { label: 'Bank transfer', variant: 'outline' },
};

const STATUS_LABELS: Record<PaymentStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending:    { label: 'Pending',    variant: 'outline' },
  processing: { label: 'Processing', variant: 'secondary' },
  completed:  { label: 'Completed',  variant: 'default' },
};

export function PaymentsPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const [userFilter, setUserFilter] = useState<UserListItem | null>(null);
  const [eventFilter, setEventFilter] = useState<AdminEventItem | null>(null);
  const [styleFilter, setStyleFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const { styles } = useStyles(accessToken);
  const { levels } = useLevels(accessToken);
  const { transactions, count, page, setPage, totalPages, loading, error, create, update } = usePayments(
    accessToken ?? '', userFilter?.id ?? null, {
      eventId: eventFilter?.id ?? null,
      styleId: styleFilter !== 'all' ? Number(styleFilter) : null,
      levelId: levelFilter !== 'all' ? Number(levelFilter) : null,
    },
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>{language === 'it' ? 'Pagamenti' : 'Payments'}</CardTitle>
            <CardDescription>
              {language === 'it' ? `${count} pagamenti totali` : `${count} payments total`}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowNewPayment(true)}>
            <Plus className="size-3.5 mr-1" />
            {language === 'it' ? 'Nuovo pagamento' : 'New payment'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UserPickerInput
            token={accessToken ?? ''}
            label={language === 'it' ? 'Filtra per utente' : 'Filter by user'}
            value={userFilter}
            onChange={setUserFilter}
            placeholder={language === 'it' ? 'Cerca utente...' : 'Search user...'}
          />
          <EventPickerInput
            token={accessToken ?? ''}
            label={language === 'it' ? 'Filtra per evento' : 'Filter by event'}
            value={eventFilter}
            onChange={setEventFilter}
            placeholder={language === 'it' ? 'Cerca evento...' : 'Search event...'}
          />
          <div className="space-y-1">
            <Label>{language === 'it' ? 'Filtra per stile' : 'Filter by style'}</Label>
            <Select value={styleFilter} onValueChange={setStyleFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'it' ? 'Tutti gli stili' : 'All styles'}</SelectItem>
                {styles.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{language === 'it' ? 'Filtra per livello' : 'Filter by level'}</Label>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'it' ? 'Tutti i livelli' : 'All levels'}</SelectItem>
                {levels.map(l => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {!loading && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'it' ? 'Data' : 'Date'}</TableHead>
                <TableHead>{language === 'it' ? 'Utente' : 'User'}</TableHead>
                <TableHead>{language === 'it' ? 'Metodo' : 'Method'}</TableHead>
                <TableHead>{language === 'it' ? 'Stato' : 'Status'}</TableHead>
                <TableHead>{language === 'it' ? 'Importo' : 'Amount'}</TableHead>
                <TableHead>{language === 'it' ? 'Ricevuta' : 'Receipt'}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(t => {
                const method = METHOD_LABELS[t.method] ?? { label: t.method, variant: 'outline' as const };
                const paymentStatus = STATUS_LABELS[t.status] ?? { label: t.status, variant: 'outline' as const };
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(t.date).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.user.first_name} {t.user.last_name}
                      <div className="text-xs text-muted-foreground">{t.user.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={method.variant}>{method.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={paymentStatus.variant}>{paymentStatus.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {t.amount_total} {t.currency.toUpperCase()}
                    </TableCell>
                    <TableCell className="text-xs">{t.receipt_number || '-'}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingTransaction(t)}
                        title={language === 'it' ? 'Modifica pagamento' : 'Edit payment'}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {language === 'it' ? 'Nessun pagamento.' : 'No payments.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {language === 'it' ? `Pagina ${page} di ${totalPages}` : `Page ${page} of ${totalPages}`}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <NewPaymentDialog
        open={showNewPayment || !!editingTransaction}
        onOpenChange={open => {
          if (!open) {
            setShowNewPayment(false);
            setEditingTransaction(null);
          }
        }}
        onCreate={create}
        onUpdate={update}
        editTransaction={editingTransaction}
      />
    </Card>
  );
}
