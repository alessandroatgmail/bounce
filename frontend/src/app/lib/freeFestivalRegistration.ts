import type { AccommodationRoomType, EventSimple } from '../hooks/useEvents';

// Split out of FestivalSchedulePage and loaded on demand (dynamic import)
// from its handleRegister — this is only needed once, at the moment the
// student actually confirms on the recap step, so there's no reason to
// ship it in the main bundle up front.

function eventHasRoles(ev: EventSimple): boolean {
  return ev.event_type.partners > 0 && ev.event_type.partner_roles.length > 0;
}

export async function submitFreeFestivalRegistration({
  accessToken,
  festivalId,
  selectedEvents,
  selectedMembershipId,
  selectedRoleId,
  isFlexible,
  perEventRoleIds,
  sharedPartner,
  partnerEmail,
  partnerId,
  perEventPartnerEmails,
  perEventPartnerIds,
  accommodationExtraItemId,
  accommodationRoomType,
  roommateEmails,
}: {
  accessToken: string;
  festivalId: number;
  selectedEvents: EventSimple[];
  selectedMembershipId: string;
  selectedRoleId: string;
  isFlexible: boolean;
  perEventRoleIds: Record<number, string>;
  sharedPartner: boolean;
  partnerEmail: string;
  partnerId: number | null;
  perEventPartnerEmails: Record<number, string>;
  perEventPartnerIds: Record<number, number | null>;
  accommodationExtraItemId: number | '';
  accommodationRoomType: AccommodationRoomType | '';
  roommateEmails: string[];
}): Promise<{ ok: true } | { ok: false; messages: string[] }> {
  const body: Record<string, unknown> = {
    event_id: festivalId,
    event_ids: selectedEvents.map(ev => {
      // Already booked here as someone else's partner — this slot's
      // role/partner were set by that earlier pairing, not by this
      // registration, so nothing is resubmitted for it. The backend
      // preserves whatever it already has when these come in null.
      if (ev.already_booked) {
        return { event_id: ev.id, role_id: null, partner_id: null, partner_email: '' };
      }
      return {
        event_id: ev.id,
        // A role never applies to a class whose type doesn't define one,
        // regardless of flexible/shared mode.
        role_id: !eventHasRoles(ev) ? null : isFlexible
          ? (perEventRoleIds[ev.id] ? Number(perEventRoleIds[ev.id]) : null)
          : (selectedRoleId ? Number(selectedRoleId) : null),
        partner_id: sharedPartner ? partnerId : (perEventPartnerIds[ev.id] ?? null),
        // Sent alongside partner_id so the backend can still flag a
        // typo'd/unregistered email even if it never resolved to an id.
        partner_email: sharedPartner ? partnerEmail : (perEventPartnerEmails[ev.id] ?? ''),
      };
    }),
  };
  if (selectedMembershipId) body.membership_id = Number(selectedMembershipId);
  if (accommodationExtraItemId !== '' && accommodationRoomType) {
    body.accommodation = {
      event_id: festivalId,
      extra_item_id: accommodationExtraItemId,
      type: accommodationRoomType,
      roommate_emails: roommateEmails.filter(Boolean),
    };
  }

  try {
    const res = await fetch('/api/booking/my-memberships/book-free-festival/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };

    const data = await res.json().catch(() => ({}));
    // event_ids comes back as a list positioned the same as the entries we
    // submitted (DRF's list serializer validates each one independently),
    // so index i maps straight onto selectedEvents[i].
    const entryErrors: unknown[] = Array.isArray(data?.event_ids) ? data.event_ids : [];
    const messages: string[] = [];
    entryErrors.forEach((entry, idx) => {
      const event = selectedEvents[idx];
      if (!event || !entry || typeof entry !== 'object') return;
      const texts = Object.values(entry as Record<string, unknown>).flat().map(String);
      if (texts.length === 0) return;
      messages.push(`${event.name}: ${texts.join(' ')}`);
    });
    // Anything else (membership_id, a top-level event_id, non_field_errors…)
    // still belongs in the same list, just without a row to flag.
    Object.entries(data ?? {}).forEach(([key, value]) => {
      if (key === 'event_ids') return;
      const texts = Array.isArray(value) ? value.map(String) : [String(value)];
      messages.push(...texts);
    });
    return { ok: false, messages };
  } catch {
    return { ok: false, messages: [] };
  }
}
