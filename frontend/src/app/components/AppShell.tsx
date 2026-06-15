import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Ticket, CreditCard, User, LogOut, ShieldCheck, LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { EventsSection } from './EventsSection';
import { PaymentsSection } from './PaymentsSection';
import { ProfileSection } from './ProfileSection';

type Section = 'events' | 'payments' | 'profile';

const SECTION_LABELS = {
  events:   { it: 'Eventi',   en: 'Events'   },
  payments: { it: 'Pagamenti', en: 'Payments' },
  profile:  { it: 'Profilo',  en: 'Profile'  },
};

export function AppShell() {
  const { user, logout, setAdminViewMode, accessToken: _token } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>('events');

  const isGuest = !user;
  const initials = user?.name.split(' ').map(n => n[0]).join('').toUpperCase() ?? '';

  const authTabs = [
    { id: 'events'   as Section, label: SECTION_LABELS.events[language === 'it' ? 'it' : 'en'],   icon: Ticket     },
    { id: 'payments' as Section, label: SECTION_LABELS.payments[language === 'it' ? 'it' : 'en'], icon: CreditCard },
    { id: 'profile'  as Section, label: SECTION_LABELS.profile[language === 'it' ? 'it' : 'en'],  icon: User       },
  ];

  const sectionTitle = SECTION_LABELS[activeSection][language === 'it' ? 'it' : 'en'];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex w-64 bg-[#2b2b2b] text-white flex-col">
        {/* User profile */}
        {!isGuest && (
          <div className="px-5 py-4 border-b border-gray-700 flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-[#e67e22] text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{user.name}</div>
              <div className="text-xs text-gray-400 truncate">{user.email}</div>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 p-4 space-y-1">
          {isGuest ? (
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <LogIn className="size-5" />
              <span>{language === 'it' ? 'Accedi' : 'Login'}</span>
            </button>
          ) : (
            authTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === tab.id
                      ? 'bg-[#e67e22] text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <Icon className="size-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })
          )}
        </nav>

        {/* Bottom actions */}
        {!isGuest && (
          <div className="p-4 border-t border-gray-700 space-y-1">
            {user.role === 'admin' && (
              <Button
                variant="ghost"
                onClick={() => { setAdminViewMode('admin'); navigate('/admin'); }}
                className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                <ShieldCheck className="size-5 mr-3" />
                {language === 'it' ? 'Vista Admin' : 'Admin View'}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={logout}
              className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <LogOut className="size-5 mr-3" />
              {language === 'it' ? 'Esci' : 'Logout'}
            </Button>
          </div>
        )}
      </aside>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Section title bar — desktop only */}
        <header className="hidden md:flex bg-white border-b border-gray-200 px-6 py-4 items-center gap-3 shrink-0">
          <h1 className="text-2xl font-bold text-[#2b2b2b]">{sectionTitle}</h1>
          {user?.role === 'admin' && (
            <Badge variant="outline" className="bg-[#e67e22]/10 text-[#e67e22] border-[#e67e22]">
              <ShieldCheck className="size-3 mr-1" />
              {language === 'it' ? 'Vista Admin' : 'Admin View'}
            </Badge>
          )}
        </header>

        {/* Scrollable content — extra bottom padding on mobile for the tab bar */}
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6">
          {activeSection === 'events' && <EventsSection />}
          {activeSection === 'payments' && !isGuest && <PaymentsSection />}
          {activeSection === 'profile' && !isGuest && <ProfileSection />}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50 flex safe-bottom">
        {isGuest ? (
          <>
            <button
              onClick={() => setActiveSection('events')}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
                activeSection === 'events' ? 'text-[#e67e22]' : 'text-gray-500'
              }`}
            >
              <Ticket className="size-5" />
              {SECTION_LABELS.events[language === 'it' ? 'it' : 'en']}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs text-gray-500 transition-colors hover:text-[#e67e22]"
            >
              <LogIn className="size-5" />
              {language === 'it' ? 'Accedi' : 'Login'}
            </button>
          </>
        ) : (
          authTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
                  activeSection === tab.id ? 'text-[#e67e22]' : 'text-gray-500'
                }`}
              >
                <Icon className="size-5" />
                {tab.label}
              </button>
            );
          })
        )}
      </nav>
    </div>
  );
}
