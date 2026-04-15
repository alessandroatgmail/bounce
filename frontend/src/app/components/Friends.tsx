import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Search, UserPlus, Check, X, Users } from 'lucide-react';
import { Connection, mockStudents } from '../data/mockData';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface FriendsProps {
  connections: Connection[];
  onAddConnection: (userId: string) => void;
  onAcceptConnection: (userId: string) => void;
  onDeclineConnection: (userId: string) => void;
  onRemoveConnection: (userId: string) => void;
}

export function Friends({ 
  connections, 
  onAddConnection, 
  onAcceptConnection, 
  onDeclineConnection,
  onRemoveConnection 
}: FriendsProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  if (!user) return null;

  const getUserName = (userId: string) => {
    const student = mockStudents.find(s => s.id === userId);
    return student?.name || 'Unknown User';
  };

  const getUserEmail = (userId: string) => {
    const student = mockStudents.find(s => s.id === userId);
    return student?.email || '';
  };

  const getUserInitials = (userId: string) => {
    const name = getUserName(userId);
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getConnectionStatus = (userId: string): 'none' | 'pending_sent' | 'pending_received' | 'connected' => {
    const sentRequest = connections.find(
      c => c.userId === user.id && c.connectedUserId === userId
    );
    const receivedRequest = connections.find(
      c => c.userId === userId && c.connectedUserId === user.id
    );

    if (sentRequest?.status === 'accepted' || receivedRequest?.status === 'accepted') {
      return 'connected';
    }
    if (sentRequest?.status === 'pending') {
      return 'pending_sent';
    }
    if (receivedRequest?.status === 'pending') {
      return 'pending_received';
    }
    return 'none';
  };

  // Get friend list
  const friends = connections
    .filter(c => 
      c.status === 'accepted' && 
      (c.userId === user.id || c.connectedUserId === user.id)
    )
    .map(c => c.userId === user.id ? c.connectedUserId : c.userId);

  // Get pending requests (received)
  const pendingRequests = connections
    .filter(c => c.status === 'pending' && c.connectedUserId === user.id)
    .map(c => c.userId);

  // Search for new friends
  const potentialFriends = mockStudents
    .filter(s => s.id !== user.id) // Exclude current user
    .filter(s => {
      if (!searchQuery) return false;
      const name = s.name.toLowerCase();
      const email = s.email.toLowerCase();
      const query = searchQuery.toLowerCase();
      return name.includes(query) || email.includes(query);
    });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">
            <Users className="size-4 mr-2" />
            {language === 'it' ? 'Amici' : 'Friends'} 
            <Badge variant="secondary" className="ml-2">{friends.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="requests">
            {language === 'it' ? 'Richieste' : 'Requests'}
            {pendingRequests.length > 0 && (
              <Badge className="ml-2 bg-[#e67e22]">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="size-4 mr-2" />
            {language === 'it' ? 'Cerca' : 'Search'}
          </TabsTrigger>
        </TabsList>

        {/* Friends List */}
        <TabsContent value="friends" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {language === 'it' ? 'I Tuoi Amici' : 'Your Friends'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="size-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-4">
                    {language === 'it' 
                      ? 'Non hai ancora amici. Cerca e connettiti con altri studenti!' 
                      : 'You don\'t have any friends yet. Search and connect with other students!'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friendId) => (
                    <div
                      key={friendId}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-12">
                          <AvatarFallback className="bg-[#d4b896] text-[#2b2b2b]">
                            {getUserInitials(friendId)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-[#2b2b2b]">
                            {getUserName(friendId)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {getUserEmail(friendId)}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {/* Navigate to messages */}}
                        >
                          {language === 'it' ? 'Messaggio' : 'Message'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveConnection(friendId)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {language === 'it' ? 'Rimuovi' : 'Remove'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Friend Requests */}
        <TabsContent value="requests" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {language === 'it' ? 'Richieste di Amicizia' : 'Friend Requests'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="size-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">
                    {language === 'it' 
                      ? 'Nessuna richiesta di amicizia pendente' 
                      : 'No pending friend requests'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((requesterId) => (
                    <div
                      key={requesterId}
                      className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-12">
                          <AvatarFallback className="bg-[#d4b896] text-[#2b2b2b]">
                            {getUserInitials(requesterId)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-[#2b2b2b]">
                            {getUserName(requesterId)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {language === 'it' 
                              ? 'Vuole connettersi con te' 
                              : 'Wants to connect with you'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => onAcceptConnection(requesterId)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="size-4 mr-1" />
                          {language === 'it' ? 'Accetta' : 'Accept'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDeclineConnection(requesterId)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="size-4 mr-1" />
                          {language === 'it' ? 'Rifiuta' : 'Decline'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search for Friends */}
        <TabsContent value="search" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {language === 'it' ? 'Trova Nuovi Amici' : 'Find New Friends'}
              </CardTitle>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-2.5 size-4 text-gray-500" />
                <Input
                  placeholder={language === 'it' ? 'Cerca per nome o email...' : 'Search by name or email...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {!searchQuery ? (
                <div className="text-center py-12">
                  <Search className="size-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">
                    {language === 'it' 
                      ? 'Inizia a cercare per trovare altri studenti' 
                      : 'Start searching to find other students'}
                  </p>
                </div>
              ) : potentialFriends.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">
                    {language === 'it' 
                      ? 'Nessun risultato trovato' 
                      : 'No results found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {potentialFriends.map((student) => {
                    const status = getConnectionStatus(student.id);
                    return (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="size-12">
                            <AvatarFallback className="bg-[#d4b896] text-[#2b2b2b]">
                              {getUserInitials(student.id)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-[#2b2b2b]">
                              {student.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {student.email}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {student.activeClasses} {language === 'it' ? 'corsi attivi' : 'active classes'}
                            </div>
                          </div>
                        </div>
                        <div>
                          {status === 'none' && (
                            <Button
                              size="sm"
                              onClick={() => onAddConnection(student.id)}
                              className="bg-[#e67e22] hover:bg-[#d4b896]"
                            >
                              <UserPlus className="size-4 mr-1" />
                              {language === 'it' ? 'Aggiungi' : 'Add Friend'}
                            </Button>
                          )}
                          {status === 'pending_sent' && (
                            <Badge variant="outline">
                              {language === 'it' ? 'Richiesta Inviata' : 'Request Sent'}
                            </Badge>
                          )}
                          {status === 'pending_received' && (
                            <Badge variant="outline" className="bg-blue-50">
                              {language === 'it' ? 'Rispondere' : 'Respond'}
                            </Badge>
                          )}
                          {status === 'connected' && (
                            <Badge className="bg-green-600">
                              <Check className="size-3 mr-1" />
                              {language === 'it' ? 'Amici' : 'Friends'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}