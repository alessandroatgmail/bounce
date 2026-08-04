import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ArrowLeft, CreditCard, Crown, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

export interface CheckoutItem {
  id: number;
  eventName: string;
  membershipName: string;
  payerEmail: string;
  payerRole: string | null;
  partnerEmail: string | null;
  partnerRole: string | null;
  amount: string;
  discounted_amount: string;
  discounts: Array<{ id: number; name: string; name_ext: string | null }>;
}

const SESSION_KEY = 'checkout_items';

interface CheckoutState {
  items: CheckoutItem[];
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const lang = language === 'it' ? 'it' : 'en';
  const { accessToken } = useAuth();
  const [paying, setPaying] = useState(false);

  // prefer router state, fall back to sessionStorage (covers cancel-redirect and browser-back)
  const stateItems = (location.state as CheckoutState | null)?.items ?? null;
  const [items, setItems] = useState<CheckoutItem[]>(() => {
    if (stateItems) return stateItems;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? (JSON.parse(saved) as CheckoutItem[]) : [];
    } catch {
      return [];
    }
  });

  // keep sessionStorage in sync whenever items are populated from router state
  useEffect(() => {
    if (stateItems && stateItems.length > 0) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(stateItems));
      setItems(stateItems);
    }
  }, [stateItems]);

  const total = items.reduce((sum, item) => sum + parseFloat(item.discounted_amount), 0);

  const handleBack = () => navigate('/?section=payments&tab=topay');

  const handlePay = async () => {
    setPaying(true);
    try {
      const res = await fetch('/api/booking/checkout-session/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ contribution_ids: items.map(i => i.id) }),
      });
      const data = await res.json();
      if (data.url) {
        // replace so Stripe is never sitting "behind" our checkout in history
        window.location.replace(data.url);
      } else {
        setPaying(false);
      }
    } catch {
      setPaying(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={handleBack}
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
      {/* Back — always goes to payment section, never depends on history */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-gray-500 hover:text-[#e67e22] transition-colors mb-8"
      >
        <ArrowLeft className="size-5" />
        <span className="text-sm font-medium">{lang === 'it' ? 'Torna ai pagamenti' : 'Back to payments'}</span>
      </button>

      <h1 className="text-2xl font-bold text-[#2b2b2b] mb-6">
        {lang === 'it' ? 'Riepilogo ordine' : 'Order summary'}
      </h1>

      <div className="space-y-3 mb-6">
        {items.map(item => (
          <Card key={item.id} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Crown className="size-4 text-[#e67e22] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#2b2b2b] truncate">{item.eventName}</p>
                  <p className="text-sm text-gray-500">{item.membershipName}</p>
                  <div className="text-xs text-gray-400 mt-0.5 space-y-0.5">
                    <p>
                      <span className="font-medium text-gray-500">{lang === 'it' ? 'Paga per:' : 'Pay for:'}</span>{' '}
                      {item.payerEmail}{item.payerRole ? ` · ${item.payerRole}` : ''}
                    </p>
                    {item.partnerEmail && (
                      <p>
                        <span className="font-medium text-gray-500">{lang === 'it' ? 'Partner:' : 'Partner:'}</span>{' '}
                        {item.partnerEmail}{item.partnerRole ? ` · ${item.partnerRole}` : ''}
                      </p>
                    )}
                  </div>
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

      <div className="flex items-center justify-between border-t pt-4 mb-8">
        <span className="text-lg font-bold text-[#2b2b2b]">
          {lang === 'it' ? 'Totale' : 'Total'}
        </span>
        <span className="text-2xl font-bold text-[#e67e22]">€{total.toFixed(2)}</span>
      </div>

      <Button
        className="w-full bg-[#e67e22] hover:bg-[#d47420] text-white py-6 text-base font-semibold"
        onClick={handlePay}
        disabled={paying}
      >
        {paying
          ? <Loader2 className="size-5 mr-2 animate-spin" />
          : <CreditCard className="size-5 mr-2" />}
        {lang === 'it' ? `Paga €${total.toFixed(2)}` : `Pay €${total.toFixed(2)}`}
      </Button>

    </div>
  );
}
