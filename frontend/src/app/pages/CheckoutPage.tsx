import { useNavigate, useLocation } from 'react-router';
import { ArrowLeft, CreditCard, Crown } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useLanguage } from '../contexts/LanguageContext';

export interface CheckoutItem {
  id: number;
  eventName: string;
  membershipName: string;
  role: string | null;
  partner: string | null;
  amount: string;
  discounted_amount: string;
  discounts: Array<{ id: number; name: string; name_ext: string | null }>;
}

interface CheckoutState {
  items: CheckoutItem[];
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const lang = language === 'it' ? 'it' : 'en';

  const state = location.state as CheckoutState | null;
  const items = state?.items ?? [];

  const total = items.reduce((sum, item) => sum + parseFloat(item.discounted_amount), 0);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-[#e67e22] transition-colors mb-8"
        >
          <ArrowLeft className="size-5" />
          <span className="text-sm font-medium">{lang === 'it' ? 'Torna ai pagamenti' : 'Back to payments'}</span>
        </button>
        <p className="text-gray-400 text-sm">
          {lang === 'it' ? 'Nessun articolo selezionato.' : 'No items selected.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-[#e67e22] transition-colors mb-8"
      >
        <ArrowLeft className="size-5" />
        <span className="text-sm font-medium">{lang === 'it' ? 'Torna ai pagamenti' : 'Back to payments'}</span>
      </button>

      {/* Heading */}
      <h1 className="text-2xl font-bold text-[#2b2b2b] mb-6">
        {lang === 'it' ? 'Riepilogo ordine' : 'Order summary'}
      </h1>

      {/* Items */}
      <div className="space-y-3 mb-6">
        {items.map(item => (
          <Card key={item.id} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Crown className="size-4 text-[#e67e22] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#2b2b2b] truncate">{item.eventName}</p>
                  <p className="text-sm text-gray-500">{item.membershipName}</p>
                  {(item.role || item.partner) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[item.role, item.partner].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {item.discounts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.discounts.map(d => (
                        <Badge key={d.id} variant="outline" className="text-xs">
                          {d.name_ext || d.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {item.discounts.length > 0 ? (
                    <>
                      <p className="text-xs line-through text-gray-400">€{item.amount}</p>
                      <p className="font-semibold text-[#2b2b2b]">€{item.discounted_amount}</p>
                    </>
                  ) : (
                    <p className="font-semibold text-[#2b2b2b]">€{item.amount}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between border-t pt-4 mb-8">
        <span className="text-lg font-bold text-[#2b2b2b]">
          {lang === 'it' ? 'Totale' : 'Total'}
        </span>
        <span className="text-2xl font-bold text-[#e67e22]">€{total.toFixed(2)}</span>
      </div>

      {/* Pay button */}
      <Button
        className="w-full bg-[#e67e22] hover:bg-[#d47420] text-white py-6 text-base font-semibold"
        onClick={() => {
          // payment integration goes here
        }}
      >
        <CreditCard className="size-5 mr-2" />
        {lang === 'it' ? `Paga €${total.toFixed(2)}` : `Pay €${total.toFixed(2)}`}
      </Button>
    </div>
  );
}
