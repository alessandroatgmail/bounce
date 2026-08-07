import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const STORAGE_KEY = 'cookieConsent';
const POLICY_URL = 'https://www.bounceswinglovers.com/privacy-cookie-policy/';

// Replicates the cookie banner from bounceswinglovers.com (same copy, same
// dark bar + white "ok" button + bordered close box), adapted to this app's
// language context and localStorage instead of a raw document.cookie.
export function CookieBanner() {
  const { language } = useLanguage();
  const it = language === 'it';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] bg-[#2b2b2b]/95 text-white text-sm">
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 pl-4 pr-12 py-3 text-center leading-relaxed">
        <span>
          {it
            ? "Utilizziamo cookies anche di terze parti che migliorano i servizi, la navigazione, le promozioni per te. Se prosegui la navigazione acconsenti all'uso."
            : 'We use cookies, including third-party ones, to improve our services, navigation and promotions for you. If you continue browsing, you consent to their use.'}{' '}
          <a
            href={POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#e67e22]"
          >
            {it ? 'Per saperne di più' : 'Learn more'}
          </a>
          .
        </span>
        <button
          onClick={dismiss}
          className="ml-2 bg-white text-black text-xs font-bold uppercase px-4 py-1.5 hover:bg-gray-200 transition-colors"
        >
          ok
        </button>
      </div>
      <button
        onClick={dismiss}
        aria-label={it ? 'Chiudi' : 'Close'}
        className="absolute top-2 right-2 border border-white text-white text-xs leading-none px-2 py-1 hover:bg-white hover:text-[#2b2b2b] transition-colors"
      >
        X
      </button>
    </div>
  );
}
