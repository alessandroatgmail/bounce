import { useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useLanguage } from '../contexts/LanguageContext';
import { apiUrl } from '../../lib/api';

export function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/password-reset/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(t('forgotPassword.error'));
      }
    } catch {
      setError(t('forgotPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2b2b2b] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-[#d4b896]/30">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Bounce" className="size-16 object-contain" />
          </div>
          <CardTitle className="text-2xl text-[#2b2b2b]">{t('forgotPassword.title')}</CardTitle>
          <CardDescription>{t('forgotPassword.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-700">{t('forgotPassword.successMessage')}</p>
              <Link to="/login" className="text-[#e67e22] hover:underline text-sm font-semibold">
                {t('forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-email">Email</Label>
                <Input
                  id="fp-email"
                  type="email"
                  placeholder="tua@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="border-[#d4b896]/30"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="button"
                onClick={handleSend}
                className="w-full bg-[#e67e22] hover:bg-[#d4b896] text-white"
                disabled={loading}
              >
                {loading ? '...' : t('forgotPassword.submit')}
              </Button>

              <p className="text-center text-sm text-gray-600 mt-2">
                <Link to="/login" className="text-[#e67e22] hover:underline font-semibold">
                  {t('forgotPassword.backToLogin')}
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
