import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Crown, Calendar, CreditCard, Award } from 'lucide-react';
import { Membership, UserMembership } from '../data/mockData';

interface MembershipCardProps {
  membership: Membership;
  userMembership?: UserMembership;
  onPurchase?: () => void;
  onUpgrade?: () => void;
}

export function MembershipCard({ membership, userMembership, onPurchase, onUpgrade }: MembershipCardProps) {
  const { language } = useLanguage();

  const isActive = userMembership?.status === 'active';
  const daysRemaining = userMembership ? Math.ceil((new Date(userMembership.validTo).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <Card className={`overflow-hidden border-2 ${isActive ? 'border-[#e67e22]' : 'border-gray-200'}`}>
      <div 
        className="h-3" 
        style={{ backgroundColor: membership.color }}
      />
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-2xl font-bold" style={{ color: membership.color }}>
                {membership.name}
              </h3>
              {isActive && (
                <Badge className="bg-green-600">
                  {language === 'it' ? 'Attivo' : 'Active'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {language === 'it' ? membership.description : membership.description}
            </p>
          </div>
          {membership.stylesIncluded > 0 && (
            <div className="flex items-center gap-1">
              {[...Array(membership.stylesIncluded)].map((_, i) => (
                <Award key={i} className="size-5" style={{ color: membership.color }} />
              ))}
            </div>
          )}
        </div>

        {isActive && userMembership && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="size-4 text-gray-600" />
              <span className="text-gray-700">
                {language === 'it' ? 'Valido fino al' : 'Valid until'}:{' '}
                <span className="font-semibold">
                  {new Date(userMembership.validTo).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="size-4 text-gray-600" />
              <span className="text-gray-700">
                {language === 'it' ? 'Giorni rimanenti' : 'Days remaining'}:{' '}
                <span className={`font-semibold ${daysRemaining < 7 ? 'text-red-600' : 'text-green-600'}`}>
                  {daysRemaining}
                </span>
              </span>
            </div>
            {userMembership.associatedCourses.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <Crown className="size-4 text-gray-600 mt-0.5" />
                <span className="text-gray-700">
                  {language === 'it' ? 'Corsi associati' : 'Associated courses'}:{' '}
                  <span className="font-semibold">{userMembership.associatedCourses.length}</span>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-bold text-[#2b2b2b]">€{membership.priceTotal}</span>
              {membership.priceMonthly > 0 && (
                <span className="text-sm text-gray-500 ml-2">
                  / {membership.timeframe.toLowerCase()}
                </span>
              )}
            </div>
          </div>

          {!isActive ? (
            <Button 
              onClick={onPurchase}
              className="w-full"
              style={{ backgroundColor: membership.color }}
            >
              {language === 'it' ? 'Acquista' : 'Purchase'}
            </Button>
          ) : (
            <Button 
              onClick={onUpgrade}
              variant="outline"
              className="w-full"
            >
              {language === 'it' ? 'Rinnova' : 'Renew'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}