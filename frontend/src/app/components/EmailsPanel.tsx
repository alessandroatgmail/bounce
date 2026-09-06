import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useEmails, SentEmail } from '../hooks/useEmails';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const ALL_TEMPLATES = '__all__';

function toList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

const STATUS_LABELS: Record<number, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  0: { label: 'Queued',  variant: 'secondary' },
  1: { label: 'Sent',    variant: 'default' },
  2: { label: 'Failed',  variant: 'destructive' },
  3: { label: 'Requeued', variant: 'outline' },
};

function EmailRow({ email }: { email: SentEmail }) {
  const [expanded, setExpanded] = useState(false);
  const { language } = useLanguage();
  const status = STATUS_LABELS[email.status] ?? { label: String(email.status), variant: 'outline' as const };

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(v => !v)}
      >
        <TableCell className="text-xs text-muted-foreground">
          {new Date(email.created).toLocaleString()}
        </TableCell>
        <TableCell className="max-w-[160px] truncate text-sm">{toList(email.to).join(', ')}</TableCell>
        <TableCell className="max-w-xs truncate text-sm">{email.subject}</TableCell>
        <TableCell>{email.template_name ? <Badge variant="outline">{email.template_name}</Badge> : '-'}</TableCell>
        <TableCell>
          <Badge variant={status.variant}>{status.label}</Badge>
        </TableCell>
        <TableCell>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-4">
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                <div><span className="font-medium">From:</span> {email.from_email}</div>
                <div><span className="font-medium">Message ID:</span> <span className="font-mono text-xs">{email.message_id || '-'}</span></div>
                {toList(email.cc).length > 0 && <div><span className="font-medium">CC:</span> {toList(email.cc).join(', ')}</div>}
                {toList(email.bcc).length > 0 && <div><span className="font-medium">BCC:</span> {toList(email.bcc).join(', ')}</div>}
                <div><span className="font-medium">{language === 'it' ? 'Tentativi:' : 'Retries:'}</span> {email.number_of_retries}</div>
              </div>
              {email.html_message && (
                <details>
                  <summary className="cursor-pointer font-medium">{language === 'it' ? 'Corpo HTML' : 'HTML body'}</summary>
                  <div
                    className="mt-2 border rounded p-3 bg-white max-h-64 overflow-auto"
                    dangerouslySetInnerHTML={{ __html: email.html_message }}
                  />
                </details>
              )}
              {email.logs.length > 0 && (
                <div>
                  <p className="font-medium mb-1">{language === 'it' ? 'Log:' : 'Logs:'}</p>
                  <div className="space-y-1">
                    {email.logs.map(log => (
                      <div key={log.id} className="flex gap-3 text-xs font-mono bg-background border rounded px-2 py-1">
                        <span className="text-muted-foreground">{new Date(log.date).toLocaleString()}</span>
                        <span className={log.status === 2 ? 'text-red-600' : 'text-green-600'}>
                          {STATUS_LABELS[log.status]?.label ?? log.status}
                        </span>
                        <span className="truncate">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function EmailsPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const [toInput, setToInput] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [templateOptions, setTemplateOptions] = useState<string[]>([]);
  const { emails, count, page, setPage, totalPages, loading, error } = useEmails(accessToken ?? '', {
    to: toFilter,
    template: templateFilter,
  });

  useEffect(() => {
    const id = setTimeout(() => setToFilter(toInput.trim()), 400);
    return () => clearTimeout(id);
  }, [toInput]);

  useEffect(() => {
    if (!accessToken) return;
    authFetch('/api/emails/templates/?page_size=100', accessToken)
      .then(res => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { results: { name: string }[] }) => {
        setTemplateOptions(Array.from(new Set(data.results.map(t => t.name))).sort());
      })
      .catch(() => {});
  }, [accessToken]);

  const hasFilters = toInput !== '' || templateFilter !== '';
  const clearFilters = () => {
    setToInput('');
    setTemplateFilter('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === 'it' ? 'Email Inviate' : 'Sent Emails'}</CardTitle>
        <CardDescription>
          {language === 'it' ? `${count} email totali` : `${count} emails total`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Input
            value={toInput}
            onChange={e => setToInput(e.target.value)}
            placeholder={language === 'it' ? 'Filtra per email utente…' : 'Filter by user email…'}
            className="max-w-xs"
          />
          <Select
            value={templateFilter || ALL_TEMPLATES}
            onValueChange={v => setTemplateFilter(v === ALL_TEMPLATES ? '' : v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={language === 'it' ? 'Tutti i template' : 'All templates'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TEMPLATES}>{language === 'it' ? 'Tutti i template' : 'All templates'}</SelectItem>
              {templateOptions.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="size-4 mr-1" />
              {language === 'it' ? 'Cancella filtri' : 'Clear filters'}
            </Button>
          )}
        </div>
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
                  <TableHead>{language === 'it' ? 'Oggetto' : 'Subject'}</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map(email => (
                  <EmailRow key={email.id} email={email} />
                ))}
                {emails.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {language === 'it' ? 'Nessuna email.' : 'No emails.'}
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
