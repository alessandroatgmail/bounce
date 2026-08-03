import { Fragment, useMemo } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFestivalDays } from '../hooks/useFestivalDays';
import { useUserBookings } from '../hooks/useUserBookings';
import type { EventItem } from '../hooks/useEvents';

function formatDate(dateStr: string, opts: Intl.DateTimeFormatOptions, locale = 'en-GB') {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, opts);
}

// Read-only schedule for a multi-event (festival): same day → room structure
// as FestivalGrid/FestivalSchedulePage (via useFestivalDays), but laid out as
// a discrete time-row table instead of a continuous pixel-positioned grid.
// Requires login — festival-days is an authenticated-only endpoint.
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

  if (!accessToken) return null;

  if (loadingDays || loadingBookings) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-[#e67e22]" />
      </div>
    );
  }

  if (days.length === 0) return null;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-[#2b2b2b]">{it ? 'Programma' : 'Schedule'}</h2>
      {days.map(day => {
        const dayEvents = childEvents.filter(e => e.start_date.slice(0, 10) === day.date);
        if (dayEvents.length === 0 || day.rooms.length === 0) return null;

        const times = [...new Set(dayEvents.map(e => e.start_date.slice(11, 16)))].sort();

        return (
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
                      const purchased = cls ? purchasedIds.has(cls.id) : false;
                      return (
                        <div key={`${time}-${fr.id}`}>
                          {cls && (
                            <div
                              className="rounded-lg p-2 text-white shadow-sm h-full"
                              style={{
                                backgroundColor: cls.color ?? '#e67e22',
                                opacity: purchased ? 1 : 0.35,
                              }}
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
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
