import { Facebook, Instagram, Youtube, Mail, Phone } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();
  
  return (
    <footer className="bg-[#2b2b2b] text-white py-8 px-4">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-4 gap-8 text-center md:text-left">
          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-bold mb-4 uppercase tracking-wide text-[#d4b896]">
              {t('footer.contact')}
            </h3>
            <div className="space-y-2 text-sm">
              <a 
                href="tel:+393351414892" 
                className="flex items-center justify-center md:justify-start gap-2 hover:text-[#d4b896] transition-colors"
              >
                <Phone className="size-4" />
                <span>+39 335 141 4892</span>
              </a>
              <a 
                href="mailto:info@bounceswinglovers.com"
                className="flex items-center justify-center md:justify-start gap-2 hover:text-[#d4b896] transition-colors"
              >
                <Mail className="size-4" />
                <span>info@bounceswinglovers.com</span>
              </a>
            </div>
          </div>

          {/* Orario Segreteria */}
          <div>
            <h3 className="text-lg font-bold mb-4 uppercase tracking-wide text-[#d4b896]">
              Orario Segreteria
            </h3>
            <p className="text-sm opacity-90">LUN - GIO</p>
            <p className="text-sm opacity-90">19:30 - 22:00</p>
          </div>

          {/* Social Links */}
          <div>
            <h3 className="text-lg font-bold mb-4 uppercase tracking-wide text-[#d4b896]">
              Seguici
            </h3>
            <div className="flex gap-4 justify-center md:justify-start">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#d4b896] transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="size-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#d4b896] transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="size-5" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#d4b896] transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="size-5" />
              </a>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-lg font-bold mb-4 uppercase tracking-wide text-[#d4b896]">
              Newsletter
            </h3>
            <p className="text-sm opacity-90 mb-2">
              Resta aggiornato sugli eventi e le novità
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-[#d4b896]/20 text-center text-sm opacity-70">
          <p>
            COPYRIGHTS 2022 © ASD BOUNCE SWING LOVERS - CF e P.IVA 05964650286
          </p>
        </div>
      </div>
    </footer>
  );
}