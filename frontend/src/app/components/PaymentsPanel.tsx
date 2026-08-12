import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePayments, type PaymentMethod } from '../hooks/usePayments';
import { type UserListItem } from '../hooks/useUserList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { UserPickerInput } from './UserPickerInput';
import { NewPaymentDialog } from './NewPaymentDialog';

const METHOD_LABELS: Record<PaymentMethod, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  stripe: { label: 'Stripe', variant: 'default' },
  cash:   { label: 'Cash',   variant: 'secondary' },
  bank:   { label: 'Bank transfer', variant: 'outline' },
};

export function PaymentsPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const [userFilter, setUserFilter] = useState<UserListItem | null>(null);
  const [showNewPayment, setShowNewPayment] = useState(false);
  const { transactions, loading, error, create } = usePayments(accessToken ?? '', userFilter?.id ?? null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>{language === 'it' ? 'Pagamenti' : 'Payments'}</CardTitle>
            <CardDescription>
              {language === 'it' ? `${transactions.length} pagamenti totali` : `${transactions.length} payments total`}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowNewPayment(true)}>
            <Plus className="size-3.5 mr-1" />
            {language === 'it' ? 'Nuovo pagamento' : 'New payment'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 max-w-sm">
          <UserPickerInput
            token={accessToken ?? ''}
            label={language === 'it' ? 'Filtra per utente' : 'Filter by user'}
            value={userFilter}
            onChange={setUserFilter}
            placeholder={language === 'it' ? 'Cerca utente...' : 'Search user...'}
          />
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
                <TableHead>{language === 'it' ? 'Importo' : 'Amount'}</TableHead>
                <TableHead>{language === 'it' ? 'Ricevuta' : 'Receipt'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(t => {
                const method = METHOD_LABELS[t.method] ?? { label: t.method, variant: 'outline' as const };
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
                    <TableCell className="text-sm whitespace-nowrap">
                      {t.amount_total} {t.currency.toUpperCase()}
                    </TableCell>
                    <TableCell className="text-xs">{t.receipt_number || '-'}</TableCell>
                  </TableRow>
                );
              })}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {language === 'it' ? 'Nessun pagamento.' : 'No payments.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <NewPaymentDialog open={showNewPayment} onOpenChange={setShowNewPayment} onSubmit={create} />
    </Card>
  );
}
