import { Fragment, useMemo } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFestivalDays } from '../hooks/useFestivalDays';
import { useUserBookings } from '../hooks/useUserBookings';
import type { EventItem } from '../hooks/useEvents';
import type { FestivalDay } from '../hooks/useFestivalDays';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

function formatDate(dateStr: string, opts: Intl.DateTimeFormatOptions, locale = 'en-GB') {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, opts);
}

function ClassCard({ cls, purchased }: { cls: EventItem; purchased: boolean }) {
  return (
    <div
      className="rounded-lg p-2 text-white shadow-sm h-full"
      style={{ backgroundColor: cls.color ?? '#e67e22', opacity: purchased ? 1 : 0.35 }}
    >
      <div className="text-sm font-medium flex items-center gap-1 leading-tight">
        {purchased && <CheckCircle2 className="size-3.5 flex-shrink-0" />}
        <span className="truncate">{cls.name}</span>
      </div>
      <div className="text-xs opacity-90 mt-0.5">
        {cls.start_date.slice(11, 16)}–{cls.end_date.slice(11, 16)}
        {cls.level && ` · ${cls.level.name}`}
      </div>
    </div>
  );
}

// Read-only schedule for a multi-event (festival): same day → room structure
// as FestivalGrid/FestivalSchedulePage (via useFestivalDays). Desktop shows a
// day/room/time grid; below md it switches to a day → room accordion, each
// room listing its classes as a stacked list, since a wide grid doesn't fit
// a phone screen. Visible to anonymous visitors too — festival-days is a
// public endpoint; only the "purchased" highlight depends on being logged in.
export function EventScheduleTable({
  festival,
  childEvents,
  language,
}: {
  festival: EventItem;
  childEvents: EventItem[];
  language: string;
}) {
  const { accessToken } = useAuth();
  const it = language === 'it';
  const locale = it ? 'it-IT' : 'en-GB';

  const { days, loading: loadingDays } = useFestivalDays(accessToken, festival.id);
  const { userBookings, loading: loadingBookings } = useUserBookings(accessToken);

  const purchasedIds = useMemo(
    () => new Set(userBookings.map(b => b.event.id)),
    [userBookings],
  );

  const dayBlocks = useMemo(() => {
    return days
      .map(day => {
        const dayEvents = childEvents.filter(e => e.start_date.slice(0, 10) === day.date);
        if (dayEvents.length === 0 || day.rooms.length === 0) return null;
        const times = [...new Set(dayEvents.map(e => e.start_date.slice(11, 16)))].sort();
        return { day, dayEvents, times };
      })
      .filter((b): b is { day: FestivalDay; dayEvents: EventItem[]; times: string[] } => b !== null);
  }, [days, childEvents]);

  if (loadingDays || loadingBookings) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-[#e67e22]" />
      </div>
    );
  }

  if (dayBlocks.length === 0) return null;

  return (
    <div>
      <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">{it ? 'Programma' : 'Schedule'}</h2>

      {/* Desktop / tablet: full day → room → time grid */}
      <div className="hidden md:block space-y-8">
        {dayBlocks.map(({ day, dayEvents, times }) => (
          <div key={day.id}>
            <h3 className="font-semibold text-[#2b2b2b] mb-2">
              {formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' }, locale)}
            </h3>
            <div className="overflow-x-auto">
              <div
                className="grid gap-2 min-w-max"
                style={{ gridTemplateColumns: `72px repeat(${day.rooms.length}, minmax(150px, 1fr))` }}
              >
                <div />
                {day.rooms.map(fr => (
                  <div key={fr.id} className="px-2 py-1.5 rounded bg-[#2b2b2b] text-white text-sm font-medium text-center">
                    {fr.room.name}
                  </div>
                ))}

                {times.map(time => (
                  <Fragment key={time}>
                    <div className="flex items-center justify-end pr-1 text-xs text-gray-500">
                      {time}
                    </div>
                    {day.rooms.map(fr => {
                      const cls = dayEvents.find(
                        e => e.room.id === fr.room.id && e.start_date.slice(11, 16) === time
                      );
                      return (
                        <div key={`${time}-${fr.id}`}>
                          {cls && <ClassCard cls={cls} purchased={purchasedIds.has(cls.id)} />}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: day → room accordion, classes listed chronologically per room */}
      <Accordion type="multiple" defaultValue={dayBlocks.map(({ day }) => `day-${day.id}`)} className="md:hidden">
        {dayBlocks.map(({ day, dayEvents }) => {
          const roomsWithEvents = day.rooms
            .map(fr => ({
              room: fr,
              events: dayEvents
                .filter(e => e.room.id === fr.room.id)
                .sort((a, b) => a.start_date.localeCompare(b.start_date)),
            }))
            .filter(r => r.events.length > 0);

          return (
            <AccordionItem key={day.id} value={`day-${day.id}`}>
              <AccordionTrigger className="text-[#2b2b2b]">
                {formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' }, locale)}
              </AccordionTrigger>
              <AccordionContent>
                <Accordion type="multiple" defaultValue={roomsWithEvents.map(r => `room-${r.room.id}`)}>
                  {roomsWithEvents.map(({ room, events }) => (
                    <AccordionItem key={room.id} value={`room-${room.id}`}>
                      <AccordionTrigger className="text-sm text-gray-700">
                        {room.room.name}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {events.map(cls => (
                            <ClassCard key={cls.id} cls={cls} purchased={purchasedIds.has(cls.id)} />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
