import { Facebook, Instagram, Youtube, Mail, Phone } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export function ContactsSection() {
  const { t } = useLanguage();

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      {/* Contact Info */}
      <div>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wide text-[#d4b896]">
          {t('footer.contact')}
        </h2>
        <div className="space-y-3">
          <a
            href="tel:+393351414892"
            className="flex items-center gap-3 text-[#2b2b2b] hover:text-[#e67e22] transition-colors"
          >
            <Phone className="size-5 text-[#e67e22]" />
            <span>+39 335 141 4892</span>
          </a>
          <a
            href="mailto:info@bounceswinglovers.com"
            className="flex items-center gap-3 text-[#2b2b2b] hover:text-[#e67e22] transition-colors"
          >
            <Mail className="size-5 text-[#e67e22]" />
            <span>info@bounceswinglovers.com</span>
          </a>
        </div>
      </div>

      {/* Office hours */}
      <div>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wide text-[#d4b896]">
          Orario Segreteria
        </h2>
        <p className="text-[#2b2b2b]">LUN – GIO</p>
        <p className="text-[#2b2b2b]">19:30 – 22:00</p>
      </div>

      {/* Social */}
      <div>
        <h2 className="text-lg font-bold mb-4 uppercase tracking-wide text-[#d4b896]">
          Seguici
        </h2>
        <div className="flex gap-6">
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2b2b2b] hover:text-[#e67e22] transition-colors"
            aria-label="Facebook"
          >
            <Facebook className="size-6" />
          </a>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2b2b2b] hover:text-[#e67e22] transition-colors"
            aria-label="Instagram"
          >
            <Instagram className="size-6" />
          </a>
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2b2b2b] hover:text-[#e67e22] transition-colors"
            aria-label="YouTube"
          >
            <Youtube className="size-6" />
          </a>
        </div>
      </div>

      {/* Copyright */}
      <p className="text-xs text-gray-400 pt-4 border-t border-gray-200">
        COPYRIGHTS 2022 © ASD BOUNCE SWING LOVERS – CF e P.IVA 05964650286
      </p>
    </div>
  );
}
