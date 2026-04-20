import { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Users, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { mockEvents, DanceEvent } from '../data/mockData';
import { useLanguage } from '../contexts/LanguageContext';

export function Events() {
  const { t, language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'class':
        return 'bg-[#d4b896] text-[#2b2b2b]';
      case 'workshop':
        return 'bg-[#c89968] text-white';
      case 'social':
        return 'bg-[#e67e22] text-white';
      case 'performance':
        return 'bg-[#2b2b2b] text-[#d4b896]';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEvents = mockEvents.filter((event) => {
    const matchesType = filterType === 'all' || event.type === filterType;
    const matchesLevel = filterLevel === 'all' || event.level === filterLevel;
    return matchesType && matchesLevel;
  });

  const upcomingEvents = filteredEvents
    .filter((event) => new Date(event.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const eventsOnSelectedDate = selectedDate
    ? filteredEvents.filter(
        (event) =>
          new Date(event.date).toDateString() === selectedDate.toDateString()
      )
    : [];

  const eventDates = mockEvents.map((event) => new Date(event.date));

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Header */}
      <div className="bg-[#2b2b2b] text-white py-16 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4 uppercase tracking-wide">{t('events.title')}</h1>
          <p className="text-lg opacity-90">
            {t('events.subtitle')}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-6 flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="size-5 text-[#2b2b2b]" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px] border-[#d4b896]">
                <SelectValue placeholder={language === 'it' ? 'Tipo di Evento' : 'Event Type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('events.filter.all')}</SelectItem>
                <SelectItem value="class">{language === 'it' ? 'Corsi' : 'Classes'}</SelectItem>
                <SelectItem value="workshop">{language === 'it' ? 'Workshop' : 'Workshops'}</SelectItem>
                <SelectItem value="social">{language === 'it' ? 'Social Dance' : 'Social Dance'}</SelectItem>
                <SelectItem value="performance">{language === 'it' ? 'Performance' : 'Performance'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-[180px] border-[#d4b896]">
              <SelectValue placeholder={language === 'it' ? 'Livello' : 'Level'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'it' ? 'Tutti i Livelli' : 'All Levels'}</SelectItem>
              <SelectItem value="Beginner">{language === 'it' ? 'Principiante' : 'Beginner'}</SelectItem>
              <SelectItem value="Intermediate">{language === 'it' ? 'Intermedio' : 'Intermediate'}</SelectItem>
              <SelectItem value="Advanced">{language === 'it' ? 'Avanzato' : 'Advanced'}</SelectItem>
              <SelectItem value="All Levels">{language === 'it' ? 'Tutti i Livelli' : 'All Levels'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} getEventTypeColor={getEventTypeColor} />
              ))}
            </div>
            {upcomingEvents.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">{t('events.noEvents')}</p>
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
                      modifiers={{
                        hasEvent: eventDates,
                      }}
                      modifiersClassNames={{
                        hasEvent: 'bg-red-100 text-red-900 font-bold',
                      }}
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
                    ? `${language === 'it' ? 'Eventi del' : 'Events on'} ${selectedDate.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}`
                    : (language === 'it' ? 'Seleziona una data per vedere gli eventi' : 'Select a date to view events')}
                </h3>
                <div className="space-y-4">
                  {eventsOnSelectedDate.length > 0 ? (
                    eventsOnSelectedDate.map((event) => (
                      <EventCard key={event.id} event={event} getEventTypeColor={getEventTypeColor} />
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
      </div>
    </div>
  );
}

function EventCard({
  event,
  getEventTypeColor,
}: {
  event: DanceEvent;
  getEventTypeColor: (type: string) => string;
}) {
  const { language } = useLanguage();
  const spotsLeft = event.maxCapacity - event.currentEnrollment;
  const isAlmostFull = spotsLeft <= 5;

  return (
    <Card className="hover:shadow-2xl transition-all duration-300 border-[#d4b896]/20 overflow-hidden group">
      <div className="h-2 bg-gradient-to-r from-[#d4b896] to-[#e67e22]" />
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <Badge className={getEventTypeColor(event.type)}>
            {event.type.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="border-[#2b2b2b] text-[#2b2b2b]">{event.level}</Badge>
        </div>
        <CardTitle className="text-xl text-[#2b2b2b] group-hover:text-[#e67e22] transition-colors">{event.title}</CardTitle>
        <CardDescription className="text-[#6b6b6b]">
          {language === 'it' ? 'con' : 'with'} {event.instructor}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-[#d4b896]" />
            {new Date(event.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[#d4b896]" />
            {event.time} ({event.duration} min)
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-[#d4b896]" />
            {event.currentEnrollment} / {event.maxCapacity} {language === 'it' ? 'iscritti' : 'enrolled'}
            {isAlmostFull && (
              <Badge className="ml-2 text-xs bg-[#e67e22] text-white">
                {language === 'it' ? 'Quasi Pieno!' : 'Almost Full!'}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{event.description}</p>
        <div className="pt-4 border-t border-[#d4b896]/20 flex justify-end items-center">
          <Button size="sm" className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white">
            {language === 'it' ? 'Diventa Membro' : 'Become a Member'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}