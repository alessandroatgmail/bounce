import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useLanguage } from '../contexts/LanguageContext';

export function PaymentSuccess() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang = language === 'it' ? 'it' : 'en';

  useEffect(() => {
    sessionStorage.removeItem('checkout_items');
  }, []);

  return (
    <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center text-center gap-6">
      <CheckCircle className="size-16 text-green-500" />
      <h1 className="text-2xl font-bold text-[#2b2b2b]">
        {lang === 'it' ? 'Pagamento completato!' : 'Payment successful!'}
      </h1>
      <p className="text-gray-500 text-sm">
        {lang === 'it'
          ? 'Il tuo pagamento è stato ricevuto. Riceverai un\'email di conferma a breve.'
          : 'Your payment has been received, you\'ll receive an email for confirmation.'}
      </p>
      <Button
        className="bg-[#e67e22] hover:bg-[#d47420]"
        onClick={() => navigate('/')}
      >
        {lang === 'it' ? 'Torna alla dashboard' : 'Back to dashboard'}
      </Button>
    </div>
  );
}
