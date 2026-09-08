import { useMemo } from 'react';
import type { EventItem } from '../hooks/useEvents';

function formatDate(dateStr: string, opts: Intl.DateTimeFormatOptions, locale: string) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, opts);
}

// Read-only schedule for a weekly course: its generated occurrences
// (Event.events children, one per week) grouped by month, each listed as
// weekday + day — room — location, chronologically within the month.
export function EventWeeklySchedule({
  childEvents,
  language,
}: {
  childEvents: EventItem[];
  language: string;
}) {
  const it = language === 'it';
  const locale = it ? 'it-IT' : 'en-GB';

  const monthGroups = useMemo(() => {
    const sorted = [...childEvents].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const groups = new Map<string, EventItem[]>();
    for (const child of sorted) {
      const key = child.start_date.slice(0, 7); // "YYYY-MM"
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(child);
    }
    return [...groups.entries()].map(([key, events]) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      return { key, label, events };
    });
  }, [childEvents, locale]);

  if (monthGroups.length === 0) return null;

  return (
    <div className="space-y-5">
      {monthGroups.map(group => (
        <div key={group.key}>
          <h3 className="font-semibold text-[#2b2b2b] mb-2 capitalize">{group.label}</h3>
          <ul className="space-y-1.5">
            {group.events.map(child => (
              <li key={child.id} className="flex items-baseline gap-2 text-sm text-gray-700">
                <span className="font-medium text-[#2b2b2b] capitalize whitespace-nowrap">
                  {formatDate(child.start_date, { weekday: 'long', day: 'numeric' }, locale)}
                </span>
                <span className="text-gray-400 whitespace-nowrap">
                  {child.start_date.slice(11, 16)}–{child.end_date.slice(11, 16)}
                </span>
                <span className="text-gray-400">—</span>
                <span>{child.room.name} — {child.room.location.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
