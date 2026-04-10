import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Send, Search, ArrowLeft } from 'lucide-react';
import { DirectMessage, mockStudents } from '../data/mockData';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

interface DirectMessagesProps {
  messages: DirectMessage[];
  onSendMessage: (receiverId: string, content: string) => void;
  onMarkAsRead: (messageId: string) => void;
}

export function DirectMessages({ messages, onSendMessage, onMarkAsRead }: DirectMessagesProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  if (!user) return null;

  const getUserName = (userId: string) => {
    const student = mockStudents.find(s => s.id === userId);
    return student?.name || 'Unknown User';
  };

  const getUserInitials = (userId: string) => {
    const name = getUserName(userId);
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Get all users who have conversations with current user
  const conversations = new Map<string, {
    userId: string;
    lastMessage: DirectMessage;
    unreadCount: number;
  }>();

  messages.forEach(msg => {
    const otherUserId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
    const existing = conversations.get(otherUserId);
    
    if (!existing || new Date(msg.createdAt) > new Date(existing.lastMessage.createdAt)) {
      const unreadCount = messages.filter(m => 
        m.senderId === otherUserId && 
        m.receiverId === user.id && 
        !m.read
      ).length;

      conversations.set(otherUserId, {
        userId: otherUserId,
        lastMessage: msg,
        unreadCount,
      });
    }
  });

  const conversationList = Array.from(conversations.values())
    .sort((a, b) => 
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    )
    .filter(conv => {
      if (!searchQuery) return true;
      return getUserName(conv.userId).toLowerCase().includes(searchQuery.toLowerCase());
    });

  // Get messages for selected conversation
  const selectedMessages = selectedUserId
    ? messages
        .filter(m => 
          (m.senderId === user.id && m.receiverId === selectedUserId) ||
          (m.senderId === selectedUserId && m.receiverId === user.id)
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  // Mark messages as read when viewing conversation
  if (selectedUserId) {
    messages
      .filter(m => m.senderId === selectedUserId && m.receiverId === user.id && !m.read)
      .forEach(m => onMarkAsRead(m.id));
  }

  const handleSendMessage = () => {
    if (messageInput.trim() && selectedUserId) {
      onSendMessage(selectedUserId, messageInput.trim());
      setMessageInput('');
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-4 h-[600px]">
      {/* Conversations List */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">
            {language === 'it' ? 'Messaggi' : 'Messages'}
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 size-4 text-gray-500" />
            <Input
              placeholder={language === 'it' ? 'Cerca...' : 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <ScrollArea className="h-[calc(600px-140px)]">
          <CardContent className="space-y-2">
            {conversationList.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {language === 'it' 
                  ? 'Nessun messaggio' 
                  : 'No messages'}
              </div>
            ) : (
              conversationList.map((conv) => (
                <button
                  key={conv.userId}
                  onClick={() => setSelectedUserId(conv.userId)}
                  className={`
                    w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors
                    ${selectedUserId === conv.userId 
                      ? 'bg-[#e67e22]/10 border border-[#e67e22]/30' 
                      : 'hover:bg-gray-100'}
                  `}
                >
                  <Avatar>
                    <AvatarFallback className="bg-[#d4b896] text-[#2b2b2b]">
                      {getUserInitials(conv.userId)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm truncate">
                        {getUserName(conv.userId)}
                      </div>
                      {conv.unreadCount > 0 && (
                        <Badge className="bg-[#e67e22] ml-2">{conv.unreadCount}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {conv.lastMessage.content}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(conv.lastMessage.createdAt), {
                        addSuffix: true,
                        locale: language === 'it' ? it : enUS,
                      })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Messages */}
      <Card className="md:col-span-2">
        {selectedUserId ? (
          <>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUserId(null)}
                  className="md:hidden"
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <Avatar>
                  <AvatarFallback className="bg-[#d4b896] text-[#2b2b2b]">
                    {getUserInitials(selectedUserId)}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-lg">{getUserName(selectedUserId)}</CardTitle>
              </div>
            </CardHeader>
            <ScrollArea className="h-[calc(600px-200px)] p-4">
              <div className="space-y-4">
                {selectedMessages.map((msg) => {
                  const isOwnMessage = msg.senderId === user.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`
                          max-w-[70%] rounded-lg p-3
                          ${isOwnMessage 
                            ? 'bg-[#e67e22] text-white' 
                            : 'bg-gray-100 text-gray-900'}
                        `}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isOwnMessage ? 'text-white/80' : 'text-gray-500'}`}>
                          {formatDistanceToNow(new Date(msg.createdAt), {
                            addSuffix: true,
                            locale: language === 'it' ? it : enUS,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <CardContent className="border-t pt-4">
              <div className="flex gap-2">
                <Input
                  placeholder={language === 'it' ? 'Scrivi un messaggio...' : 'Type a message...'}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="bg-[#e67e22] hover:bg-[#d4b896]"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <MessageCircle className="size-12 mx-auto mb-4 text-gray-400" />
              <p>{language === 'it' 
                ? 'Seleziona una conversazione per iniziare a chattare' 
                : 'Select a conversation to start chatting'}</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function MessageCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
