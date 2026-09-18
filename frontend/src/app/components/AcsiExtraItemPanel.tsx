import { useState } from 'react';
import { Loader2, Crown, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAcsiExtraItems } from '../hooks/useAcsiExtraItems';
import { type UserListItem } from '../hooks/useUserList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { StudentMembershipDialog } from './StudentMembershipDialog';
import { UserProfileDialog } from './UserProfileDialog';
import { UserPickerInput } from './UserPickerInput';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
  PaginationEllipsis,
} from './ui/pagination';

interface MembershipDialogUser {
  id: number;
  first_name: string;
  last_name: string;
}

function formatDate(iso: string | null, locale: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AcsiExtraItemPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'it' ? 'it-IT' : 'en-GB';

  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState<UserListItem | null>(null);
  const { results, count, totalPages, loading, error, refetch } = useAcsiExtraItems(
    accessToken, page, userFilter?.id ?? '',
  );
  const [membershipUser, setMembershipUser] = useState<MembershipDialogUser | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const handleUserFilterChange = (user: UserListItem | null) => {
    setUserFilter(user);
    setPage(1);
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
        <CardTitle>{language === 'it' ? 'Tessere ACSI' : 'ACSI Cards'}</CardTitle>
        <CardDescription>
          {language === 'it'
            ? 'Iscrizioni con tessera ACSI, in ordine di evento più vicino'
            : 'Registrations with an ACSI card, soonest event first'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="w-72">
          <UserPickerInput
            token={accessToken}
            value={userFilter}
            onChange={handleUserFilterChange}
            placeholder={language === 'it' ? 'Filtra per utente...' : 'Filter by user...'}
          />
        </div>

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
                  <TableHead>{language === 'it' ? 'Nome' : 'First name'}</TableHead>
                  <TableHead>{language === 'it' ? 'Cognome' : 'Last name'}</TableHead>
                  <TableHead>{language === 'it' ? 'Scadenza ACSI' : 'ACSI expiration'}</TableHead>
                  <TableHead>{language === 'it' ? 'Primo evento' : 'First event'}</TableHead>
                  <TableHead>{language === 'it' ? 'Data evento' : 'Event date'}</TableHead>
                  <TableHead className="w-20">{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                      {language === 'it' ? 'Nessuna tessera ACSI trovata.' : 'No ACSI cards found.'}
                    </TableCell>
                  </TableRow>
                ) : results.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.user.first_name}</TableCell>
                    <TableCell className="font-medium">{item.user.last_name}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(item.user.acsi_expiration_date, locale)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{item.event_name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(item.event_start_date, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title={language === 'it' ? 'Gestione iscrizioni' : 'Membership management'}
                          onClick={() => setMembershipUser({
                            id: item.user.id, first_name: item.user.first_name, last_name: item.user.last_name,
                          })}
                        >
                          <Crown className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={language === 'it' ? 'Profilo utente' : 'User profile'}
                          onClick={() => { setProfileUserId(item.user.id); setProfileDialogOpen(true); }}
                        >
                          <User className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-gray-500">
                  {language === 'it' ? `${count} tessere totali` : `${count} cards total`}
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
        user={membershipUser}
        open={!!membershipUser}
        onOpenChange={open => { if (!open) setMembershipUser(null); }}
        onChanged={refetch}
      />

      <UserProfileDialog
        userId={profileUserId}
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
      />
    </Card>
  );
}
