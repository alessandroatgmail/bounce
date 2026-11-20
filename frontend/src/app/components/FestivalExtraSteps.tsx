import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { AccommodationRoomType, EventDetail, EventSimple } from '../hooks/useEvents';

// Split out of FestivalSchedulePage and lazy-loaded from there: these two
// steps (extras, recap) are only needed after the student has already
// finished picking classes, so there's no reason to ship them in the main
// bundle up front.

function formatDate(dateStr: string, opts: Intl.DateTimeFormatOptions, locale = 'en-GB') {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, opts);
}

export default function FestivalExtraSteps({
  step,
  festival,
  selectedEvents,
  fixedEventIds,
  flexibleRoleId,
  selectedRoleId,
  perEventRoleIds,
  sharedPartner,
  partnerEmail,
  perEventPartnerEmails,
  registerErrors,
  registerStatus,
  locale,
  t,
  accommodationAssignment,
  selectedAccommodationExtraItemId,
  onSelectAccommodationExtraItem,
  accommodationRoomType,
  onSelectAccommodationRoomType,
  roommateEmails,
  onRoommateEmailChange,
  onBackToSchedule,
  onContinueToRecap,
  onBackFromRecap,
  onConfirm,
}: {
  step: 'extras' | 'recap';
  festival: EventDetail;
  selectedEvents: EventSimple[];
  fixedEventIds: Set<number>;
  flexibleRoleId: string;
  selectedRoleId: string;
  perEventRoleIds: Record<number, string>;
  sharedPartner: boolean;
  partnerEmail: string;
  perEventPartnerEmails: Record<number, string>;
  registerErrors: string[];
  registerStatus: 'idle' | 'loading' | 'success' | 'error';
  locale: string;
  t: (key: string) => string;
  accommodationAssignment: EventDetail['accommodation_assignment'];
  selectedAccommodationExtraItemId: number | '';
  onSelectAccommodationExtraItem: (id: number | '') => void;
  accommodationRoomType: AccommodationRoomType | '';
  onSelectAccommodationRoomType: (roomType: AccommodationRoomType | '') => void;
  roommateEmails: string[];
  onRoommateEmailChange: (index: number, value: string) => void;
  onBackToSchedule: () => void;
  onContinueToRecap: () => void;
  onBackFromRecap: () => void;
  onConfirm: () => void;
}) {
  // Only "accommodation" is wired up so far — a t-shirt (or any other)
  // section will get its own block here the same way, once the backend
  // has a way to tell its extra items apart too. Computed up here, not
  // just inside the 'extras' branch, so the recap step can show what was
  // picked without recomputing it differently.
  const accommodationOptions = festival.available_extra_items.filter(i => i.accommodation_type !== null);
  const selectedAccommodation = accommodationOptions.find(i => i.id === selectedAccommodationExtraItemId);
  const roomTypeLabels: Record<AccommodationRoomType, string> = {
    females: t('festival.extras.roomTypeFemale'),
    'all males': t('festival.extras.roomTypeMale'),
    mixed: t('festival.extras.roomTypeMixed'),
    friends: t('festival.extras.roomTypeFriends'),
  };

  if (step === 'extras') {
    // A single room has no one to share it with, so the room-type choice
    // (and roommates) only makes sense once occupants_per_room > 1.
    const showRoomType = !!selectedAccommodation && selectedAccommodation.accommodation_type!.occupants_per_room > 1;
    // One roommate per remaining bed — the student themselves takes one
    // spot in the room, so only occupants_per_room - 1 names are needed.
    const roommateSlots = accommodationRoomType === 'friends' && selectedAccommodation
      ? Math.max(selectedAccommodation.accommodation_type!.occupants_per_room - 1, 0)
      : 0;

    return (
      <div className="max-w-2xl space-y-6">
        <h2 className="text-sm font-semibold text-[#2b2b2b] uppercase tracking-wide">
          {t('festival.extras.title')}
        </h2>

        {accommodationAssignment ? (
          // Someone else already seated this student in a room (the
          // "friends" case) — locked, not editable: see
          // FestivalSchedulePage's pre-fill effect and the backend's
          // accommodation_assignment field for why.
          <div className="space-y-1.5 rounded-md border bg-gray-50 p-3">
            <Label>{t('festival.extras.accommodationLocked')}</Label>
            {selectedAccommodation && (
              <p className="text-sm font-medium text-[#2b2b2b]">
                {selectedAccommodation.name} — {selectedAccommodation.accommodation_type!.location.name}
              </p>
            )}
            {accommodationAssignment.roommates.length > 0 && (
              <p className="text-xs text-gray-500">
                {accommodationAssignment.roommates.map(r => `${r.first_name} ${r.last_name}`).join(', ')}
              </p>
            )}
          </div>
        ) : (
          <>
            {accommodationOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t('festival.extras.accommodation')}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  value={selectedAccommodationExtraItemId}
                  onChange={e => onSelectAccommodationExtraItem(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">{t('festival.extras.selectAccommodation')}</option>
                  {accommodationOptions.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.accommodation_type!.location.name} (€{item.value})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showRoomType && (
              <div className="space-y-1.5">
                <Label>{t('festival.extras.roomType')}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  value={accommodationRoomType}
                  onChange={e => onSelectAccommodationRoomType(e.target.value as AccommodationRoomType | '')}
                >
                  <option value="">{t('festival.extras.selectRoomType')}</option>
                  <option value="females">{t('festival.extras.roomTypeFemale')}</option>
                  <option value="all males">{t('festival.extras.roomTypeMale')}</option>
                  <option value="mixed">{t('festival.extras.roomTypeMixed')}</option>
                  <option value="friends">{t('festival.extras.roomTypeFriends')}</option>
                </select>
              </div>
            )}

            {roommateSlots > 0 && (
              <div className="space-y-1.5">
                {Array.from({ length: roommateSlots }, (_, index) => (
                  <Input
                    key={index}
                    type="email"
                    placeholder={`${t('festival.extras.roommateEmail')} ${index + 1}`}
                    value={roommateEmails[index] ?? ''}
                    onChange={e => onRoommateEmailChange(index, e.target.value)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBackToSchedule}>
            <ArrowLeft className="size-4 mr-1" /> {t('festival.schedule.back')}
          </Button>
          <Button className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white" onClick={onContinueToRecap}>
            {t('festival.registration.recap')}
          </Button>
        </div>
      </div>
    );
  }

  const eventHasRoles = (ev: EventSimple) =>
    ev.event_type.partners > 0 && ev.event_type.partner_roles.length > 0;
  const isFlexible = selectedRoleId === flexibleRoleId;

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-sm font-semibold text-[#2b2b2b] uppercase tracking-wide">
        {t('festival.recap.title')}
      </h2>
      <div className="border rounded-lg divide-y bg-white">
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-3">{t('festival.recap.noEvents')}</p>
        ) : selectedEvents.map(ev => {
          const isFixed = fixedEventIds.has(ev.id);
          const roleId = ev.already_booked || isFixed || !eventHasRoles(ev)
            ? ''
            : (isFlexible ? perEventRoleIds[ev.id] : selectedRoleId) ?? '';
          const roleName = roleId
            ? ev.event_type.partner_roles.find(r => String(r.id) === roleId)?.name
            : undefined;
          const partner = ev.already_booked || isFixed
            ? ''
            : (sharedPartner ? partnerEmail : (perEventPartnerEmails[ev.id] ?? ''));
          return (
            <div key={ev.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-[#2b2b2b]">{ev.name}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(ev.start_date, { weekday: 'short', day: 'numeric', month: 'short' }, locale)}
                  {' · '}
                  {ev.start_date.slice(11, 16)}
                </p>
              </div>
              <div className="text-xs text-gray-500 text-right">
                {isFixed && <p>{t('festival.recap.included')}</p>}
                {roleName && <p>{roleName}</p>}
                {partner && <p>{partner}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {selectedAccommodation && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[#2b2b2b] uppercase tracking-wide">
            {t('festival.extras.title')}
          </h3>
          <div className="border rounded-lg divide-y bg-white">
            <div className="px-4 py-2.5 space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {t('festival.extras.accommodation')}
              </p>
              <p className="text-sm font-medium text-[#2b2b2b]">
                {selectedAccommodation.name} — {selectedAccommodation.accommodation_type!.location.name}
              </p>
              {accommodationRoomType && (
                <p className="text-xs text-gray-500">{roomTypeLabels[accommodationRoomType]}</p>
              )}
              {roommateEmails.filter(Boolean).length > 0 && (
                <p className="text-xs text-gray-500">{roommateEmails.filter(Boolean).join(', ')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {registerErrors.length > 0 && (
        <ul className="text-sm text-red-600 list-disc pl-5 space-y-1">
          {registerErrors.map((message, idx) => <li key={idx}>{message}</li>)}
        </ul>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBackFromRecap}>
          <ArrowLeft className="size-4 mr-1" /> {t('festival.schedule.back')}
        </Button>
        <Button
          disabled={registerStatus === 'loading'}
          onClick={onConfirm}
          className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white disabled:opacity-50"
        >
          {registerStatus === 'loading' && <Loader2 className="size-4 animate-spin mr-2" />}
          {t('festival.registration.register')}
        </Button>
      </div>
    </div>
  );
}
