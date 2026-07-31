import type { EventItem } from '../app/hooks/useEvents';
import { SCHEDULE_BLOCK_SELECTOR } from '../app/components/tiptap/ScheduleBlockExtension';

// Resolves dynamic blocks (currently just the Schedule block) embedded in an
// EventDescription's stored HTML into their current content. Nothing about
// a block's content is persisted in `desc` — it's regenerated here from
// live data every time the description is displayed, so a later change to
// a child event's room/time (or a newly added child) shows up automatically
// without anyone re-editing the description.
export function renderEventDescriptionHtml(html: string, children: EventItem[]): string {
  if (!html.includes('data-event-block')) return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const markers = doc.querySelectorAll(SCHEDULE_BLOCK_SELECTOR);
  if (markers.length === 0) return html;

  const sorted = [...children].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const tableHtml = buildScheduleTableHtml(sorted);

  markers.forEach(marker => {
    const wrapper = doc.createElement('div');
    wrapper.innerHTML = tableHtml;
    marker.replaceWith(...Array.from(wrapper.childNodes));
  });

  return doc.body.innerHTML;
}

function buildScheduleTableHtml(children: EventItem[]): string {
  if (children.length === 0) {
    return '<p class="event-schedule-empty">No schedule available yet.</p>';
  }
  const rows = children.map(e => `
    <tr>
      <td>${escapeHtml(e.name)}</td>
      <td>${escapeHtml(e.room.name)}</td>
      <td>${escapeHtml(formatDateTime(e.start_date))}</td>
      <td>${escapeHtml(e.level?.name ?? '—')}</td>
    </tr>
  `).join('');
  return `
    <table class="event-schedule-table">
      <thead>
        <tr><th>Name</th><th>Room</th><th>When</th><th>Level</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
