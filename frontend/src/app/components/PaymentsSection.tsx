import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { CreditCard, Crown, FileText, XCircle, Loader2, ChevronDown, ArrowRightLeft } from 'lucide-react';
import type { CheckoutItem } from '../pages/CheckoutPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useUserMemberships, type ContributionStatus, type UserMembership, type LinkedContribution } from '../hooks/useUserMemberships';
import { useEvents } from '../hooks/useEvents';
import { useMyTransactions, type MyTransaction } from '../hooks/useMyTransactions';
import type { PaymentMethod } from '../hooks/usePayments';

// ─── shared helpers ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ContributionStatus, { it: string; en: string }> = {
  received:  { it: 'Ricevuto',   en: 'Received'  },
  accepted:  { it: 'Accettato',  en: 'Accepted'  },
  confirmed: { it: 'Confermato', en: 'Confirmed' },
  payed:     { it: 'Pagato',     en: 'Paid'      },
  waiting:   { it: 'In attesa',  en: 'Waiting'   },
  cancelled: { it: 'Annullato',  en: 'Cancelled' },
};
const STATUS_CLASS: Record<ContributionStatus, string> = {
  received:  'bg-yellow-100 text-yellow-800',
  accepted:  'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-600 text-white',
  payed:     'bg-purple-600 text-white',
  waiting:   'bg-orange-100 text-orange-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

function statusBadge(status: ContributionStatus, lang: 'it' | 'en') {
  return (
    <Badge className={`ml-auto ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status][lang]}
    </Badge>
  );
}

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, { it: string; en: string }> = {
  stripe: { it: 'Carta', en: 'Card' },
  cash:   { it: 'Contanti', en: 'Cash' },
  bank:   { it: 'Bonifico', en: 'Bank transfer' },
};

function transactionCoverageLabel(t: MyTransaction): string {
  const names = t.contributions.flatMap(c =>
    c.events.length > 0 ? c.events.map(e => e.name) : (c.membership_name ? [c.membership_name] : [])
  );
  return names.length > 0 ? names.join(', ') : '—';
}

interface RelatedEntry {
  contribution: LinkedContribution;
  // 'partner' = the other half of a couple booking (same event, other user).
  // 'upgrade' = the same user's contribution before an upgrade — not a partner.
  kind: 'partner' | 'upgrade';
}

function getRelatedContribs(c: UserMembership, contribMap: Map<number, UserMembership>): RelatedEntry[] {
  const seen = new Set<number>();
  const result: RelatedEntry[] = [];

  const add = (item: LinkedContribution, kind: RelatedEntry['kind']) => {
    if (!seen.has(item.id)) { seen.add(item.id); result.push({ contribution: item, kind }); }
  };

  // upgraded_from is always the same user — look it up in contribMap
  if (c.upgraded_from != null) {
    const uc = contribMap.get(c.upgraded_from);
    if (uc) add(uc as unknown as LinkedContribution, 'upgrade');
  }
  // original_contribution and twin_contributions are embedded (may be another user)
  if (c.original_contribution != null) add(c.original_contribution, 'partner');
  (c.twin_contributions ?? []).forEach(item => add(item, 'partner'));

  return result;
}

/** Who pays this contribution, and — for couple bookings — who their partner is. */
interface PayerPartnerInfo {
  payerEmail: string;
  payerRole: string | null;
  partnerEmail: string | null;
  partnerRole: string | null;
}

/** Maps every contribution id (the viewer's own plus any embedded twin/original) to its payer/partner identity. */
function buildPayerPartnerMap(userMemberships: UserMembership[]): Map<number, PayerPartnerInfo> {
  const map = new Map<number, PayerPartnerInfo>();
  userMemberships.forEach(c => {
    const partner = c.twin_contributions[0] ?? c.original_contribution ?? null;
    map.set(c.id, {
      payerEmail: c.user_email,
      payerRole: c.role,
      partnerEmail: partner?.user_email ?? null,
      partnerRole: partner?.role ?? null,
    });
    if (partner) {
      map.set(partner.id, {
        payerEmail: partner.user_email,
        payerRole: partner.role,
        partnerEmail: c.user_email,
        partnerRole: c.role,
      });
    }
  });
  return map;
}

function PayerPartnerLines({
  info, lang, className = 'text-xs text-gray-400',
}: { info: PayerPartnerInfo | undefined; lang: 'it' | 'en'; className?: string }) {
  if (!info) return null;
  return (
    <div className={`${className} space-y-0.5`}>
      <p>
        <span className="font-medium text-gray-500">{lang === 'it' ? 'Paga per:' : 'Pay for:'}</span>{' '}
        {info.payerEmail}{info.payerRole ? ` · ${info.payerRole}` : ''}
      </p>
      {info.partnerEmail && (
        <p>
          <span className="font-medium text-gray-500">Partner:</span>{' '}
          {info.partnerEmail}{info.partnerRole ? ` · ${info.partnerRole}` : ''}
        </p>
      )}
    </div>
  );
}

// ─── Related contribution mini-row ───────────────────────────────────────────

interface RelatedRowProps {
  entry: RelatedEntry;
  eventMap: Map<number, { name: string; end_date: string }>;
  payerPartnerMap: Map<number, PayerPartnerInfo>;
  selected: Set<number>;
  onToggle: (id: number) => void;
  lang: 'it' | 'en';
}

function RelatedContribRow({ entry, eventMap, payerPartnerMap, selected, onToggle, lang }: RelatedRowProps) {
  const c = entry.contribution;
  const firstEvent = c.events[0] != null ? eventMap.get(c.events[0]) : undefined;
  const canPay = c.status === 'accepted';
  // Upgrade history rows are the same user, not a couple — no "Partner" line.
  const info = entry.kind === 'partner' ? payerPartnerMap.get(c.id) : { payerEmail: c.user_email, payerRole: c.role, partnerEmail: null, partnerRole: null };
  return (
    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border">
      <Checkbox
        checked={selected.has(c.id)}
        onCheckedChange={() => onToggle(c.id)}
        disabled={!canPay}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Crown className="size-3.5 text-gray-400 shrink-0" />
          <span className="text-sm font-medium truncate">
            {firstEvent?.name ?? c.membership?.name ?? `#${c.id}`}
          </span>
        </div>
        <PayerPartnerLines info={info} lang={lang} className="text-xs text-gray-400 ml-5" />
      </div>
      <span className="text-sm font-semibold shrink-0">€{c.discounted_amount}</span>
      {statusBadge(c.status, lang === 'it' ? 'it' : 'en')}
    </div>
  );
}

// ─── Ready-to-pay card ───────────────────────────────────────────────────────

interface ReadyCardProps {
  c: UserMembership;
  contribMap: Map<number, UserMembership>;
  eventMap: Map<number, { name: string; end_date: string }>;
  payerPartnerMap: Map<number, PayerPartnerInfo>;
  selected: Set<number>;
  expanded: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  lang: 'it' | 'en';
}

function ReadyCard({
  c, contribMap, eventMap, payerPartnerMap, selected, expanded,
  onToggleSelect, onToggleExpand, lang,
}: ReadyCardProps) {
  const firstEvent = c.events[0] != null ? eventMap.get(c.events[0]) : undefined;
  const related = getRelatedContribs(c, contribMap);
  const isExpanded = expanded.has(c.id);

  return (
    <Card className="border-2 border-[#e67e22] overflow-hidden flex flex-col">
      {c.membership?.color && (
        <div className="h-1.5 shrink-0" style={{ backgroundColor: c.membership.color }} />
      )}
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start gap-2">
          <Checkbox
            checked={selected.has(c.id)}
            onCheckedChange={() => onToggleSelect(c.id)}
            className="mt-0.5 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Crown className="size-4 text-[#e67e22] shrink-0" />
              <span className="font-bold truncate">{firstEvent?.name ?? '—'}</span>
            </div>
            <span className="text-sm text-gray-500 ml-5 block">{c.membership?.name ?? '—'}</span>
            <PayerPartnerLines info={payerPartnerMap.get(c.id)} lang={lang} className="text-xs text-gray-400 ml-5" />
          </div>
          {related.length > 0 && (
            <button
              onClick={() => onToggleExpand(c.id)}
              className="flex items-center gap-0.5 p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
              title={lang === 'it' ? 'Mostra correlati' : 'Show related'}
            >
              <ArrowRightLeft className="size-4 text-gray-500" />
              <ChevronDown
                className={`size-3 text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        {/* Amount */}
        <div className="text-sm text-gray-600">
          {c.discounts.length > 0 ? (
            <>
              <span className="line-through text-gray-400 mr-1">€{c.amount}</span>
              <span className="font-semibold">€{c.discounted_amount}</span>
            </>
          ) : (
            <span className="font-semibold">€{c.amount}</span>
          )}
        </div>

        {/* Discount badges */}
        {c.discounts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.discounts.map(d => (
              <Badge key={d.id} variant="outline" className="text-xs">
                {d.name_ext || d.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Expanded related contributions */}
        {isExpanded && related.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {lang === 'it' ? 'Iscrizioni collegate' : 'Related contributions'}
            </p>
            {related.map(entry => (
              <RelatedContribRow
                key={entry.contribution.id}
                entry={entry}
                eventMap={eventMap}
                payerPartnerMap={payerPartnerMap}
                selected={selected}
                onToggle={onToggleSelect}
                lang={lang}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PaymentsSection() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const lang = language === 'it' ? 'it' : 'en';
  const navigate = useNavigate();
  const location = useLocation();

  const validTabs = ['transactions', 'memberships', 'topay'] as const;
  type PayTab = typeof validTabs[number];
  const initialTab = (() => {
    const t = new URLSearchParams(location.search).get('tab') as PayTab | null;
    return t && (validTabs as readonly string[]).includes(t) ? t : 'transactions';
  })();

  const { userMemberships, loading: contribLoading, cancel: cancelContribution } = useUserMemberships(accessToken);
  const { events: allEvents } = useEvents(accessToken);
  const { transactions: myTransactions, loading: transactionsLoading } = useMyTransactions(accessToken);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const today = new Date().toISOString().split('T')[0];
  const eventMap = useMemo(
    () => new Map(allEvents.map(e => [e.id, e])),
    [allEvents],
  );
  const contribMap = useMemo(
    () => new Map(userMemberships.map(c => [c.id, c])),
    [userMemberships],
  );

  // includes embedded linked contributions (partner's, etc.) for amount lookup
  const linkedMap = useMemo(() => {
    const map = new Map<number, LinkedContribution>();
    userMemberships.forEach(c => {
      if (c.original_contribution) map.set(c.original_contribution.id, c.original_contribution);
      (c.twin_contributions ?? []).forEach(tc => map.set(tc.id, tc));
    });
    return map;
  }, [userMemberships]);

  // who pays each contribution and, for couple bookings, who their partner is
  const payerPartnerMap = useMemo(() => buildPayerPartnerMap(userMemberships), [userMemberships]);

  const readyToPay = userMemberships.filter(c => c.status === 'accepted');
  const activeUserMemberships = userMemberships.filter(c =>
    c.events.length === 0 || c.events.some(eid => (eventMap.get(eid)?.end_date ?? '') >= today)
  );
  const pastUserMemberships = userMemberships.filter(c =>
    c.events.length > 0 && c.events.every(eid => (eventMap.get(eid)?.end_date ?? '') < today)
  );

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleExpand = (id: number) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const totalSelected = [...selected].reduce((sum, id) => {
    const c = contribMap.get(id) ?? linkedMap.get(id);
    return sum + (c ? parseFloat(c.discounted_amount) : 0);
  }, 0);

  const goToCheckout = () => {
    const items: CheckoutItem[] = [...selected].map(id => {
      const c = contribMap.get(id) ?? linkedMap.get(id);
      if (!c) return null;
      const firstEventId = c.events[0];
      const eventName = firstEventId != null ? (eventMap.get(firstEventId)?.name ?? `#${id}`) : `#${id}`;
      const info = payerPartnerMap.get(id);
      return {
        id: c.id,
        eventName,
        membershipName: c.membership?.name ?? '—',
        payerEmail: info?.payerEmail ?? c.user_email,
        payerRole: info?.payerRole ?? c.role,
        partnerEmail: info?.partnerEmail ?? null,
        partnerRole: info?.partnerRole ?? null,
        amount: c.amount,
        discounted_amount: c.discounted_amount,
        discounts: c.discounts.map(d => ({ id: d.id, name: d.name, name_ext: d.name_ext || null })),
        extra_items: c.extra_items,
      };
    }).filter((x): x is CheckoutItem => x !== null);
    navigate('/checkout', { state: { items } });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs defaultValue={initialTab}>
        <TabsList className="bg-[#2b2b2b] mb-6">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-[#e67e22] data-[state=active]:text-white text-gray-300">
            {lang === 'it' ? 'Pagamenti' : 'Transactions'}
          </TabsTrigger>
          <TabsTrigger value="memberships" className="data-[state=active]:bg-[#e67e22] data-[state=active]:text-white text-gray-300">
            {lang === 'it' ? 'Pacchetti' : 'Memberships'}
          </TabsTrigger>
          <TabsTrigger value="topay" className="data-[state=active]:bg-[#e67e22] data-[state=active]:text-white text-gray-300">
            {lang === 'it' ? 'Da Pagare' : 'To Pay'}
            {readyToPay.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[#e67e22] text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                {readyToPay.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Transactions ── */}
        <TabsContent value="transactions">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                {lang === 'it' ? 'Storico Pagamenti' : 'Payment History'}
              </h2>
              {transactionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{lang === 'it' ? 'Data' : 'Date'}</TableHead>
                      <TableHead>{lang === 'it' ? 'Per' : 'For'}</TableHead>
                      <TableHead>{lang === 'it' ? 'Importo' : 'Amount'}</TableHead>
                      <TableHead>{lang === 'it' ? 'Metodo' : 'Method'}</TableHead>
                      <TableHead>{lang === 'it' ? 'Ricevuta' : 'Receipt'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myTransactions.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>
                          {new Date(t.date).toLocaleDateString(
                            lang === 'it' ? 'it-IT' : 'en-GB',
                            { month: 'short', day: 'numeric', year: 'numeric' },
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">{transactionCoverageLabel(t)}</TableCell>
                        <TableCell className="font-semibold">
                          €{t.amount_total} {t.currency.toUpperCase() !== 'EUR' ? t.currency.toUpperCase() : ''}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CreditCard className="size-4" />
                            {PAYMENT_METHOD_LABEL[t.method]?.[lang] ?? t.method}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{t.receipt_number || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {myTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                          {lang === 'it' ? 'Nessun pagamento.' : 'No payments yet.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Memberships / Packs ── */}
        <TabsContent value="memberships">
          {contribLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-8">

              {/* ── 1. Active Packs ── */}
              <section>
                <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                  {lang === 'it' ? 'Pacchetti Attivi' : 'Active Packs'}
                </h2>
                {activeUserMemberships.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    {lang === 'it' ? 'Nessun pacchetto attivo.' : 'No active packs.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeUserMemberships.map(c => {
                      const firstEvent = c.events[0] != null ? eventMap.get(c.events[0]) : undefined;
                      return (
                        <Card key={c.id} className="border-2 border-[#e67e22] overflow-hidden flex flex-col">
                          {c.membership?.color && (
                            <div className="h-1.5 shrink-0" style={{ backgroundColor: c.membership.color }} />
                          )}
                          <CardContent className="p-4 flex flex-col gap-3 flex-1">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <Crown className="size-4 text-[#e67e22]" />
                                <span className="font-bold">{firstEvent?.name ?? '—'}</span>
                                {statusBadge(c.status, lang)}
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
                                  <span className="font-medium">{lang === 'it' ? 'Inizio:' : 'Start:'}</span>{' '}
                                  {new Date(c.start_date).toLocaleDateString(
                                    lang === 'it' ? 'it-IT' : 'en-GB',
                                    { day: 'numeric', month: 'short', year: 'numeric' },
                                  )}
                                </div>
                              )}
                              {c.end_date && (
                                <div>
                                  <span className="font-medium">{lang === 'it' ? 'Scadenza:' : 'Expires:'}</span>{' '}
                                  {new Date(c.end_date).toLocaleDateString(
                                    lang === 'it' ? 'it-IT' : 'en-GB',
                                    { day: 'numeric', month: 'short', year: 'numeric' },
                                  )}
                                </div>
                              )}
                            </div>
                            {c.events.length > 1 && (
                              <div className="flex flex-col gap-1">
                                {c.events.slice(1).map(eid => {
                                  const ev = eventMap.get(eid);
                                  return ev ? (
                                    <span key={eid} className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">
                                      {ev.name}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                            <div className="flex gap-2 mt-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                                disabled={c.status === 'payed' || c.status === 'cancelled'}
                                onClick={() => cancelContribution(c.id)}
                              >
                                <XCircle className="size-3.5 mr-1" />
                                {lang === 'it' ? 'Annulla' : 'Cancel'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── 2. Past Packs ── */}
              {pastUserMemberships.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                    {lang === 'it' ? 'Pacchetti Passati' : 'Past Packs'}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pastUserMemberships.map(c => {
                      const firstEvent = c.events[0] != null ? eventMap.get(c.events[0]) : undefined;
                      return (
                        <Card key={c.id} className="overflow-hidden opacity-60">
                          {c.membership?.color && (
                            <div className="h-1.5" style={{ backgroundColor: c.membership.color }} />
                          )}
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
                                <Badge variant="secondary">{lang === 'it' ? 'Passato' : 'Past'}</Badge>
                                {statusBadge(c.status, lang)}
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
                                +{c.events.length - 1} {lang === 'it' ? 'evento/i' : 'event(s)'}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── ACSI form ── */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-[#2b2b2b] mb-2">
                        {lang === 'it' ? 'Modulo Richiesta Tesseramento ACSI' : 'ACSI Membership Request Form'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {lang === 'it'
                          ? 'Scarica il modulo per la richiesta di tesseramento ACSI da compilare e consegnare.'
                          : 'Download the ACSI membership request form to fill out and submit.'}
                      </p>
                    </div>
                    <Button className="bg-[#e67e22] hover:bg-[#d47420]">
                      <FileText className="size-4 mr-2" />
                      {lang === 'it' ? 'Scarica Modulo' : 'Download Form'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
        </TabsContent>

        {/* ── To Pay ── */}
        <TabsContent value="topay">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              {selected.size > 0 ? (
                <Button className="ml-auto bg-[#e67e22] hover:bg-[#d47420]" onClick={goToCheckout}>
                  <CreditCard className="size-4 mr-2" />
                  {lang === 'it'
                    ? `Paga selezionati (€${totalSelected.toFixed(2)})`
                    : `Pay selected (€${totalSelected.toFixed(2)})`}
                </Button>
              ) : (
                <p className="text-xs text-gray-400">
                  {lang === 'it'
                    ? 'Seleziona uno o più pacchetti per procedere al pagamento.'
                    : 'Select one or more packs to proceed with payment.'}
                </p>
              )}
            </div>
            {readyToPay.length === 0 ? (
              <p className="text-sm text-gray-400">
                {lang === 'it' ? 'Nessun pacchetto da pagare.' : 'No packs pending payment.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {readyToPay.map(c => (
                  <ReadyCard
                    key={c.id}
                    c={c}
                    contribMap={contribMap}
                    eventMap={eventMap as Map<number, { name: string; end_date: string }>}
                    payerPartnerMap={payerPartnerMap}
                    selected={selected}
                    expanded={expanded}
                    onToggleSelect={toggleSelect}
                    onToggleExpand={toggleExpand}
                    lang={lang}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
