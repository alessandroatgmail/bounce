import { useMemo } from 'react';
import { CreditCard, Crown, FileText, XCircle, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useUserMemberships, type ContributionStatus } from '../hooks/useUserMemberships';
import { useEvents } from '../hooks/useEvents';
import { mockPayments } from '../data/mockData';

export function PaymentsSection() {
  const { user, accessToken } = useAuth();
  const { language } = useLanguage();
  const { userMemberships, loading: contribLoading } = useUserMemberships(accessToken);
  const { events: allEvents } = useEvents(accessToken);

  const today = new Date().toISOString().split('T')[0];
  const eventMap = useMemo(() => new Map(allEvents.map(e => [e.id, e])), [allEvents]);

  const activeUserMemberships = userMemberships.filter(c =>
    c.events.length === 0 || c.events.some(eid => (eventMap.get(eid)?.end_date ?? '') >= today)
  );
  const pastUserMemberships = userMemberships.filter(c =>
    c.events.length > 0 && c.events.every(eid => (eventMap.get(eid)?.end_date ?? '') < today)
  );

  const userPayments = user ? mockPayments.filter(p => p.userId === user.id) : [];

  const STATUS_LABEL: Record<ContributionStatus, { it: string; en: string }> = {
    received:  { it: 'Ricevuto',   en: 'Received'  },
    accepted:  { it: 'Accettato',  en: 'Accepted'  },
    confirmed: { it: 'Confermato', en: 'Confirmed' },
    payed:     { it: 'Pagato',     en: 'Paid'      },
  };
  const STATUS_CLASS: Record<ContributionStatus, string> = {
    received:  'bg-yellow-100 text-yellow-800',
    accepted:  'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-600 text-white',
    payed:     'bg-purple-600 text-white',
  };

  const statusBadge = (status: ContributionStatus) => (
    <Badge className={`ml-auto ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status][language === 'it' ? 'it' : 'en']}
    </Badge>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs defaultValue="transactions">
        <TabsList className="bg-[#2b2b2b] mb-6">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-[#e67e22] data-[state=active]:text-white text-gray-300">
            {language === 'it' ? 'Pagamenti' : 'Transactions'}
          </TabsTrigger>
          <TabsTrigger value="memberships" className="data-[state=active]:bg-[#e67e22] data-[state=active]:text-white text-gray-300">
            {language === 'it' ? 'Pacchetti' : 'Memberships'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                {language === 'it' ? 'Storico Pagamenti' : 'Payment History'}
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'it' ? 'ID Transazione' : 'Transaction ID'}</TableHead>
                    <TableHead>{language === 'it' ? 'Data' : 'Date'}</TableHead>
                    <TableHead>{language === 'it' ? 'Importo' : 'Amount'}</TableHead>
                    <TableHead>{language === 'it' ? 'Metodo' : 'Method'}</TableHead>
                    <TableHead>{language === 'it' ? 'Stato' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userPayments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">{payment.id}</TableCell>
                      <TableCell>
                        {new Date(payment.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="font-semibold">€{payment.amount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CreditCard className="size-4" />
                          {payment.method.replace('_', ' ')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={payment.status === 'completed' ? 'default' : payment.status === 'pending' ? 'secondary' : 'destructive'}
                        >
                          {language === 'it'
                            ? (payment.status === 'completed' ? 'Completato' : payment.status === 'pending' ? 'In Attesa' : 'Annullato')
                            : payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memberships">
          {contribLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Active memberships */}
              <section>
                <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                  {language === 'it' ? 'Pacchetti Attivi' : 'Active Packs'}
                </h2>
                {activeUserMemberships.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    {language === 'it' ? 'Nessun pacchetto attivo.' : 'No active packs.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeUserMemberships.map(c => {
                      const firstEvent = c.events[0] != null ? eventMap.get(c.events[0]) : undefined;
                      return (
                        <Card key={c.id} className="border-2 border-[#e67e22] overflow-hidden flex flex-col">
                          {c.membership?.color && <div className="h-1.5 shrink-0" style={{ backgroundColor: c.membership.color }} />}
                          <CardContent className="p-4 flex flex-col gap-3 flex-1">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <Crown className="size-4 text-[#e67e22]" />
                                <span className="font-bold">{firstEvent?.name ?? '—'}</span>
                                {statusBadge(c.status)}
                              </div>
                              <span className="text-sm text-gray-500 pl-6">{c.membership?.name ?? '—'}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {c.discounts.length > 0 ? (
                                <>
                                  <span className="line-through text-gray-400 mr-1">€{c.amount}</span>
                                  <span className="font-medium">€{c.discounted_amount}</span>
                                </>
                              ) : <>€{c.amount}</>}
                            </div>
                            {c.discounts.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {c.discounts.map(d => (
                                  <Badge key={d.id} variant="outline" className="text-xs">
                                    {d.name_ext || d.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 space-y-0.5">
                              {c.start_date && (
                                <div>
                                  <span className="font-medium">{language === 'it' ? 'Inizio:' : 'Start:'}</span>{' '}
                                  {new Date(c.start_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                              )}
                              {c.end_date && (
                                <div>
                                  <span className="font-medium">{language === 'it' ? 'Scadenza:' : 'Expires:'}</span>{' '}
                                  {new Date(c.end_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                              )}
                            </div>
                            {c.events.length > 1 && (
                              <div className="flex flex-col gap-1">
                                {c.events.slice(1).map(eid => {
                                  const ev = eventMap.get(eid);
                                  return ev ? (
                                    <span key={eid} className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">{ev.name}</span>
                                  ) : null;
                                })}
                              </div>
                            )}
                            <div className="flex gap-2 mt-auto">
                              <Button
                                size="sm"
                                className="flex-1 bg-[#e67e22] hover:bg-[#d47420]"
                                disabled={c.status !== 'accepted'}
                              >
                                <CreditCard className="size-3.5 mr-1" />
                                {language === 'it' ? 'Paga' : 'Pay'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                                disabled={c.status === 'payed'}
                              >
                                <XCircle className="size-3.5 mr-1" />
                                {language === 'it' ? 'Annulla' : 'Cancel'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Past memberships */}
              {pastUserMemberships.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                    {language === 'it' ? 'Pacchetti Passati' : 'Past Packs'}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pastUserMemberships.map(c => {
                      const firstEvent = c.events[0] != null ? eventMap.get(c.events[0]) : undefined;
                      return (
                        <Card key={c.id} className="overflow-hidden opacity-60">
                          {c.membership?.color && <div className="h-1.5" style={{ backgroundColor: c.membership.color }} />}
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <Crown className="size-4 text-gray-400" />
                                  <span className="font-bold">{firstEvent?.name ?? '—'}</span>
                                </div>
                                <span className="text-sm text-gray-500 pl-6">{c.membership?.name ?? '—'}</span>
                              </div>
                              <div className="flex gap-1">
                                <Badge variant="secondary">{language === 'it' ? 'Passato' : 'Past'}</Badge>
                                {statusBadge(c.status)}
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">
                              {c.discounts.length > 0 ? (
                                <>
                                  <span className="line-through text-gray-400 mr-1">€{c.amount}</span>
                                  <span className="font-medium">€{c.discounted_amount}</span>
                                </>
                              ) : <>€{c.amount}</>}
                            </div>
                            {c.events.length > 1 && (
                              <div className="text-xs text-gray-400 mt-1">
                                +{c.events.length - 1} {language === 'it' ? 'evento/i' : 'event(s)'}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ACSI form download */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-[#2b2b2b] mb-2">
                        {language === 'it' ? 'Modulo Richiesta Tesseramento ACSI' : 'ACSI Membership Request Form'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {language === 'it'
                          ? 'Scarica il modulo per la richiesta di tesseramento ACSI da compilare e consegnare.'
                          : 'Download the ACSI membership request form to fill out and submit.'}
                      </p>
                    </div>
                    <Button className="bg-[#e67e22] hover:bg-[#d47420]">
                      <FileText className="size-4 mr-2" />
                      {language === 'it' ? 'Scarica Modulo' : 'Download Form'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
