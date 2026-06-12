import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Music } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser) {
        navigate(loggedInUser.role === 'admin' ? '/admin' : '/');
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2b2b2b] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-[#d4b896]/30">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Music className="size-12 text-[#e67e22]" />
          </div>
          <CardTitle className="text-3xl text-[#2b2b2b]">{t('login.title')}</CardTitle>
          <CardDescription>{t('login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="tua@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-[#d4b896]/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder="Inserisci la tua password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-[#d4b896]/30"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full bg-[#e67e22] hover:bg-[#d4b896] text-white" disabled={loading}>
              {loading ? '...' : t('login.submit')}
            </Button>

            <p className="text-center text-sm text-gray-600 mt-4">
              {t('login.noAccount')} <Link to="/register" className="text-[#e67e22] hover:underline font-semibold">{t('login.register')}</Link>
            </p>
          </form>

          <div className="mt-6 p-4 bg-[#d4b896]/10 rounded-lg border border-[#d4b896]/30">
            <p className="text-xs text-gray-600 text-center">
              {t('login.termsPrefix')}{' '}
              <a
                href="https://www.bounceswinglovers.com/privacy-cookie-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#e67e22] hover:underline font-semibold"
              >
                {t('login.termsLink')}
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}