import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiUrl } from '../../lib/api';

export function QRCodeSection() {
  const { accessToken, user } = useAuth();
  const { language } = useLanguage();
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let objectUrl: string | null = null;
    fetch(apiUrl('/api/auth/me/qrcode/'), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => (r.ok ? r.blob() : null))
      .then(blob => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setQrUrl(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 select-none">
      <div className="flex flex-col items-center gap-2 text-center">
        <QrCode className="size-8 text-[#e67e22]" />
        
        {user && (
          <p className="text-gray-500 text-sm">{user.name}</p>
        )}
      </div>

      {qrUrl ? (
        <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100">
          <img
            src={qrUrl}
            alt="QR code"
            className="w-64 h-64 md:w-80 md:h-80"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      ) : (
        <div className="w-64 h-64 md:w-80 md:h-80 bg-gray-100 rounded-2xl flex items-center justify-center">
          <QrCode className="size-16 text-gray-300" />
        </div>
      )}

      <p className="text-xs text-gray-400 text-center max-w-xs">
        {language === 'it'
          ? 'Mostra questo codice alla reception per registrare la tua presenza.'
          : 'Show this code at reception to check in.'}
      </p>
    </div>
  );
}
