import { useNavigate, useParams } from 'react-router';
import { EventDetailContent } from '../components/EventDetailContent';

// Public, standalone version of the event detail page (guests, and users
// browsing the marketing site rather than the dashboard). Dashboard users
// get the same content nested inside AppShell instead — see routes.tsx.
export function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <div className="min-h-screen bg-white">
      <EventDetailContent eventId={Number(id)} onBack={() => navigate(-1)} />
    </div>
  );
}
