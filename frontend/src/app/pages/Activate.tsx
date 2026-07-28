import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { useLanguage } from '../contexts/LanguageContext';
import { apiUrl } from '../../lib/api';

type Status = 'loading' | 'success' | 'error';

export function Activate() {
  const { t } = useLanguage();
  const { uidb64, token } = useParams<{ uidb64: string; token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!uidb64 || !token) {
      setStatus('error');
      setMessage(t('activate.invalidLink'));
      return;
    }

    fetch(apiUrl(`/api/auth/activate/${uidb64}/${token}/`))
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus('success');
          setMessage(data.detail ?? t('activate.success'));
        } else {
          setStatus('error');
          setMessage(data.detail ?? t('activate.invalidLink'));
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage(t('activate.error'));
      });
  }, [uidb64, token]);

  return (
    <div className="min-h-screen bg-[#2b2b2b] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-[#d4b896]/30">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Bounce" className="size-16 object-contain" />
          </div>
          <CardTitle className="text-2xl text-[#2b2b2b]">
            {status === 'loading' && t('activate.titleLoading')}
            {status === 'success' && t('activate.titleSuccess')}
            {status === 'error' && t('activate.titleError')}
          </CardTitle>
          {status === 'loading' && (
            <CardDescription>{t('activate.pleaseWait')}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'loading' && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e67e22]" />
            </div>
          )}

          {status !== 'loading' && (
            <p className={`text-sm ${status === 'success' ? 'text-gray-700' : 'text-red-600'}`}>
              {message}
            </p>
          )}

          {status === 'success' && (
            <Link
              to="/login"
              className="inline-block mt-2 text-[#e67e22] hover:underline font-semibold text-sm"
            >
              {t('activate.goToLogin')}
            </Link>
          )}

          {status === 'error' && (
            <p className="text-xs text-gray-500">{t('activate.contactSupport')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
