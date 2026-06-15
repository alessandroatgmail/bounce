import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export function Footer() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();

  // Hide on mobile for authenticated users — they have the Contacts tab instead
  const visibilityClass = isAuthenticated ? 'hidden md:block' : 'block';

  return (
    <footer className={`${visibilityClass} bg-[#2b2b2b] text-white py-6 px-4`}>
      <div className="container mx-auto text-center space-y-1">
        <p className="text-sm opacity-70">
          COPYRIGHTS 2022 © ASD BOUNCE SWING LOVERS – CF e P.IVA 05964650286
        </p>
        <p className="text-xs opacity-50">
          {language === 'it'
            ? 'Messaggio riservato ai soci ACSI'
            : 'Message reserved for ACSI members'}
        </p>
      </div>
    </footer>
  );
}
