import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Calendar as CalendarIcon, Clock, Users, Filter, MapPin, Loader2, ChevronDown, ChevronUp, CheckCircle, AlertCircle, BookCheck, UserCheck, UserX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useEvents, type EventItem } from '../hooks/useEvents';
import { useMemberships, type Membership } from '../hooks/useMemberships';

export function Events() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-[#2b2b2b] text-white py-16 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4 uppercase tracking-wide">{t('events.title')}</h1>
          <p className="text-lg opacity-90">{t('events.subtitle')}</p>
        </div>
      </div>
      <EventsBrowser />
    </div>
  );
}

// Browsing/booking UI without the page hero, so it can also be embedded in the student dashboard
export function EventsBrowser({
  showAvailableSpots = false,
  filterMyBookings = false,
}: {
  showAvailableSpots?: boolean;
  filterMyBookings?: boolean;
}) {
  const { t, language } = useLanguage();
  const { accessToken, isAuthenticated } = useAuth();
  const { events, loading } = useEvents(accessToken);
  const { memberships, loading: membershipsLoading } = useMemberships(isAuthenticated ? accessToken : null);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  const now = new Date();

  const festivalChildIds = useMemo(
    () => new Set(events.filter(e => e.multi_events).flatMap(e => e.events)),
    [events],
  );

  const upcoming = useMemo(
    () =>
      events
        .filter(e => new Date(e.start_date) >= now && !festivalChildIds.has(e.id))
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()),
    [events, festivalChildIds],
  );

  const allTypes = useMemo(
    () => Array.from(new Set(upcoming.map(e => e.event_type.name))).sort(),
    [upcoming],
  );

  const allLevels = useMemo(
    () => Array.from(new Set(upcoming.filter(e => e.level).map(e => e.level!.name))).sort(),
    [upcoming],
  );

  const filtered = upcoming.filter(e => {
    if (filterMyBookings && !e.already_booked) return false;
    if (filterType !== 'all' && e.event_type.name !== filterType) return false;
    if (filterLevel !== 'all' && e.level?.name !== filterLevel) return false;
    return true;
  });

  const eventDates = useMemo(
    () => upcoming.map(e => new Date(e.start_date.slice(0, 10) + 'T00:00:00')),
    [upcoming],
  );

  const eventsOnSelectedDate = selectedDate
    ? filtered.filter(
        e => e.start_date.slice(0, 10) === selectedDate.toLocaleDateString('sv') // YYYY-MM-DD
      )
    : [];

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="size-5 text-[#2b2b2b]" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px] border-[#d4b896]">
                <SelectValue placeholder={language === 'it' ? 'Tipo di Evento' : 'Event Type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('events.filter.all')}</SelectItem>
                {allTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-[180px] border-[#d4b896]">
              <SelectValue placeholder={language === 'it' ? 'Livello' : 'Level'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'it' ? 'Tutti i Livelli' : 'All Levels'}</SelectItem>
              {allLevels.map(level => (
                <SelectItem key={level} value={level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="size-6 animate-spin text-[#e67e22]" />
          </div>
        ) : (
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="bg-[#2b2b2b]">
              <TabsTrigger value="list" className="data-[state=active]:bg-[#d4b896] data-[state=active]:text-[#2b2b2b]">
                {language === 'it' ? 'Vista Lista' : 'List View'}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="data-[state=active]:bg-[#d4b896] data-[state=active]:text-[#2b2b2b]">
                {language === 'it' ? 'Vista Calendario' : 'Calendar View'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-6">
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">{t('events.noEvents')}</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.map(event => (
                    <EventCard key={event.id} event={event} isAuthenticated={isAuthenticated} language={language} memberships={memberships} membershipsLoading={membershipsLoading} showAvailableSpots={showAvailableSpots} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="calendar" className="mt-6">
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>{language === 'it' ? 'Seleziona una Data' : 'Select a Date'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        className="rounded-md border"
                        modifiers={{ hasEvent: eventDates }}
                        modifiersClassNames={{ hasEvent: 'bg-red-100 text-red-900 font-bold' }}
                      />
                      <div className="mt-4 text-sm text-gray-600">
                        <p className="flex items-center gap-2">
                          <span className="size-4 rounded bg-red-100 border" />
                          {language === 'it' ? 'Giorni con eventi' : 'Days with events'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-2">
                  <h3 className="text-xl font-bold mb-4">
                    {selectedDate
                      ? `${language === 'it' ? 'Eventi del' : 'Events on'} ${selectedDate.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}`
                      : language === 'it' ? 'Seleziona una data per vedere gli eventi' : 'Select a date to view events'}
                  </h3>
                  <div className="space-y-4">
                    {eventsOnSelectedDate.length > 0 ? (
                      eventsOnSelectedDate.map(event => (
                        <EventCard key={event.id} event={event} isAuthenticated={isAuthenticated} language={language} memberships={memberships} membershipsLoading={membershipsLoading} showAvailableSpots={showAvailableSpots} />
                      ))
                    ) : (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <p className="text-gray-500">
                            {language === 'it' ? 'Nessun evento in programma per questa data.' : 'No events scheduled for this date.'}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
    </div>
  );
}

function EventCard({
  event,
  isAuthenticated,
  language,
  memberships,
  membershipsLoading,
  showAvailableSpots = false,
}: {
  event: EventItem;
  isAuthenticated: boolean;
  language: string;
  memberships: Membership[];
  membershipsLoading: boolean;
  showAvailableSpots?: boolean;
}) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [showPanel, setShowPanel] = useState(false);
  const [bookingStep, setBookingStep] = useState<'role' | 'membership'>('membership');
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerCheckStatus, setPartnerCheckStatus] = useState<'idle' | 'checking' | 'found' | 'not_found'>('idle');
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [joinStatus, setJoinStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [joined, setJoined] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);

  const hasRoles = event.event_type.partners > 0 && event.event_type.partner_roles.length > 0;
  const hasLevelChoice = event.multi_events && !event.free && event.children_levels.length > 0;
  const needsExtraStep = hasRoles || hasLevelChoice;

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
      if (partnerId) body.partner_id = partnerId;
      if (selectedLevelId) body.level_id = selectedLevelId;
      const res = await fetch('/api/booking/my-memberships/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setJoined(true);
      setShowPanel(false);
      setJoinStatus('idle');
    } catch {
      setJoinStatus('error');
    }
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

  const spotsLeft = event.available_spot;
  const isAlmostFull = spotsLeft <= 5;
  const date = new Date(event.start_date);
  const time = event.start_date.slice(11, 16);
  const artistLine = event.artists.map(a => a.full_name).join(' & ');
  const it = language === 'it';

  return (
    <Card className="hover:shadow-2xl transition-all duration-300 border-[#d4b896]/20 overflow-hidden group">
      <div className="h-2 shrink-0" style={{ background: event.color ?? 'linear-gradient(to right, #d4b896, #e67e22)' }} />
      {event.effective_image && (
        <img src={event.effective_image} alt={event.name} className="w-full h-auto" />
      )}
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <Badge className="bg-[#d4b896] text-[#2b2b2b]">{event.event_type.name.toUpperCase()}</Badge>
          {event.level && (
            <Badge variant="outline" className="border-[#2b2b2b] text-[#2b2b2b]">{event.level.name}</Badge>
          )}
        </div>
        <CardTitle className="text-xl text-[#2b2b2b] group-hover:text-[#e67e22] transition-colors">
          {event.name}
        </CardTitle>
        {artistLine && (
          <CardDescription className="text-[#6b6b6b]">
            {it ? 'con' : 'with'} {artistLine}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-[#d4b896]" />
            {date.toLocaleDateString(it ? 'it-IT' : 'en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[#d4b896]" />
            {time} ({event.duration} min)
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-[#d4b896]" />
            {showAvailableSpots
              ? <>{event.available_spot} {it ? 'posti disponibili' : 'spots available'}</>
              : <>{event.capacity - event.available_spot} / {event.capacity} {it ? 'iscritti' : 'enrolled'}</>}
            {isAlmostFull && (
              <Badge className="ml-2 text-xs bg-[#e67e22] text-white">
                {it ? 'Quasi Pieno!' : 'Almost Full!'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-[#d4b896]" />
            {event.room.name} — {event.room.location.city.name}
          </div>
        </div>
        {event.info && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">{event.info}</p>
        )}
        <div className="pt-4 border-t border-[#d4b896]/20 space-y-2">
          {joined && (
            <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
              <CheckCircle className="size-4 mt-0.5 flex-shrink-0 text-green-600" />
              {it
                ? "L'abbonamento è stato aggiunto al tuo account, puoi vederlo nella sezione abbonamenti."
                : 'Membership has been added to your account, you can see it in the membership section.'}
            </div>
          )}
          {joinStatus === 'error' && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
              <AlertCircle className="size-4 mt-0.5 flex-shrink-0 text-red-500" />
              {it ? 'Si è verificato un errore. Riprova.' : 'Something went wrong. Please try again.'}
            </div>
          )}
          <div className="flex justify-end">
            {event.already_booked && !joined ? (
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
                  <BookCheck className="size-4" />
                  {it ? 'Già prenotato' : 'Already booked'}
                </div>
                {event.booked_by && (
                  <p className="text-xs text-gray-500">
                    {it ? `Prenotato da ${event.booked_by}` : `Booked by ${event.booked_by}`}
                  </p>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                disabled={joined}
                className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white flex items-center gap-1 disabled:opacity-50"
                onClick={handleJoinClick}
              >
                {isAuthenticated ? (it ? 'Iscriviti' : 'Join') : (it ? 'Diventa Membro' : 'Become a Member')}
                {isAuthenticated && !joined && (
                  showPanel ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                )}
              </Button>
            )}
          </div>
        </div>

        {isAuthenticated && showPanel && !joined && (
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
                {!event.multi_events && membershipsLoading ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="size-4 animate-spin text-[#e67e22]" />
                  </div>
                ) : (() => {
                  const eligible = event.multi_events
                    ? event.memberships
                    : memberships.filter(m => m.rules.some(r => r.event_type.id === event.event_type.id));
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
      </CardContent>
    </Card>
  );
}
