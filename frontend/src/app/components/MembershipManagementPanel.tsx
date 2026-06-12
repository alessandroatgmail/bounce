import { useState, useEffect } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useUserList, type UserListItem } from '../hooks/useUserList';
import { useMemberships } from '../hooks/useMemberships';
import { useEvents } from '../hooks/useEvents';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
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
  const { events } = useEvents(accessToken);

  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [page, setPage] = useState(1);
  const [nameInput, setNameInput] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [membershipFilter, setMembershipFilter] = useState<number | ''>('');
  const [eventFilter, setEventFilter] = useState<number | ''>('');

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
  const handleEventFilter = (v: string) => {
    setEventFilter(v === 'all' ? '' : Number(v));
    setPage(1);
  };

  const { results: users, count, totalPages, loading, error, refetch } = useUserList(
    accessToken,
    page,
    { name: debouncedName, membership: membershipFilter, event: eventFilter },
  );

  // Only show parent events (those that have children)
  const parentEvents = events.filter(e => e.events.length > 0);

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

          <Select
            value={eventFilter === '' ? 'all' : String(eventFilter)}
            onValueChange={handleEventFilter}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder={language === 'it' ? 'Tutti gli eventi' : 'All events'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'it' ? 'Tutti gli eventi' : 'All events'}</SelectItem>
              {parentEvents.map(e => (
                <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
                  <TableHead>{language === 'it' ? 'Nome' : 'Name'}</TableHead>
                  <TableHead>{language === 'it' ? 'Email' : 'Email'}</TableHead>
                  <TableHead>{language === 'it' ? 'Ruolo' : 'Role'}</TableHead>
                  <TableHead>{language === 'it' ? 'Piani attivi' : 'Active plans'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                      {language === 'it' ? 'Nessun socio trovato.' : 'No members found.'}
                    </TableCell>
                  </TableRow>
                ) : users.map(u => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedUser(u)}
                  >
                    <TableCell className="font-medium">
                      {u.first_name} {u.last_name}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{u.email}</TableCell>
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
    </Card>
  );
}
