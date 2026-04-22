import { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Users, Filter, MapPin, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useEvents, type EventItem } from '../hooks/useEvents';

export function Events() {
  const { t, language } = useLanguage();
  const { accessToken, isAuthenticated } = useAuth();
  const { events, loading } = useEvents(accessToken);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  const now = new Date();

  const upcoming = useMemo(
    () =>
      events
        .filter(e => new Date(e.start_date) >= now)
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()),
    [events],
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
    <div className="min-h-screen bg-white">
      <div className="bg-[#2b2b2b] text-white py-16 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4 uppercase tracking-wide">{t('events.title')}</h1>
          <p className="text-lg opacity-90">{t('events.subtitle')}</p>
        </div>
      </div>

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
                    <EventCard key={event.id} event={event} isAuthenticated={isAuthenticated} language={language} />
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
                        <EventCard key={event.id} event={event} isAuthenticated={isAuthenticated} language={language} />
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
    </div>
  );
}

function EventCard({
  event,
  isAuthenticated,
  language,
}: {
  event: EventItem;
  isAuthenticated: boolean;
  language: string;
}) {
  const spotsLeft = event.capacity;
  const isAlmostFull = spotsLeft <= 5;

  const date = new Date(event.start_date);
  const time = event.start_date.slice(11, 16);
  const artistLine = event.artists.map(a => a.full_name).join(' & ');

  return (
    <Card className="hover:shadow-2xl transition-all duration-300 border-[#d4b896]/20 overflow-hidden group">
      <div className="h-2" style={{ background: event.color ?? 'linear-gradient(to right, #d4b896, #e67e22)' }} />
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
            {language === 'it' ? 'con' : 'with'} {artistLine}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-[#d4b896]" />
            {date.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[#d4b896]" />
            {time} ({event.duration} min)
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-[#d4b896]" />
            0 / {event.capacity} {language === 'it' ? 'iscritti' : 'enrolled'}
            {isAlmostFull && (
              <Badge className="ml-2 text-xs bg-[#e67e22] text-white">
                {language === 'it' ? 'Quasi Pieno!' : 'Almost Full!'}
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
        <div className="pt-4 border-t border-[#d4b896]/20 flex justify-end items-center">
          <Button size="sm" className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white">
            {isAuthenticated
              ? (language === 'it' ? 'Iscriviti' : 'Join')
              : (language === 'it' ? 'Diventa Membro' : 'Become a Member')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
