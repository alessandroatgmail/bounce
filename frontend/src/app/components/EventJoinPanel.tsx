import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Loader2, ChevronDown, ChevronUp, AlertCircle, BookCheck, UserCheck, UserX, CreditCard } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAuth } from '../contexts/AuthContext';
import type { EventItem } from '../hooks/useEvents';
import { useUserMemberships } from '../hooks/useUserMemberships';
import type { CheckoutItem } from '../pages/CheckoutPage';

// The join/booking flow for an event: role + partner + level selection,
// membership pick, and the resulting booking call. Shared between the
// events list card and the event's dedicated detail page so both stay in
// sync. Logged-out visitors get a "Become a Member" CTA to /login instead.
export function EventJoinPanel({
  event,
  isAuthenticated,
  language,
}: {
  event: EventItem;
  isAuthenticated: boolean;
  language: string;
}) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const { userMemberships } = useUserMemberships(accessToken);
  const [showPanel, setShowPanel] = useState(false);
  const [bookingStep, setBookingStep] = useState<'role' | 'membership'>('membership');
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerCheckStatus, setPartnerCheckStatus] = useState<'idle' | 'checking' | 'found' | 'not_found'>('idle');
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [joinStatus, setJoinStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [includePartner, setIncludePartner] = useState(true);

  const hasRoles = event.event_type.partners > 0 && event.event_type.partner_roles.length > 0;
  // Case 3 — festival, fixed choice: level + role + partner chosen once,
  // applied to every child event at that level. Books through the
  // dedicated /book-festival/ endpoint, which requires level_id.
  const isFixedFestival = event.multi_events && !event.free;
  const hasLevelChoice = isFixedFestival && event.children_levels.length > 0;
  // A fixed-choice festival with no levels configured on its children has
  // no level to submit — the endpoint requires one, so booking it isn't
  // possible until an admin assigns levels.
  const festivalHasNoLevels = isFixedFestival && event.children_levels.length === 0;
  const needsExtraStep = hasRoles || hasLevelChoice;
  const it = language === 'it';
  // Accepted but unpaid contribution of the current user for this event —
  // when present, offer a direct shortcut to checkout instead of making
  // them find it in the payments section.
  const myAcceptedContribution = userMemberships.find(
    um => um.status === 'accepted' && um.events.includes(event.id)
  );
  // The partner's mirrored contribution for the same booking (couple
  // registrations create a twin on each side) — whichever of the two is
  // still accepted/unpaid, regardless of who originally booked.
  const partnerContribution = myAcceptedContribution && (
    myAcceptedContribution.twin_contributions.find(tc => tc.status === 'accepted')
    ?? (myAcceptedContribution.original_contribution?.status === 'accepted'
        ? myAcceptedContribution.original_contribution
        : undefined)
  );

  useEffect(() => {
    const email = partnerEmail.trim();
    if (!email || !email.includes('@')) {
      setPartnerCheckStatus('idle');
      setPartnerId(null);
      setPartnerName('');
      return;
    }
    setPartnerCheckStatus('checking');
    setPartnerId(null);
    setPartnerName('');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-email/?email=${encodeURIComponent(email)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPartnerId(data.id);
          setPartnerName(`${data.first_name} ${data.last_name}`.trim());
          setPartnerCheckStatus('found');
        } else {
          setPartnerCheckStatus('not_found');
        }
      } catch {
        setPartnerCheckStatus('not_found');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [partnerEmail, accessToken]);

  async function handleSelect(membershipId: number) {
    if (!accessToken) return;
    setJoinStatus('loading');
    try {
      const body: Record<string, unknown> = { membership_id: membershipId, event_id: event.id };
      if (hasRoles && selectedRoleId) body.role_id = selectedRoleId;
      const trimmedPartnerEmail = partnerEmail.trim();
      if (partnerId) {
        body.partner_id = partnerId;
      } else if (hasRoles && trimmedPartnerEmail.includes('@')) {
        // Partner has no account (or the lookup failed): keep the email
        // anyway so the couple is stored on the contribution.
        body.partner_email = trimmedPartnerEmail;
      }
      const url = isFixedFestival
        ? '/api/booking/my-memberships/book-festival/'
        : '/api/booking/my-memberships/';
      if (isFixedFestival || selectedLevelId) body.level_id = selectedLevelId;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      // Full reload rather than local state — the schedule (bookings,
      // available spots) lives in sibling components/hooks that don't
      // share state with this panel, so a reload is the reliable way to
      // bring everything back in sync.
      window.location.reload();
    } catch {
      setJoinStatus('error');
    }
  }

  function goToCheckout() {
    if (!myAcceptedContribution) return;
    type Payable = {
      id: number;
      user_email: string;
      membership: { name: string } | null;
      role: string | null;
      amount: string;
      discounted_amount: string;
      discounts: { id: number; name: string; name_ext: string }[];
    };
    const toItem = (payer: Payable, partner?: Payable): CheckoutItem => ({
      id: payer.id,
      eventName: event.name,
      membershipName: payer.membership?.name ?? '—',
      payerEmail: payer.user_email,
      payerRole: payer.role,
      partnerEmail: partner?.user_email ?? null,
      partnerRole: partner?.role ?? null,
      amount: payer.amount,
      discounted_amount: payer.discounted_amount,
      discounts: payer.discounts.map(d => ({ id: d.id, name: d.name, name_ext: d.name_ext || null })),
    });
    const items = [toItem(myAcceptedContribution, partnerContribution)];
    if (includePartner && partnerContribution) items.push(toItem(partnerContribution, myAcceptedContribution));
    navigate('/checkout', { state: { items } });
  }

  function handleJoinClick() {
    if (!isAuthenticated) return;
    if (event.multi_events && event.free) {
      navigate(`/festival/${event.id}`);
      return;
    }
    const next = !showPanel;
    setShowPanel(next);
    if (next) setBookingStep(needsExtraStep ? 'role' : 'membership');
  }

  return (
    <div>
      <div className="pt-4 border-t border-[#d4b896]/20 space-y-2">
        {joinStatus === 'error' && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="size-4 mt-0.5 flex-shrink-0 text-red-500" />
            {it ? 'Si è verificato un errore. Riprova.' : 'Something went wrong. Please try again.'}
          </div>
        )}
        <div className="flex justify-end">
          {event.already_booked ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
                <BookCheck className="size-4" />
                {it ? 'Già prenotato' : 'Already booked'}
              </div>
              {event.booked_by && (
                <p className="text-xs text-gray-500">
                  {it ? `Prenotato da ${event.booked_by}` : `Booked by ${event.booked_by}`}
                </p>
              )}
              {myAcceptedContribution && (
                <>
                  {partnerContribution && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includePartner}
                        onChange={e => setIncludePartner(e.target.checked)}
                      />
                      {it
                        ? `Includi anche ${partnerContribution.user_email} (€${partnerContribution.discounted_amount})`
                        : `Also pay for ${partnerContribution.user_email} (€${partnerContribution.discounted_amount})`}
                    </label>
                  )}
                  <Button
                    size="sm"
                    className="bg-[#e67e22] hover:bg-[#d47420] text-white flex items-center gap-1"
                    onClick={goToCheckout}
                  >
                    <CreditCard className="size-3.5" />
                    {it ? 'Paga ora' : 'Pay now'}
                  </Button>
                </>
              )}
            </div>
          ) : festivalHasNoLevels ? (
            <p className="text-xs text-gray-500">
              {it
                ? 'Nessun livello configurato per questo festival: contatta la scuola per iscriverti.'
                : 'No levels configured for this festival yet — contact the school to register.'}
            </p>
          ) : isAuthenticated ? (
            <Button
              size="sm"
              className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white flex items-center gap-1"
              onClick={handleJoinClick}
            >
              {it ? 'Iscriviti' : 'Join'}
              {showPanel ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>
          ) : (
            <Link to="/login">
              <Button size="sm" className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white">
                {it ? 'Diventa Membro' : 'Become a Member'}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {isAuthenticated && showPanel && (
        <div className="mt-3 border-t border-[#d4b896]/20 pt-3 space-y-3">

          {/* Step 1: role + partner email + level */}
          {bookingStep === 'role' && (
            <>
              {hasRoles && (
                <>
                  <p className="text-xs font-semibold text-[#2b2b2b] uppercase tracking-wide">
                    {it ? 'Il tuo ruolo' : 'Your role'}
                  </p>
                  <Select
                    value={selectedRoleId ? String(selectedRoleId) : ''}
                    onValueChange={v => setSelectedRoleId(Number(v))}
                  >
                    <SelectTrigger className="border-[#d4b896]">
                      <SelectValue placeholder={it ? 'Seleziona un ruolo...' : 'Select a role...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {event.event_type.partner_roles.map(r => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {hasRoles && (
                <>
                  <p className="text-xs font-semibold text-[#2b2b2b] uppercase tracking-wide">
                    {it ? 'Email del partner (opzionale)' : 'Partner email (optional)'}
                  </p>
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder={it ? 'email@esempio.com' : 'email@example.com'}
                      value={partnerEmail}
                      onChange={e => setPartnerEmail(e.target.value)}
                      className="border-[#d4b896] pr-8"
                    />
                    {partnerCheckStatus === 'checking' && (
                      <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-gray-400" />
                    )}
                    {partnerCheckStatus === 'found' && (
                      <UserCheck className="absolute right-2 top-2.5 size-4 text-green-600" />
                    )}
                    {partnerCheckStatus === 'not_found' && (
                      <UserX className="absolute right-2 top-2.5 size-4 text-red-400" />
                    )}
                  </div>
                  {partnerCheckStatus === 'found' && partnerName && (
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <UserCheck className="size-3" />
                      {partnerName}
                    </p>
                  )}
                  {partnerCheckStatus === 'not_found' && (
                    <p className="text-xs text-amber-600">
                      {it
                        ? 'Utente non trovato. Potrai aggiungere il partner in seguito.'
                        : "User not found. You can add a partner later."}
                    </p>
                  )}
                </>
              )}

              {hasLevelChoice && (
                <>
                  <p className="text-xs font-semibold text-[#2b2b2b] uppercase tracking-wide">
                    {it ? 'Il tuo livello' : 'Your level'}
                  </p>
                  <Select
                    value={selectedLevelId ? String(selectedLevelId) : ''}
                    onValueChange={v => setSelectedLevelId(Number(v))}
                  >
                    <SelectTrigger className="border-[#d4b896]">
                      <SelectValue placeholder={it ? 'Seleziona un livello...' : 'Select a level...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {event.children_levels.map(l => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={
                    (hasRoles && !selectedRoleId) ||
                    (hasLevelChoice && !selectedLevelId)
                  }
                  className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white disabled:opacity-50"
                  onClick={() => setBookingStep('membership')}
                >
                  {it ? 'Continua' : 'Continue'}
                </Button>
              </div>
            </>
          )}

          {/* Step 2: membership selection */}
          {bookingStep === 'membership' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#2b2b2b] uppercase tracking-wide">
                  {it ? 'Scegli un abbonamento' : 'Choose a membership'}
                </p>
                {needsExtraStep && (
                  <button
                    className="text-xs text-gray-400 hover:text-[#e67e22] underline"
                    onClick={() => setBookingStep('role')}
                  >
                    {it ? '← Indietro' : '← Back'}
                  </button>
                )}
              </div>
              {(() => {
                const eligible = event.memberships;
                return eligible.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    {it ? 'Nessun abbonamento disponibile per questo tipo di evento.' : 'No memberships available for this event type.'}
                  </p>
                ) : (
                  eligible.map(m => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-md border border-[#d4b896]/40 px-3 py-2 hover:bg-[#d4b896]/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {m.color && (
                          <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                        )}
                        <div>
                          <p className="text-sm font-medium text-[#2b2b2b]">{m.name}</p>
                          <p className="text-xs text-gray-500">
                            {m.duration} {it ? 'gg' : 'days'} · {m.max_events} {it ? 'eventi' : 'events'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#e67e22]">€{m.contribution}</span>
                        {event.already_booked ? (
                          <Badge className="h-7 text-xs bg-green-100 text-green-800 border border-green-200">
                            <BookCheck className="size-3 mr-1" />
                            {it ? 'Prenotato' : 'Booked'}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={joinStatus === 'loading'}
                            className="h-7 text-xs border-[#2b2b2b] hover:bg-[#2b2b2b] hover:text-white"
                            onClick={() => handleSelect(m.id)}
                          >
                            {joinStatus === 'loading'
                              ? <Loader2 className="size-3 animate-spin" />
                              : (it ? 'Seleziona' : 'Select')}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
