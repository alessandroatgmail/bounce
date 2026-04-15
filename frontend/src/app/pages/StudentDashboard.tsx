import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  mockEvents,
  mockBookings,
  mockPayments,
  mockPosts,
  mockDirectMessages,
  mockConnections,
  mockNotifications,
  mockStudents,
  mockTrips,
  mockDocuments,
  mockMemberships,
  mockUserMemberships,
  mockRegularClasses,
  Post,
  DirectMessage,
  Comment,
  Connection,
  Notification,
  Trip,
  CarShare,
  HotelShare,
  Document
} from '../data/mockData';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import {
  Home,
  Calendar,
  CreditCard,
  Users,
  Bell,
  MessageSquare,
  Clock,
  LogOut,
  Plane,
  FileText,
  Crown,
  Share2,
  ShieldCheck
} from 'lucide-react';
import { SocialFeed } from '../components/SocialFeed';
import { DirectMessages } from '../components/DirectMessages';
import { Friends } from '../components/Friends';
import { Trips } from '../components/Trips';
import { MembershipCard } from '../components/MembershipCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { ScrollArea } from '../components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Toaster } from '../components/ui/sonner';
import { formatDistanceToNow } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

type View = 'feed' | 'classes' | 'payments' | 'friends' | 'messages' | 'trips' | 'documents' | 'memberships';

export function StudentDashboard() {
  const { user, logout, setAdminViewMode } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<View>('feed');
  const [posts, setPosts] = useState(mockPosts);
  const [messages, setMessages] = useState(mockDirectMessages);
  const [connections, setConnections] = useState(mockConnections);
  const [notifications, setNotifications] = useState(mockNotifications);
  const [trips, setTrips] = useState(mockTrips);
  const [documents, setDocuments] = useState(mockDocuments);
  const [memberships, setMemberships] = useState(mockUserMemberships);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Allow both students and admins to access student dashboard
  if (user.role !== 'student' && user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  const userBookings = mockBookings.filter((b) => b.userId === user.id);
  const userPayments = mockPayments.filter((p) => p.userId === user.id);
  const bookedEvents = mockEvents.filter((event) =>
    userBookings.some((b) => b.eventId === event.id)
  );

  const upcomingClasses = bookedEvents
    .filter((event) => new Date(event.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  const unreadMessagesCount = messages.filter(
    m => m.receiverId === user.id && !m.read
  ).length;

  const unreadNotificationsCount = notifications.filter(
    n => n.userId === user.id && !n.read
  ).length;

  const getUserName = (userId: string) => {
    const student = mockStudents.find(s => s.id === userId);
    return student?.name || 'Unknown User';
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleAddPost = (content: string, mentions?: string[]) => {
    const newPost: Post = {
      id: `post${posts.length + 1}`,
      userId: user.id,
      content,
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
      mentions: mentions || [],
    };
    setPosts([newPost, ...posts]);

    // Create notifications for mentioned users
    if (mentions && mentions.length > 0) {
      const newNotifications = mentions.map((mentionedUserId) => {
        const mentionedUser = mockStudents.find(s => s.id === mentionedUserId);
        return {
          id: `notif${notifications.length + 1}-${mentionedUserId}`,
          userId: mentionedUserId,
          type: 'comment' as const,
          title: language === 'it' ? 'Menzionato in un Post' : 'Mentioned in a Post',
          message: language === 'it'
            ? `${user.name} ti ha menzionato in un post`
            : `${user.name} mentioned you in a post`,
          read: false,
          createdAt: new Date().toISOString(),
          relatedId: newPost.id,
        };
      });
      setNotifications([...notifications, ...newNotifications]);
    }
  };

  const handleLikePost = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        const likes = post.likes.includes(user.id)
          ? post.likes.filter(id => id !== user.id)
          : [...post.likes, user.id];
        return { ...post, likes };
      }
      return post;
    }));
  };

  const handleAddComment = (postId: string, content: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        const newComment: Comment = {
          id: `c${post.comments.length + 1}`,
          userId: user.id,
          postId,
          content,
          createdAt: new Date().toISOString(),
        };
        return { ...post, comments: [...post.comments, newComment] };
      }
      return post;
    }));
  };

  const handleShareEvent = (event: typeof mockEvents[0]) => {
    const newPost: Post = {
      id: `post${posts.length + 1}`,
      userId: user.id,
      content: language === 'it'
        ? `Guarda questo evento fantastico! ${event.title} 🎉`
        : `Check out this amazing event! ${event.title} 🎉`,
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
      mentions: [],
      sharedContent: {
        type: 'event',
        data: event,
      },
    };
    setPosts([newPost, ...posts]);
    toast.success(
      language === 'it'
        ? 'Evento condiviso nel feed!'
        : 'Event shared to feed!'
    );
  };

  const handleShareTrip = (trip: typeof mockTrips[0]) => {
    const newPost: Post = {
      id: `post${posts.length + 1}`,
      userId: user.id,
      content: language === 'it'
        ? `Chi viene a ${trip.eventName}? 🚗✈️`
        : `Who's joining me at ${trip.eventName}? 🚗✈️`,
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
      mentions: [],
      sharedContent: {
        type: 'trip',
        data: trip,
      },
    };
    setPosts([newPost, ...posts]);
    toast.success(
      language === 'it'
        ? 'Viaggio condiviso nel feed!'
        : 'Trip shared to feed!'
    );
  };

  const handleShareCourse = (courseId: string) => {
    const course = mockRegularClasses.find(c => c.id === courseId);
    if (!course) return;

    const newPost: Post = {
      id: `post${posts.length + 1}`,
      userId: user.id,
      content: language === 'it'
        ? `Mi sono iscritto a questo corso! Chi altro partecipa? 💃🕺`
        : `Just enrolled in this class! Who else is joining? 💃🕺`,
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
      mentions: [],
      sharedContent: {
        type: 'course',
        data: course,
      },
    };
    setPosts([newPost, ...posts]);
    toast.success(
      language === 'it'
        ? 'Corso condiviso nel feed!'
        : 'Course shared to feed!'
    );
  };

  const handleSendMessage = (receiverId: string, content: string) => {
    const newMessage: DirectMessage = {
      id: `dm${messages.length + 1}`,
      senderId: user.id,
      receiverId,
      content,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setMessages([...messages, newMessage]);
  };

  const handleMarkAsRead = (messageId: string) => {
    setMessages(messages.map(msg =>
      msg.id === messageId ? { ...msg, read: true } : msg
    ));
  };

  const handleAddConnection = (userId: string) => {
    const newConnection: Connection = {
      userId: user.id,
      connectedUserId: userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setConnections([...connections, newConnection]);
  };

  const handleAcceptConnection = (userId: string) => {
    setConnections(connections.map(c =>
      c.userId === userId && c.connectedUserId === user.id
        ? { ...c, status: 'accepted' as const }
        : c
    ));
  };

  const handleDeclineConnection = (userId: string) => {
    setConnections(connections.filter(c =>
      !(c.userId === userId && c.connectedUserId === user.id)
    ));
  };

  const handleRemoveConnection = (userId: string) => {
    setConnections(connections.filter(c =>
      !((c.userId === user.id && c.connectedUserId === userId) ||
        (c.userId === userId && c.connectedUserId === user.id))
    ));
  };

  const handleMarkNotificationAsRead = (notificationId: string) => {
    setNotifications(notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    ));
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(notifications.map(n =>
      n.userId === user.id ? { ...n, read: true } : n
    ));
  };

  const handleJoinCar = (carId: string) => {
    setTrips(trips.map(trip => ({
      ...trip,
      carSharing: trip.carSharing.map(car =>
        car.id === carId && car.passengers.length < car.availableSeats
          ? { ...car, passengers: [...car.passengers, user.id] }
          : car
      ),
    })));
  };

  const handleLeaveCar = (carId: string) => {
    setTrips(trips.map(trip => ({
      ...trip,
      carSharing: trip.carSharing.map(car =>
        car.id === carId
          ? { ...car, passengers: car.passengers.filter(id => id !== user.id) }
          : car
      ),
    })));
  };

  const handleJoinHotel = (hotelId: string) => {
    setTrips(trips.map(trip => ({
      ...trip,
      hotelSharing: trip.hotelSharing.map(hotel =>
        hotel.id === hotelId && hotel.currentPeople.length < hotel.maxPeople
          ? { ...hotel, currentPeople: [...hotel.currentPeople, user.id] }
          : hotel
      ),
    })));
  };

  const handleLeaveHotel = (hotelId: string) => {
    setTrips(trips.map(trip => ({
      ...trip,
      hotelSharing: trip.hotelSharing.map(hotel =>
        hotel.id === hotelId
          ? { ...hotel, currentPeople: hotel.currentPeople.filter(id => id !== user.id) }
          : hotel
      ),
    })));
  };

  const handleAddCarShare = (tripId: string, carShare: Omit<CarShare, 'id' | 'tripId'>) => {
    setTrips(trips.map(trip =>
      trip.id === tripId
        ? {
            ...trip,
            carSharing: [
              ...trip.carSharing,
              {
                id: `car${trip.carSharing.length + 1}`,
                tripId,
                ...carShare,
              },
            ],
          }
        : trip
    ));
  };

  const handleAddHotelShare = (tripId: string, hotelShare: Omit<HotelShare, 'id' | 'tripId'>) => {
    setTrips(trips.map(trip =>
      trip.id === tripId
        ? {
            ...trip,
            hotelSharing: [
              ...trip.hotelSharing,
              {
                id: `hotel${trip.hotelSharing.length + 1}`,
                tripId,
                ...hotelShare,
              },
            ],
          }
        : trip
    ));
  };

  const menuItems = [
    { id: 'feed' as View, label: language === 'it' ? 'Feed' : 'Feed', icon: Home },
    { id: 'classes' as View, label: language === 'it' ? 'I Miei Corsi' : 'My Classes', icon: Calendar },
    { id: 'payments' as View, label: language === 'it' ? 'Pagamenti' : 'Payments', icon: CreditCard },
    { id: 'friends' as View, label: language === 'it' ? 'Amici' : 'Friends', icon: Users },
    { id: 'messages' as View, label: language === 'it' ? 'Messaggi' : 'Messages', icon: MessageSquare, badge: unreadMessagesCount },
    { id: 'trips' as View, label: language === 'it' ? 'Viaggi' : 'Trips', icon: Plane },
    { id: 'documents' as View, label: language === 'it' ? 'Documenti' : 'Documents', icon: FileText },
    { id: 'memberships' as View, label: language === 'it' ? 'Membresie' : 'Memberships', icon: Crown },
  ];

  return (
    <>
      <Toaster />
      <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#2b2b2b] text-white flex flex-col">
        {/* User Profile */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback className="bg-[#e67e22] text-white text-lg">
                {getUserInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{user.name}</div>
              <div className="text-sm text-gray-400 truncate">{user.email}</div>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${currentView === item.id
                      ? 'bg-[#e67e22] text-white'
                      : 'text-gray-300 hover:bg-gray-800'}
                  `}
                >
                  <Icon className="size-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <Badge className="bg-red-500">{item.badge}</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Admin View Toggle & Logout */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          {user.role === 'admin' && (
            <Button
              variant="ghost"
              onClick={() => {
                setAdminViewMode('admin');
                navigate('/admin');
              }}
              className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <ShieldCheck className="size-5 mr-3" />
              {language === 'it' ? 'Vista Admin' : 'Admin View'}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <LogOut className="size-5 mr-3" />
            {language === 'it' ? 'Esci' : 'Logout'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[#2b2b2b]">
                  {menuItems.find(item => item.id === currentView)?.label}
                </h1>
                {user.role === 'admin' && (
                  <Badge variant="outline" className="bg-[#e67e22]/10 text-[#e67e22] border-[#e67e22]">
                    <ShieldCheck className="size-3 mr-1" />
                    {language === 'it' ? 'Vista Admin' : 'Admin View'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {language === 'it' ? 'Benvenuto nella tua area personale' : 'Welcome to your personal area'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="size-5" />
                    {unreadNotificationsCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center bg-red-500 text-xs">
                        {unreadNotificationsCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="border-b p-4 flex items-center justify-between">
                    <h3 className="font-semibold">
                      {language === 'it' ? 'Notifiche' : 'Notifications'}
                    </h3>
                    {unreadNotificationsCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkAllNotificationsAsRead}
                        className="text-xs text-[#e67e22]"
                      >
                        {language === 'it' ? 'Segna tutte come lette' : 'Mark all as read'}
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-96">
                    {notifications.filter(n => n.userId === user.id).length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        {language === 'it' ? 'Nessuna notifica' : 'No notifications'}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {notifications
                          .filter(n => n.userId === user.id)
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((notif) => (
                            <button
                              key={notif.id}
                              onClick={() => handleMarkNotificationAsRead(notif.id)}
                              className={`
                                w-full p-4 text-left hover:bg-gray-50 transition-colors
                                ${!notif.read ? 'bg-blue-50/50' : ''}
                              `}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{notif.title}</p>
                                    {!notif.read && (
                                      <span className="size-2 bg-blue-500 rounded-full"></span>
                                    )}
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

              {/* Messages Icon */}
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setCurrentView('messages')}
              >
                <MessageSquare className="size-5" />
                {unreadMessagesCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center bg-red-500 text-xs">
                    {unreadMessagesCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {currentView === 'feed' && (
            <div className="max-w-3xl mx-auto">
              <SocialFeed
                posts={posts}
                onAddPost={handleAddPost}
                onLikePost={handleLikePost}
                onAddComment={handleAddComment}
              />
            </div>
          )}

          {currentView === 'classes' && (
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                    {language === 'it' ? 'I Miei Prossimi Corsi' : 'My Upcoming Classes'}
                  </h2>
                  {upcomingClasses.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingClasses.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-start gap-4 flex-1">
                            <div className="p-3 bg-[#e67e22]/10 rounded-lg">
                              <Calendar className="size-6 text-[#e67e22]" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-[#2b2b2b]">{event.title}</h3>
                              <p className="text-sm text-gray-600 mb-2">
                                {language === 'it' ? 'con' : 'with'} {event.instructor}
                              </p>
                              <div className="flex gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="size-4" />
                                  {new Date(event.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
                                    weekday: 'long',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="size-4" />
                                  {event.time}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{event.level}</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                handleShareEvent(event);
                                setCurrentView('feed');
                              }}
                              className="text-[#e67e22] hover:bg-[#e67e22]/10"
                            >
                              <Share2 className="size-4 mr-1" />
                              {language === 'it' ? 'Condividi' : 'Share'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Calendar className="size-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600">
                        {language === 'it' 
                          ? 'Non hai prossimi corsi programmati.' 
                          : 'You don\'t have any upcoming classes.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {currentView === 'payments' && (
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                    {language === 'it' ? 'Storico Pagamenti' : 'Payment History'}
                  </h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === 'it' ? 'ID Transazione' : 'Transaction ID'}</TableHead>
                        <TableHead>{language === 'it' ? 'Data' : 'Date'}</TableHead>
                        <TableHead>{language === 'it' ? 'Importo' : 'Amount'}</TableHead>
                        <TableHead>{language === 'it' ? 'Metodo' : 'Method'}</TableHead>
                        <TableHead>{language === 'it' ? 'Stato' : 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-mono text-sm">{payment.id}</TableCell>
                          <TableCell>
                            {new Date(payment.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="font-semibold">€{payment.amount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CreditCard className="size-4" />
                              {payment.method.replace('_', ' ')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payment.status === 'completed'
                                  ? 'default'
                                  : payment.status === 'pending'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {language === 'it' 
                                ? (payment.status === 'completed' ? 'Completato' : payment.status === 'pending' ? 'In Attesa' : 'Annullato')
                                : payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {currentView === 'friends' && (
            <div className="max-w-4xl mx-auto">
              <Friends
                connections={connections}
                onAddConnection={handleAddConnection}
                onAcceptConnection={handleAcceptConnection}
                onDeclineConnection={handleDeclineConnection}
                onRemoveConnection={handleRemoveConnection}
              />
            </div>
          )}

          {currentView === 'messages' && (
            <div className="max-w-5xl mx-auto">
              <DirectMessages
                messages={messages}
                onSendMessage={handleSendMessage}
                onMarkAsRead={handleMarkAsRead}
              />
            </div>
          )}

          {currentView === 'trips' && (
            <div className="max-w-5xl mx-auto">
              <Trips
                trips={trips}
                onJoinCar={handleJoinCar}
                onLeaveCar={handleLeaveCar}
                onJoinHotel={handleJoinHotel}
                onLeaveHotel={handleLeaveHotel}
                onAddCarShare={handleAddCarShare}
                onAddHotelShare={handleAddHotelShare}
                onShareTrip={(trip) => {
                  handleShareTrip(trip);
                  setCurrentView('feed');
                }}
              />
            </div>
          )}

          {currentView === 'documents' && (
            <div className="max-w-5xl mx-auto">
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                    {language === 'it' ? 'Documenti' : 'Documents'}
                  </h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === 'it' ? 'Nome' : 'Name'}</TableHead>
                        <TableHead>{language === 'it' ? 'Data' : 'Date'}</TableHead>
                        <TableHead>{language === 'it' ? 'Tipo' : 'Type'}</TableHead>
                        <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-mono text-sm">{doc.name}</TableCell>
                          <TableCell>
                            {new Date(doc.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="font-semibold">{doc.type}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="size-4" />
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                                {language === 'it' ? 'Visualizza' : 'View'}
                              </a>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {currentView === 'memberships' && (
            <div className="max-w-6xl mx-auto">
              {/* Current Membership */}
              {memberships.filter(um => um.userId === user.id && um.status === 'active').length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                    {language === 'it' ? 'La Tua Membresia Attiva' : 'Your Active Membership'}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {memberships
                      .filter(um => um.userId === user.id && um.status === 'active')
                      .map(userMem => {
                        const membership = mockMemberships.find(m => m.id === userMem.membershipId);
                        if (!membership) return null;
                        return (
                          <MembershipCard
                            key={userMem.id}
                            membership={membership}
                            userMembership={userMem}
                            onUpgrade={() => alert(language === 'it' ? 'Rinnovo in sviluppo' : 'Renewal in development')}
                          />
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Available Memberships */}
              <div>
                <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                  {language === 'it' ? 'Membresie Disponibili' : 'Available Memberships'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {mockMemberships.map(membership => {
                    const userMem = memberships.find(
                      um => um.userId === user.id && um.membershipId === membership.id && um.status === 'active'
                    );
                    return (
                      <MembershipCard
                        key={membership.id}
                        membership={membership}
                        userMembership={userMem}
                        onPurchase={() => alert(
                          language === 'it' 
                            ? `Acquisto membresia ${membership.name} in sviluppo` 
                            : `Purchase ${membership.name} membership in development`
                        )}
                        onUpgrade={() => alert(
                          language === 'it' 
                            ? 'Rinnovo in sviluppo' 
                            : 'Renewal in development'
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Download ACSI Form */}
              <Card className="mt-8">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-[#2b2b2b] mb-2">
                        {language === 'it' ? 'Modulo Richiesta Tesseramento ACSI' : 'ACSI Membership Request Form'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {language === 'it' 
                          ? 'Scarica il modulo per la richiesta di tesseramento ACSI da compilare e consegnare.' 
                          : 'Download the ACSI membership request form to fill out and submit.'}
                      </p>
                    </div>
                    <Button className="bg-[#e67e22] hover:bg-[#d47420]">
                      <FileText className="size-4 mr-2" />
                      {language === 'it' ? 'Scarica Modulo' : 'Download Form'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
    </>
  );
}