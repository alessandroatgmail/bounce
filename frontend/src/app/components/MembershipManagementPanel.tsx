import { useState, useEffect } from 'react';
import { Loader2, Search, Mail, Phone, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useUserList, type UserListItem } from '../hooks/useUserList';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Textarea } from './ui/textarea';
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
import { StudentMembershipDialog } from './StudentMembershipDialog';

export function MembershipManagementPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { memberships } = useMemberships(accessToken);

  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [page, setPage] = useState(1);
  const [nameInput, setNameInput] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [membershipFilter, setMembershipFilter] = useState<number | ''>('');
  const [selectedEvent, setSelectedEvent] = useState<AdminEventItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [templateNames, setTemplateNames] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [sending, setSending] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Reset page when dropdown filters change
  const handleMembershipFilter = (v: string) => {
    setMembershipFilter(v === 'all' ? '' : Number(v));
    setPage(1);
  };
  const handleEventChange = (event: AdminEventItem | null) => {
    setSelectedEvent(event);
    setPage(1);
  };
  const eventFilter = selectedEvent?.id ?? '';

  const { results: users, count, totalPages, loading, error, refetch } = useUserList(
    accessToken,
    page,
    { name: debouncedName, membership: membershipFilter, event: eventFilter },
  );

  const allSelected = count > 0 && selectedIds.size === count;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleUser = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = async () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    if (!accessToken) return;
    setSelectingAll(true);
    try {
      const params = new URLSearchParams();
      if (debouncedName) params.set('name', debouncedName);
      if (membershipFilter) params.set('membership', String(membershipFilter));
      if (eventFilter) params.set('event', String(eventFilter));
      const res = await authFetch(`/api/auth/users/ids/?${params}`, accessToken);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setSelectedIds(new Set(data.ids));
    } catch {
      toast.error(language === 'it' ? 'Impossibile selezionare tutti.' : 'Failed to select all.');
    } finally {
      setSelectingAll(false);
    }
  };

  const handleSend = async () => {
    if (!accessToken || !templateName || selectedIds.size === 0) return;
    const confirmMsg = language === 'it'
      ? `Inviare l'email a ${selectedIds.size} utenti selezionati?`
      : `Send this email to ${selectedIds.size} selected users?`;
    if (!confirm(confirmMsg)) return;

    setSending(true);
    try {
      const res = await authFetch('/api/emails/send/', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          user_ids: Array.from(selectedIds),
          template: templateName,
          ...(eventFilter ? { event_id: eventFilter } : {}),
          ...(membershipFilter ? { membership_id: membershipFilter } : {}),
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success(language === 'it' ? 'Email in invio.' : 'Emails queued for sending.');
      setSelectedIds(new Set());
    } catch {
      toast.error(language === 'it' ? 'Invio email fallito.' : 'Failed to send emails.');
    } finally {
      setSending(false);
    }
  };

  const phoneNumbersText = phoneNumbers.join(', ');

  const handleOpenPhoneDialog = async () => {
    if (!accessToken || selectedIds.size === 0) return;
    setCopied(false);
    setPhoneNumbers([]);
    setPhoneDialogOpen(true);
    setLoadingPhones(true);
    try {
      const res = await authFetch('/api/auth/users/phones/', accessToken, {
        method: 'POST',
        body: JSON.stringify({ user_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setPhoneNumbers(data.phones);
    } catch {
      toast.error(language === 'it' ? 'Impossibile caricare i numeri.' : 'Failed to load phone numbers.');
    } finally {
      setLoadingPhones(false);
    }
  };

  const handleCopyPhoneNumbers = async () => {
    try {
      await navigator.clipboard.writeText(phoneNumbersText);
      setCopied(true);
      toast.success(language === 'it' ? 'Numeri copiati.' : 'Phone numbers copied.');
    } catch {
      toast.error(language === 'it' ? 'Copia fallita.' : 'Copy failed.');
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
        <CardTitle>{language === 'it' ? 'Gestione Iscrizioni' : 'Membership Management'}</CardTitle>
        <CardDescription>
          {language === 'it' ? 'Visualizza e filtra i soci' : 'Browse and filter members'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 size-4 text-gray-400 pointer-events-none" />
            <Input
              className="pl-8"
              placeholder={language === 'it' ? 'Cerca per nome...' : 'Search by name...'}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
            />
          </div>

          <Select
            value={membershipFilter === '' ? 'all' : String(membershipFilter)}
            onValueChange={handleMembershipFilter}
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
        </div>

        {/* Selection toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-sm text-gray-700">
              {language === 'it' ? `${selectedIds.size} selezionati` : `${selectedIds.size} selected`}
            </span>
            <div className="flex items-center gap-2">
              <Input
                className="w-48"
                list="email-template-names"
                placeholder={language === 'it' ? 'Nome template...' : 'Template name...'}
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
              />
              <datalist id="email-template-names">
                {templateNames.map(name => <option key={name} value={name} />)}
              </datalist>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={sending}>
                {language === 'it' ? 'Deseleziona tutto' : 'Clear selection'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleOpenPhoneDialog}>
                <Phone className="size-3.5 mr-1" />
                {language === 'it' ? 'Esporta numeri' : 'Export numbers'}
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

                  <TableHead>{language === 'it' ? 'Ruolo' : 'Role'}</TableHead>
                  <TableHead>{language === 'it' ? 'Piani attivi' : 'Active plans'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                      {language === 'it' ? 'Nessun socio trovato.' : 'No members found.'}
                    </TableCell>
                  </TableRow>
                ) : users.map(u => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedUser(u)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(u.id)}
                        onCheckedChange={() => toggleUser(u.id)}
                        aria-label={`select ${u.email}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {u.first_name} {u.last_name}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{u.email}</TableCell>
                    <TableCell className="text-sm text-gray-500">{u.phone}</TableCell>

                    <TableCell>
                      <Badge variant="outline">{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.memberships.length === 0 ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.memberships.map(m => (
                            <Badge
                              key={m.id}
                              style={m.color ? { backgroundColor: m.color, color: '#fff' } : undefined}
                            >
                              {m.name}
                            </Badge>
                          ))}
                        </div>
                      )}
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
                    ? `${count} soci totali`
                    : `${count} members total`}
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

      <StudentMembershipDialog
        user={selectedUser}
        open={!!selectedUser}
        onOpenChange={open => { if (!open) setSelectedUser(null); }}
        onChanged={refetch}
      />

      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'it' ? 'Numeri di telefono' : 'Phone numbers'}</DialogTitle>
            <DialogDescription>
              {loadingPhones
                ? (language === 'it' ? 'Caricamento...' : 'Loading...')
                : language === 'it'
                  ? `${phoneNumbers.length} numeri trovati su ${selectedIds.size} soci selezionati.`
                  : `${phoneNumbers.length} numbers found for ${selectedIds.size} selected members.`}
            </DialogDescription>
          </DialogHeader>

          {loadingPhones ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <Textarea
                readOnly
                value={phoneNumbersText}
                onFocus={e => e.currentTarget.select()}
                className="min-h-32 font-mono text-sm"
              />

              <Button onClick={handleCopyPhoneNumbers} disabled={!phoneNumbersText}>
                {copied
                  ? <Check className="size-3.5 mr-1" />
                  : <Copy className="size-3.5 mr-1" />}
                {language === 'it' ? 'Copia' : 'Copy'}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
