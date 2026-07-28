import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { mockNotifications } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

export function NotificationsBell() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [notifications, setNotifications] = useState(mockNotifications);

  if (!user) return null;

  const userNotifs = notifications.filter(n => n.userId === user.id);
  const unreadCount = userNotifs.filter(n => !n.read).length;

  const markRead = (id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => n.userId === user.id ? { ...n, read: true } : n));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center bg-red-500 text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b p-4 flex items-center justify-between">
          <h3 className="font-semibold">
            {language === 'it' ? 'Notifiche' : 'Notifications'}
          </h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-[#e67e22]">
              {language === 'it' ? 'Segna tutte come lette' : 'Mark all as read'}
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {userNotifs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {language === 'it' ? 'Nessuna notifica' : 'No notifications'}
            </div>
          ) : (
            <div className="divide-y">
              {userNotifs
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => markRead(notif.id)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${!notif.read ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{notif.title}</p>
                          {!notif.read && <span className="size-2 bg-blue-500 rounded-full" />}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(new Date(notif.createdAt), {
                            addSuffix: true,
                            locale: language === 'it' ? it : enUS,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
