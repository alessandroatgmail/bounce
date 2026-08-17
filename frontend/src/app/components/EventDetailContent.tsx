import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl, authFetch } from '../../lib/api';
import { useEvents, type EventItem } from '../hooks/useEvents';
import { useEventDescription } from '../hooks/useEventDescription';
import { renderEventDescriptionHtml } from '../../lib/eventDescriptionBlocks';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { EventJoinPanel } from './EventJoinPanel';
import { EventScheduleTable } from './EventScheduleTable';

// The event's full description (image, title, rendered HTML), with a back
// arrow. Used both as a standalone page (public visitors) and nested inside
// AppShell's events section (dashboard users), so it carries no page chrome
// of its own — the caller decides what wraps it.
export function EventDetailContent({ eventId, onBack }: { eventId: number; onBack: () => void }) {
  const { language } = useLanguage();
  const { accessToken, isAuthenticated } = useAuth();
  const it = language === 'it';

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = accessToken
        ? await authFetch(`/api/events/events/${eventId}/`, accessToken)
        : await fetch(apiUrl(`/api/events/events/${eventId}/`));
      if (!res.ok) throw new Error(`${res.status}`);
      setEvent(await res.json());
    } catch {
      setError(it ? "Impossibile caricare l'evento." : 'Failed to load the event.');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId, accessToken, it]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  // Full event list, used only to resolve a festival's child events for the
  // description's dynamic Schedule block.
  const { events: allEvents } = useEvents(accessToken);
  const children = useMemo(
    () => (event ? allEvents.filter(e => event.events.includes(e.id)) : []),
    [event, allEvents],
  );

  const { desc, loading: descLoading, error: descError, fetchDescription } = useEventDescription();
  useEffect(() => {
    if (event) fetchDescription(event.id, language);
  }, [event, language, fetchDescription]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button
        variant="ghost"
        onClick={onBack}
        className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4 -ml-3"
      >
        <ArrowLeft className="size-4" />
        {it ? 'Indietro' : 'Back'}
      </Button>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-[#e67e22]" />
        </div>
      ) : error || !event ? (
        <p className="text-sm text-red-600">
          {error ?? (it ? 'Evento non trovato.' : 'Event not found.')}
        </p>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-[#2b2b2b] mb-6">{event.name}</h1>

          <div className="mb-8">
            <EventJoinPanel event={event} isAuthenticated={isAuthenticated} language={language} />
          </div>

          {event.effective_image && (
            <Accordion type="single" collapsible defaultValue="image" className="mb-2">
              <AccordionItem value="image" className="border-none">
                <AccordionTrigger className="text-[#2b2b2b] text-base font-semibold py-2">
                  {it ? 'Immagine' : 'Image'}
                </AccordionTrigger>
                <AccordionContent>
                  <img src={event.effective_image} alt={event.name} className="w-full h-auto rounded-lg" />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          <Accordion type="single" collapsible defaultValue="description" className="mb-2">
            <AccordionItem value="description" className="border-none">
              <AccordionTrigger className="text-[#2b2b2b] text-base font-semibold py-2">
                {it ? 'Descrizione' : 'Description'}
              </AccordionTrigger>
              <AccordionContent>
                {descLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-[#e67e22]" />
                  </div>
                ) : descError ? (
                  <p className="text-sm text-red-600">
                    {it ? 'Impossibile caricare la descrizione.' : 'Failed to load the description.'}
                  </p>
                ) : desc ? (
                  <div
                    className="prose prose-sm max-w-none text-gray-700 [&_.event-schedule-table]:w-full [&_.event-schedule-table]:border-collapse [&_.event-schedule-table_td]:border [&_.event-schedule-table_th]:border [&_.event-schedule-table_td]:p-2 [&_.event-schedule-table_th]:p-2 [&_.event-schedule-table_th]:bg-[#d4b896]/20 [&_.event-schedule-table_th]:text-left"
                    dangerouslySetInnerHTML={{ __html: renderEventDescriptionHtml(desc, children) }}
                  />
                ) : (
                  <p className="text-sm text-gray-500">
                    {it ? 'Nessuna descrizione disponibile per questo evento.' : 'No description available for this event.'}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {event.multi_events && (
            <div className="mt-8">
              <Accordion type="single" collapsible defaultValue="schedule">
                <AccordionItem value="schedule" className="border-none">
                  <AccordionTrigger className="text-[#2b2b2b] text-base font-semibold py-2">
                    {it ? 'Programma' : 'Schedule'}
                  </AccordionTrigger>
                  <AccordionContent>
                    <EventScheduleTable festival={event} childEvents={children} language={language} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          <div className="mt-8">
            <EventJoinPanel event={event} isAuthenticated={isAuthenticated} language={language} />
          </div>
        </>
      )}
    </div>
  );
}
