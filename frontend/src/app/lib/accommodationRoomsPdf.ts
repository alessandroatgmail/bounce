import type { AccommodationRoom } from '../hooks/useAccommodationRooms';
import type { AccommodationType } from '../hooks/useAccommodationTypes';

// jspdf (+ jspdf-autotable) is only needed when an admin actually exports a
// PDF, and is large enough to blow past the PWA service worker's precache
// size limit if bundled into the main chunk — so it's loaded on demand here.
export async function exportAccommodationRoomsPdf(
  festivalName: string,
  roomTypes: AccommodationType[],
  rooms: AccommodationRoom[],
  language: 'it' | 'en',
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(language === 'it' ? `Camere - ${festivalName}` : `Rooms - ${festivalName}`, 14, 16);

  let y = 26;
  for (const type of roomTypes) {
    const typeRooms = rooms.filter(r => r.extra_item.id === type.extra_item.id);
    if (typeRooms.length === 0) continue;

    if (y > 270) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(12);
    doc.text(type.extra_item.name, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [[language === 'it' ? 'Camera' : 'Room', language === 'it' ? 'Ospiti' : 'Occupants']],
      body: typeRooms.map((room, i) => [
        String(i + 1),
        room.users.length === 0
          ? '—'
          : room.users.map(u => `${u.first_name} ${u.last_name}`).join(', '),
      ]),
      styles: { fontSize: 10 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  const safeName = festivalName.trim().toLowerCase().replace(/\s+/g, '-') || 'festival';
  doc.save(`rooms-${safeName}.pdf`);
}
