import { useState, useEffect } from 'react';
import { Loader2, Search, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useContributionAdminList, type ContributionAdminListItem } from '../hooks/useContributionAdminList';
import { useMemberships } from '../hooks/useMemberships';
import type { AdminEventItem } from '../hooks/useAdminEventsPaginated';
import { authFetch } from '../../lib/api';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { EventPickerInput } from './EventPickerInput';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
  PaginationEllipsis,
} from './ui/pagination';

const STATUS_CHOICES = [
  { value: 'received',  label_it: 'Ricevuto',  label_en: 'Received'  },
  { value: 'accepted',  label_it: 'Accettato',  label_en: 'Accepted'  },
  { value: 'confirmed', label_it: 'Confermato', label_en: 'Confirmed' },
  { value: 'payed',     label_it: 'Pagato',     label_en: 'Payed'     },
  { value: 'cancelled', label_it: 'Annullato',  label_en: 'Cancelled' },
  { value: 'waiting',   label_it: 'In attesa',  label_en: 'Waiting'   },
  { value: 'approving', label_it: 'In approvazione', label_en: 'Approving' },
];

export function ContributionsManagementPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { memberships } = useMemberships(accessToken);

  const [page, setPage] = useState(1);
  const [nameInput, setNameInput] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [planFilter, setPlanFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AdminEventItem | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [templateNames, setTemplateNames] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [sending, setSending] = useState(false);

  // Template names for the send-email picker — language variants share a name.
  useEffect(() => {
    if (!accessToken) return;
    authFetch('/api/emails/templates/?page_size=100', accessToken)
      .then(res => res.json())
      .then(data => {
        const names: string[] = Array.from(new Set(data.results.map((t: { name: string }) => t.name)));
        setTemplateNames(names);
      })
      .catch(() => {});
  }, [accessToken]);

  // Debounce name input 300 ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedName(nameInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [nameInput]);

  const handlePlanFilter = (v: string) => {
    setPlanFilter(v === 'all' ? '' : Number(v));
    setPage(1);
  };
  const handleStatusFilter = (v: string) => {
    setStatusFilter(v === 'all' ? '' : v);
    setPage(1);
  };
  const handleEventChange = (event: AdminEventItem | null) => {
    setSelectedEvent(event);
    setPage(1);
  };
  const handleDateFromChange = (v: string) => { setDateFrom(v); setPage(1); };
  const handleDateToChange = (v: string) => { setDateTo(v); setPage(1); };
  const eventFilter = selectedEvent?.id ?? '';

  const { results: contributions, count, totalPages, loading, error } = useContributionAdminList(
    accessToken,
    page,
    { name: debouncedName, event: eventFilter, plan: planFilter, status: statusFilter, date_from: dateFrom, date_to: dateTo },
  );

  const allSelected = count > 0 && selectedIds.size === count;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleContribution = (row: ContributionAdminListItem) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
      return next;
    });
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (selectedIds.has(row.id)) next.delete(row.user); else next.add(row.user);
      return next;
    });
  };

  const handleToggleSelectAll = async () => {
    if (allSelected) {
      setSelectedIds(new Set());
      setSelectedUserIds(new Set());
      return;
    }
    if (!accessToken) return;
    setSelectingAll(true);
    try {
      const params = new URLSearchParams();
      if (debouncedName) params.set('name', debouncedName);
      if (eventFilter)   params.set('event', String(eventFilter));
      if (planFilter)    params.set('plan', String(planFilter));
      if (statusFilter)  params.set('status', statusFilter);
      if (dateFrom)      params.set('date_from', dateFrom);
      if (dateTo)        params.set('date_to', dateTo);
      const res = await authFetch(`/api/booking/contributions-admin/ids/?${params}`, accessToken);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setSelectedIds(new Set(data.ids));
      setSelectedUserIds(new Set(data.user_ids));
    } catch {
      toast.error(language === 'it' ? 'Impossibile selezionare tutti.' : 'Failed to select all.');
    } finally {
      setSelectingAll(false);
    }
  };

  const handleSend = async () => {
    if (!accessToken || !templateName || selectedUserIds.size === 0) return;
    const confirmMsg = language === 'it'
      ? `Inviare l'email a ${selectedUserIds.size} utenti selezionati?`
      : `Send this email to ${selectedUserIds.size} selected users?`;
    if (!confirm(confirmMsg)) return;

    setSending(true);
    try {
      const res = await authFetch('/api/emails/send/', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          user_ids: Array.from(selectedUserIds),
          template: templateName,
          ...(eventFilter ? { event_id: eventFilter } : {}),
          ...(planFilter ? { membership_id: planFilter } : {}),
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success(language === 'it' ? 'Email in invio.' : 'Emails queued for sending.');
      setSelectedIds(new Set());
      setSelectedUserIds(new Set());
    } catch {
      toast.error(language === 'it' ? 'Invio email fallito.' : 'Failed to send emails.');
    } finally {
      setSending(false);
    }
  };

  const goTo = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));

  const pageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
    if (page >= totalPages - 3) return [1, 'ellipsis', ...Array.from({ length: 5 }, (_, i) => totalPages - 4 + i)];
    return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === 'it' ? 'Gestione Contributi' : 'Contributions Management'}</CardTitle>
        <CardDescription>
          {language === 'it' ? 'Visualizza e filtra i contributi' : 'Browse and filter contributions'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 size-4 text-gray-400 pointer-events-none" />
            <Input
              className="pl-8"
              placeholder={language === 'it' ? 'Cerca per nome o email...' : 'Search by name or email...'}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
            />
          </div>

          <Select
            value={planFilter === '' ? 'all' : String(planFilter)}
            onValueChange={handlePlanFilter}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder={language === 'it' ? 'Tutti i piani' : 'All plans'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'it' ? 'Tutti i piani' : 'All plans'}</SelectItem>
              {memberships.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter === '' ? 'all' : statusFilter}
            onValueChange={handleStatusFilter}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder={language === 'it' ? 'Tutti gli stati' : 'All statuses'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'it' ? 'Tutti gli stati' : 'All statuses'}</SelectItem>
              {STATUS_CHOICES.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  {language === 'it' ? s.label_it : s.label_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-56">
            <EventPickerInput
              token={accessToken}
              value={selectedEvent}
              onChange={handleEventChange}
              placeholder={language === 'it' ? 'Tutti gli eventi' : 'All events'}
              getLabel={e => `${e.name} - ${new Date(e.start_date).toLocaleDateString(
                language === 'it' ? 'it-IT' : 'en-GB', { month: 'long', year: 'numeric' },
              )}`}
            />
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-40"
              value={dateFrom}
              onChange={e => handleDateFromChange(e.target.value)}
            />
            <span className="text-sm text-gray-400">{language === 'it' ? 'a' : 'to'}</span>
            <Input
              type="date"
              className="w-40"
              value={dateTo}
              onChange={e => handleDateToChange(e.target.value)}
            />
          </div>
        </div>

        {/* Selection toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-sm text-gray-700">
              {language === 'it'
                ? `${selectedIds.size} contributi selezionati (${selectedUserIds.size} utenti)`
                : `${selectedIds.size} contributions selected (${selectedUserIds.size} users)`}
            </span>
            <div className="flex items-center gap-2">
              <Input
                className="w-48"
                list="contribution-email-template-names"
                placeholder={language === 'it' ? 'Nome template...' : 'Template name...'}
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
              />
              <datalist id="contribution-email-template-names">
                {templateNames.map(name => <option key={name} value={name} />)}
              </datalist>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setSelectedIds(new Set()); setSelectedUserIds(new Set()); }}
                disabled={sending}
              >
                {language === 'it' ? 'Deseleziona tutto' : 'Clear selection'}
              </Button>
              <Button size="sm" onClick={handleSend} disabled={sending || !templateName}>
                {sending
                  ? <Loader2 className="size-3.5 mr-1 animate-spin" />
                  : <Mail className="size-3.5 mr-1" />}
                {language === 'it' ? 'Invia email' : 'Send email'}
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 py-4">{error}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={handleToggleSelectAll}
                      disabled={selectingAll}
                      aria-label={language === 'it' ? 'Seleziona tutti' : 'Select all'}
                    />
                  </TableHead>
                  <TableHead>{language === 'it' ? 'Nome' : 'Name'}</TableHead>
                  <TableHead>{language === 'it' ? 'Email' : 'Email'}</TableHead>
                  <TableHead>{language === 'it' ? 'Telefono' : 'Phone'}</TableHead>
                  <TableHead>{language === 'it' ? 'Data' : 'Date'}</TableHead>
                  <TableHead>{language === 'it' ? 'Evento' : 'Event'}</TableHead>
                  <TableHead>{language === 'it' ? 'Piano' : 'Plan'}</TableHead>
                  <TableHead>{language === 'it' ? 'Stato' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contributions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                      {language === 'it' ? 'Nessun contributo trovato.' : 'No contributions found.'}
                    </TableCell>
                  </TableRow>
                ) : contributions.map(row => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        onCheckedChange={() => toggleContribution(row)}
                        aria-label={`select ${row.email}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell className="text-sm text-gray-500">{row.email}</TableCell>
                    <TableCell className="text-sm text-gray-500">{row.phone}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(row.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB')}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{row.event ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{row.plan ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-gray-500">
                  {language === 'it'
                    ? `${count} contributi totali`
                    : `${count} contributions total`}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => goTo(page - 1)}
                        className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>

                    {pageNumbers().map((n, i) =>
                      n === 'ellipsis' ? (
                        <PaginationItem key={`ellipsis-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={n}>
                          <PaginationLink
                            isActive={n === page}
                            onClick={() => goTo(n)}
                            className="cursor-pointer"
                          >
                            {n}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => goTo(page + 1)}
                        className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
