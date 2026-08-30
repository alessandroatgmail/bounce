import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Calendar as CalendarIcon, Clock, Users, Filter, MapPin, Loader2, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { EventJoinPanel } from '../components/EventJoinPanel';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import type { EventItem } from '../hooks/useEvents';
import { useEventsPaginated } from '../hooks/useEventsPaginated';
import { useEventTypes } from '../hooks/useEventTypes';
import { useLevels } from '../hooks/useLevels';

type SpotStatus = 'available' | 'few' | 'soldout';

function spotStatus(availableSpot: number, warningThreshold: number): SpotStatus {
  if (availableSpot <= 0) return 'soldout';
  if (availableSpot <= warningThreshold) return 'few';
  return 'available';
}

const SPOT_STATUS_LABEL: Record<SpotStatus, { it: string; en: string }> = {
  available: { it: 'Disponibile',   en: 'Available'     },
  few:       { it: 'Pochi posti',   en: 'Few spots left' },
  soldout:   { it: 'Esaurito',      en: 'Sold out'       },
};

const SPOT_STATUS_CLASS: Record<SpotStatus, string> = {
  available: 'bg-green-600 text-white',
  few:       'bg-yellow-500 text-white',
  soldout:   'bg-red-600 text-white',
};

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

  const [filterType, setFilterType] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { eventTypes } = useEventTypes(accessToken);
  const { levels } = useLevels(accessToken);
  const allTypes = useMemo(() => eventTypes.map(et => et.name).sort(), [eventTypes]);
  const allLevels = useMemo(() => levels.map(l => l.name).sort(), [levels]);

  const { events, count, page, pageSize, loading, setPage, setFilters } = useEventsPaginated(
    accessToken,
    { upcoming: true, exclude_children: true },
  );

  // Keep hook filters in sync with UI filter controls
  useEffect(() => {
    setFilters({
      upcoming: true,
      exclude_children: true,
      event_type: filterType !== 'all' ? filterType : undefined,
      level: filterLevel !== 'all' ? filterLevel : undefined,
    });
  }, [filterType, filterLevel, setFilters]);

  const filtered = filterMyBookings ? events.filter(e => e.already_booked) : events;

  const eventDates = useMemo(
    () => events.map(e => new Date(e.start_date.slice(0, 10) + 'T00:00:00')),
    [events],
  );

  const eventsOnSelectedDate = selectedDate
    ? filtered.filter(e => e.start_date.slice(0, 10) === selectedDate.toLocaleDateString('sv'))
    : [];

  const totalPages = Math.ceil(count / pageSize);
  const it = language === 'it';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="size-5 text-[#2b2b2b]" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px] border-[#d4b896]">
              <SelectValue placeholder={it ? 'Tipo di Evento' : 'Event Type'} />
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
            <SelectValue placeholder={it ? 'Livello' : 'Level'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{it ? 'Tutti i Livelli' : 'All Levels'}</SelectItem>
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
              {it ? 'Vista Lista' : 'List View'}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-[#d4b896] data-[state=active]:text-[#2b2b2b]">
              {it ? 'Vista Calendario' : 'Calendar View'}
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
                  <EventCard key={event.id} event={event} isAuthenticated={isAuthenticated} language={language} showAvailableSpots={showAvailableSpots} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="border-[#d4b896] disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(p)}
                    className={p === page
                      ? 'bg-[#2b2b2b] text-white hover:bg-[#e67e22]'
                      : 'border-[#d4b896] hover:bg-[#d4b896]/20'}
                  >
                    {p}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="border-[#d4b896] disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}

            {totalPages > 1 && (
              <p className="mt-3 text-center text-sm text-gray-500">
                {it
                  ? `Pagina ${page} di ${totalPages} · ${count} eventi totali`
                  : `Page ${page} of ${totalPages} · ${count} events total`}
              </p>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>{it ? 'Seleziona una Data' : 'Select a Date'}</CardTitle>
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
                        {it ? 'Giorni con eventi' : 'Days with events'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                <h3 className="text-xl font-bold mb-4">
                  {selectedDate
                    ? `${it ? 'Eventi del' : 'Events on'} ${selectedDate.toLocaleDateString(it ? 'it-IT' : 'en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}`
                    : it ? 'Seleziona una data per vedere gli eventi' : 'Select a date to view events'}
                </h3>
                <div className="space-y-4">
                  {eventsOnSelectedDate.length > 0 ? (
                    eventsOnSelectedDate.map(event => (
                      <EventCard key={event.id} event={event} isAuthenticated={isAuthenticated} language={language} showAvailableSpots={showAvailableSpots} />
                    ))
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="text-gray-500">
                          {it ? 'Nessun evento in programma per questa data.' : 'No events scheduled for this date.'}
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
  showAvailableSpots = false,
}: {
  event: EventItem;
  isAuthenticated: boolean;
  language: string;
  showAvailableSpots?: boolean;
}) {
  const navigate = useNavigate();

  const spotsLeft = event.available_spot;
  const isAlmostFull = spotsLeft > 0 && spotsLeft <= event.warning_threshold;
  const status = spotStatus(spotsLeft, event.warning_threshold);
  const date = new Date(event.start_date);
  const time = event.start_date.slice(11, 16);
  const artistLine = event.artists.map(a => a.full_name).join(', ');
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
        <button
          type="button"
          onClick={() => navigate(`/events/${event.id}`)}
          className="flex items-center gap-1 text-sm text-[#e67e22] hover:underline w-fit"
        >
          <Info className="size-3.5" />
          {it ? 'Dettagli' : 'Details'}
        </button>
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
            {time}{!event.multi_events && ` (${event.duration} min)`}
          </div>
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#d4b896]" />
              {showAvailableSpots ? (
                <Badge className={`text-xs ${SPOT_STATUS_CLASS[status]}`}>
                  {SPOT_STATUS_LABEL[status][it ? 'it' : 'en']}
                </Badge>
              ) : (
                <>
                  {event.capacity - event.available_spot} / {event.capacity} {it ? 'iscritti' : 'enrolled'}
                  {isAlmostFull && (
                    <Badge className="ml-2 text-xs bg-[#e67e22] text-white">
                      {it ? 'Quasi Pieno!' : 'Almost Full!'}
                    </Badge>
                  )}
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-[#d4b896]" />
            {event.room.name} — {event.room.location.city.name}
          </div>
        </div>
        {event.info && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">{event.info}</p>
        )}
        <EventJoinPanel event={event} isAuthenticated={isAuthenticated} language={language} />
      </CardContent>
    </Card>
  );
}
