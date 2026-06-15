import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { EventsBrowser } from '../pages/Events';

export function EventsSection() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'all' | 'mine'>('all');

  return (
    <div>
      {/* Filter chip row */}
      <div className="flex gap-2 mb-4 px-4 md:px-0">
        <button
          onClick={() => setMode('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            mode === 'all'
              ? 'bg-[#e67e22] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {language === 'it' ? 'Tutti gli eventi' : 'All events'}
        </button>
        {isAuthenticated && (
          <button
            onClick={() => setMode('mine')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              mode === 'mine'
                ? 'bg-[#e67e22] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {language === 'it' ? 'Le mie prenotazioni' : 'My bookings'}
          </button>
        )}
        {!isAuthenticated && (
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            {language === 'it' ? 'Accedi per le prenotazioni' : 'Sign in for bookings'}
          </button>
        )}
      </div>

      <EventsBrowser showAvailableSpots={isAuthenticated} filterMyBookings={mode === 'mine'} />
    </div>
  );
}
