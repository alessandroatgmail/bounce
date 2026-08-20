import { Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { LogOut, User, Languages } from 'lucide-react';
import { NotificationsBell } from './NotificationsBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const STAGING_HOSTNAME = 'review-toba.bounceswinglovers.com';

export function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const toggleLanguage = () => {
    setLanguage(language === 'it' ? 'en' : 'it');
  };

  const isStaging = window.location.hostname === STAGING_HOSTNAME;

  return (

    <header className="bg-[#2b2b2b] sticky top-0 z-50 shadow-md">
    {isStaging && (
      <div className="bg-yellow-400 text-yellow-900 text-center text-sm font-semibold py-2 px-4">
        ⚠️ This website is a work in progress — for testing purposes only.
      </div>
    )}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center">
            {/* desktop: full horizontal logo */}
            <img src="/logo-full.png" alt="Bounce Swing Lovers" className="hidden md:block h-10 w-auto object-contain" />
            {/* mobile: compact icon */}
            <img src="/logo.png" alt="Bounce" className="block md:hidden size-10 object-contain" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/"
              className={`hover:text-[#d4b896] transition-colors uppercase text-sm tracking-wide ${
                isActive('/') ? 'text-[#d4b896]' : 'text-white'
              }`}
            >
              {t('nav.home')}
            </Link>
            {!isAuthenticated && (
              <Link
                to="/events"
                className={`hover:text-[#d4b896] transition-colors uppercase text-sm tracking-wide ${
                  isActive('/events') ? 'text-[#d4b896]' : 'text-white'
                }`}
              >
                {t('nav.events')}
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className={`hover:text-[#d4b896] transition-colors uppercase text-sm tracking-wide ${
                  location.pathname.startsWith('/admin') ? 'text-[#d4b896]' : 'text-white'
                }`}
              >
                {t('nav.admin')}
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {isAuthenticated && <NotificationsBell />}
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-white hover:text-[#d4b896] transition-colors"
              title={language === 'it' ? 'Switch to English' : 'Cambia in Italiano'}
            >
              <Languages className="size-5" />
              <span className="text-sm uppercase">{language}</span>
            </button>

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-transparent border-[#d4b896] text-white hover:bg-[#d4b896] hover:text-[#2b2b2b] px-2">
                    <User className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#2b2b2b] text-white border-[#d4b896]">
                  <DropdownMenuLabel>{t('nav.myAccount')}</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#d4b896]/30" />
                  {user?.role === 'student' && (
                    <>
                      <DropdownMenuItem asChild className="hover:bg-[#d4b896] hover:text-[#2b2b2b]">
                        <Link to="/">{t('nav.dashboard')}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="hover:bg-[#d4b896] hover:text-[#2b2b2b]">
                        <Link to="/?section=profile">{t('nav.settings')}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[#d4b896]/30" />
                    </>
                  )}
                  {user?.role === 'admin' && (
                    <>
                      <DropdownMenuItem asChild className="hover:bg-[#d4b896] hover:text-[#2b2b2b]">
                        <Link to="/admin">{t('nav.adminPanel')}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[#d4b896]/30" />
                    </>
                  )}
                  <DropdownMenuItem onClick={logout} className="text-[#e67e22] hover:bg-[#e67e22] hover:text-white">
                    <LogOut className="size-4 mr-2" />
                    {t('nav.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/login">
                <Button className="bg-[#e67e22] hover:bg-[#d4b896] text-white">{t('nav.login')}</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}