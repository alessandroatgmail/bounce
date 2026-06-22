import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useEmailLogs } from '../hooks/useEmailLogs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

function toList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

const STATUS_LABELS: Record<number, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  0: { label: 'Queued',   variant: 'secondary' },
  1: { label: 'Sent',     variant: 'default' },
  2: { label: 'Failed',   variant: 'destructive' },
  3: { label: 'Requeued', variant: 'outline' },
};

interface Props {
  emailId?: number;
}

export function EmailLogsPanel({ emailId }: Props) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { logs, count, page, setPage, totalPages, loading, error } = useEmailLogs(accessToken ?? '', emailId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === 'it' ? 'Log Email' : 'Email Logs'}</CardTitle>
        <CardDescription>
          {language === 'it' ? `${count} log totali` : `${count} logs total`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {!loading && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'it' ? 'Data' : 'Date'}</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>{language === 'it' ? 'Tipo eccezione' : 'Exception type'}</TableHead>
                  <TableHead>{language === 'it' ? 'Messaggio' : 'Message'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => {
                  const status = STATUS_LABELS[log.status] ?? { label: String(log.status), variant: 'outline' as const };
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.date).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{toList(log.email_to).join(', ') || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{log.exception_type || '-'}</TableCell>
                      <TableCell className="max-w-md truncate text-sm">{log.message || '-'}</TableCell>
                    </TableRow>
                  );
                })}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {language === 'it' ? 'Nessun log.' : 'No logs.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
