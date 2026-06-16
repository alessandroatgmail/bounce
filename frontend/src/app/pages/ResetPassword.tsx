import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useLanguage } from '../contexts/LanguageContext';
import { apiUrl } from '../../lib/api';

export function ResetPassword() {
  const { t } = useLanguage();
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setError('');
    if (newPassword !== newPassword2) {
      setError(t('resetPassword.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/password-reset/confirm/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, token, new_password: newPassword, new_password2: newPassword2 }),
      });
      if (res.ok) {
        navigate('/login', { state: { passwordReset: true } });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          data?.detail ||
          data?.new_password?.[0] ||
          data?.new_password2?.[0] ||
          t('resetPassword.invalidLink'),
        );
      }
    } catch {
      setError(t('resetPassword.error'));
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
          <CardTitle className="text-2xl text-[#2b2b2b]">{t('resetPassword.title')}</CardTitle>
          <CardDescription>{t('resetPassword.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rp-new-password">{t('resetPassword.newPassword')}</Label>
              <Input
                id="rp-new-password"
                type="password"
                placeholder={t('resetPassword.newPasswordPlaceholder')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border-[#d4b896]/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-confirm-password">{t('resetPassword.confirmPassword')}</Label>
              <Input
                id="rp-confirm-password"
                type="password"
                placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReset()}
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
              onClick={handleReset}
              className="w-full bg-[#e67e22] hover:bg-[#d4b896] text-white"
              disabled={loading || !newPassword || !newPassword2}
            >
              {loading ? '...' : t('resetPassword.submit')}
            </Button>

            <p className="text-center text-sm text-gray-600 mt-2">
              <Link to="/login" className="text-[#e67e22] hover:underline font-semibold">
                {t('resetPassword.backToLogin')}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
