import { authFetch } from '../../lib/api';

// Fired once a registration has already succeeded and produced a
// contribution id — consent-saving is a separate concern from the booking
// itself (POST /api/consent/consents/), so a failure here never undoes or
// blocks the registration that already went through; it's best-effort.
export async function saveConsents({
  accessToken,
  communicationIds,
  contributionId,
}: {
  accessToken: string;
  communicationIds: number[];
  contributionId?: number;
}): Promise<void> {
  await Promise.all(
    communicationIds.map(communicationId =>
      authFetch('/api/consent/consents/', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          communication_id: communicationId,
          ...(contributionId ? { contribution_id: contributionId } : {}),
        }),
      }).catch(() => undefined),
    ),
  );
}
