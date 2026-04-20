import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Calendar, Users, DollarSign, Plus, Pencil, Trash2, Repeat, PartyPopper, Music, Eye, Crown, ArrowLeftRight, Menu, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { mockEvents, mockStudents, mockRegularClasses, mockFestivals, mockFestivalEvents, mockMemberships, mockUserMemberships, RegularClass, Festival, FestivalEvent, Membership, UserMembership } from '../data/mockData';
import { useState } from 'react';
import { RegularClassForm } from '../components/RegularClassForm';
import { FestivalWizard } from '../components/FestivalWizard';
import { FestivalScheduleBuilder } from '../components/FestivalScheduleBuilder';
import { FestivalEventForm } from '../components/FestivalEventForm';
import { EventTypePanel } from '../components/EventTypePanel';
import { LocationPanel } from '../components/LocationPanel';
import { RoomPanel } from '../components/RoomPanel';
import { SimpleNamePanel } from '../components/SimpleNamePanel';
import { useStyles } from '../hooks/useStyles';
import { useGenres } from '../hooks/useGenres';
import { useArtistTypes } from '../hooks/useArtistTypes';
import { ArtistPanel } from '../components/ArtistPanel';
import { useEventTypes } from '../hooks/useEventTypes';
import { useArtists } from '../hooks/useArtists';
import { useRooms } from '../hooks/useRooms';
import { useLevels } from '../hooks/useLevels';
import { useEvents, type EventItem } from '../hooks/useEvents';
import { MultiSearchSelect } from '../components/MultiSearchSelect';

export function AdminDashboard() {
  const { user, setAdminViewMode, accessToken } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { events, loading: loadingEvents, refetch: refetchEvents } = useEvents(accessToken);
  const [students, setStudents] = useState(mockStudents);
  const [regularClasses, setRegularClasses] = useState(mockRegularClasses);
  const [festivals, setFestivals] = useState(mockFestivals);
  const [festivalEvents, setFestivalEvents] = useState(mockFestivalEvents);
  const [memberships, setMemberships] = useState(mockMemberships);
  const [userMemberships, setUserMemberships] = useState(mockUserMemberships);
  const [selectedFestival, setSelectedFestival] = useState<Festival | null>(null);
  const [showFestivalWizard, setShowFestivalWizard] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventFormData, setEventFormData] = useState<{dayIndex: number, room: string, startTime: string} | null>(null);

  const [activeTab, setActiveTab] = useState('events');
  const [showStats, setShowStats] = useState(true);
  const [selectedEventModel, setSelectedEventModel] = useState<string | null>(null);

  const { styles, loading: stylesLoading, error: stylesError, create: createStyle, update: updateStyle, remove: removeStyle } = useStyles(accessToken);
  const { genres, loading: genresLoading, error: genresError, create: createGenre, update: updateGenre, remove: removeGenre } = useGenres(accessToken);
  const { artistTypes, loading: artistTypesLoading, error: artistTypesError, create: createArtistType, update: updateArtistType, remove: removeArtistType } = useArtistTypes(accessToken);

  const eventModels = [
    { key: 'event',        label: language === 'it' ? 'Eventi'           : 'Events'       },
    { key: 'event-type',   label: language === 'it' ? 'Tipi di Evento'   : 'Event Types'  },
    { key: 'location',     label: language === 'it' ? 'Sedi'             : 'Locations'    },
    { key: 'room',         label: language === 'it' ? 'Sale'             : 'Rooms'        },
    { key: 'style',        label: language === 'it' ? 'Stili'            : 'Styles'       },
    { key: 'genre',        label: language === 'it' ? 'Generi'           : 'Genres'       },
    { key: 'artist-type',  label: language === 'it' ? 'Tipi di Artista'  : 'Artist Types' },
    { key: 'artist',       label: language === 'it' ? 'Artisti'          : 'Artists'      },
  ];

  const tabs = [
    { value: 'events',          label: language === 'it' ? 'Eventi' : 'Events',                  icon: <Calendar className="size-4" /> },
    { value: 'regular-classes', label: language === 'it' ? 'Corsi Regolari' : 'Regular Classes', icon: <Repeat className="size-4" /> },
    { value: 'students',        label: language === 'it' ? 'Studenti' : 'Students',               icon: <Users className="size-4" /> },
    { value: 'memberships',     label: language === 'it' ? 'Membresie' : 'Memberships',           icon: <Crown className="size-4" /> },
    { value: 'festivals',       label: language === 'it' ? 'Festival' : 'Festivals',              icon: <PartyPopper className="size-4" /> },
  ];

  const activeTabLabel = activeTab === 'events' && selectedEventModel
    ? (eventModels.find(m => m.key === selectedEventModel)?.label ?? (language === 'it' ? 'Eventi' : 'Events'))
    : (tabs.find(t => t.value === activeTab)?.label ?? '');

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  const totalRevenue = events.reduce(
    (sum, event) => sum + event.currentEnrollment * event.price,
    0
  );
  const totalStudents = students.length;
  const upcomingEvents = events.filter(
    (event) => new Date(event.date) >= new Date()
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="bg-[#2b2b2b] text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 uppercase tracking-wide">{t('admin.title')}</h1>
              <p className="text-lg opacity-90">
                {language === 'it' ? 'Gestisci la tua scuola di danza' : 'Manage your dance school'}
              </p>
            </div>
            <Button
              onClick={() => {
                setAdminViewMode('student');
                navigate('/student');
              }}
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <ArrowLeftRight className="size-4 mr-2" />
              {language === 'it' ? 'Vista Studente' : 'Student View'}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats toggle */}
        <div className="flex justify-end mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStats(v => !v)}
            className="text-gray-500 hover:text-gray-800 flex items-center gap-1"
          >
            {showStats
              ? <><ChevronDown className="size-4" />{language === 'it' ? 'Nascondi riepilogo' : 'Hide summary'}</>
              : <><ChevronDown className="size-4 rotate-180" />{language === 'it' ? 'Mostra riepilogo' : 'Show summary'}</>
            }
          </Button>
        </div>

        {/* Stats Cards */}
        {showStats && <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-[#d4b896]/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'it' ? 'Entrate Totali' : 'Total Revenue'}
              </CardTitle>
              <DollarSign className="size-4 text-[#e67e22]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#2b2b2b]">€{totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-gray-600 mt-1">Da tutte le prenotazioni</p>
            </CardContent>
          </Card>

          <Card className="border-[#d4b896]/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Studenti Attivi</CardTitle>
              <Users className="size-4 text-[#e67e22]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#2b2b2b]">{totalStudents}</div>
              <p className="text-xs text-gray-600 mt-1">Membri iscritti</p>
            </CardContent>
          </Card>

          <Card className="border-[#d4b896]/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prossimi Eventi</CardTitle>
              <Calendar className="size-4 text-[#e67e22]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#2b2b2b]">{upcomingEvents}</div>
              <p className="text-xs text-gray-600 mt-1">Corsi & eventi programmati</p>
            </CardContent>
          </Card>
        </div>}

        {/* Management Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Desktop tab bar */}
          <TabsList className="hidden md:flex">
            {/* Events entry — dropdown with all event models */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  className={[
                    'inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow]',
                    activeTab === 'events'
                      ? 'bg-card border-transparent shadow-sm'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                  onClick={() => setActiveTab('events')}
                >
                  <Calendar className="size-4" />
                  {language === 'it' ? 'Eventi' : 'Events'}
                  <ChevronDown className="size-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent modal={false}>
                {eventModels.map(model => (
                  <DropdownMenuItem
                    key={model.key}
                    className="cursor-pointer"
                    onSelect={() => { setActiveTab('events'); setSelectedEventModel(model.key); }}
                  >
                    {model.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Remaining tabs */}
            {tabs.filter(t => t.value !== 'events').map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Mobile burger menu */}
          <div className="md:hidden">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Menu className="size-4" />
                    {activeTabLabel}
                  </span>
                  <ChevronDown className="size-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full min-w-[--radix-dropdown-menu-trigger-width]">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Calendar className="size-4" />
                  {language === 'it' ? 'Eventi' : 'Events'}
                </DropdownMenuLabel>
                {eventModels.map(model => (
                  <DropdownMenuItem
                    key={model.key}
                    className="pl-6 cursor-pointer"
                    onSelect={() => { setActiveTab('events'); setSelectedEventModel(model.key); }}
                  >
                    {model.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {tabs.filter(t => t.value !== 'events').map(tab => (
                  <DropdownMenuItem
                    key={tab.value}
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={() => { setActiveTab(tab.value); setSelectedEventModel(null); }}
                  >
                    {tab.icon}
                    {tab.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TabsContent value="events" className="mt-6">
            {selectedEventModel === 'event-type' && <EventTypePanel />}
            {selectedEventModel === 'location' && <LocationPanel />}
            {selectedEventModel === 'room' && <RoomPanel />}
            {selectedEventModel === 'style' && (
              <SimpleNamePanel
                title="Styles" titleIt="Stili"
                description="Manage dance styles" descriptionIt="Gestisci gli stili di danza"
                items={styles} loading={stylesLoading} error={stylesError}
                onCreate={name => createStyle({ name })}
                onUpdate={(id, name) => updateStyle(id, { name })}
                onRemove={removeStyle}
              />
            )}
            {selectedEventModel === 'genre' && (
              <SimpleNamePanel
                title="Genres" titleIt="Generi"
                description="Manage music genres" descriptionIt="Gestisci i generi musicali"
                items={genres} loading={genresLoading} error={genresError}
                onCreate={name => createGenre({ name })}
                onUpdate={(id, name) => updateGenre(id, { name })}
                onRemove={removeGenre}
              />
            )}
            {selectedEventModel === 'artist-type' && (
              <SimpleNamePanel
                title="Artist Types" titleIt="Tipi di Artista"
                description="Manage artist types" descriptionIt="Gestisci i tipi di artista"
                items={artistTypes} loading={artistTypesLoading} error={artistTypesError}
                onCreate={name => createArtistType({ name })}
                onUpdate={(id, name) => updateArtistType(id, { name })}
                onRemove={removeArtistType}
              />
            )}
            {selectedEventModel === 'artist' && <ArtistPanel />}
            {(selectedEventModel === null || selectedEventModel === 'event') && <EventsPanel events={events} loading={loadingEvents} onRefetch={refetchEvents} />}
          </TabsContent>

          <TabsContent value="regular-classes" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Regular Classes Management</CardTitle>
                    <CardDescription>Manage regular dance classes</CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="size-4 mr-2" />
                        Add Regular Class
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create New Regular Class</DialogTitle>
                        <DialogDescription>Add a new regular dance class</DialogDescription>
                      </DialogHeader>
                      <RegularClassForm />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'it' ? 'Corso' : 'Class'}</TableHead>
                      <TableHead>{language === 'it' ? 'Giorno' : 'Day'}</TableHead>
                      <TableHead>{language === 'it' ? 'Ora' : 'Time'}</TableHead>
                      <TableHead>{language === 'it' ? 'Frequenza' : 'Frequency'}</TableHead>
                      <TableHead>{language === 'it' ? 'Istruttore' : 'Instructor'}</TableHead>
                      <TableHead>{language === 'it' ? 'Periodo' : 'Period'}</TableHead>
                      <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regularClasses.map((regularClass) => {
                      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      const dayNamesIt = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
                      const dayName = language === 'it' ? dayNamesIt[regularClass.dayOfWeek] : dayNames[regularClass.dayOfWeek];
                      
                      return (
                        <TableRow key={regularClass.id}>
                          <TableCell className="font-medium">{regularClass.title}</TableCell>
                          <TableCell>{dayName}</TableCell>
                          <TableCell>{regularClass.time}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {regularClass.frequency === 'weekly' 
                                ? (language === 'it' ? 'Settimanale' : 'Weekly')
                                : regularClass.frequency === 'fortnightly'
                                ? (language === 'it' ? 'Bisettimanale' : 'Fortnightly')
                                : (language === 'it' ? 'Mensile' : 'Monthly')}
                            </Badge>
                          </TableCell>
                          <TableCell>{regularClass.instructor}</TableCell>
                          <TableCell className="text-sm">
                            {new Date(regularClass.startDate).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                              month: 'short',
                              day: 'numeric',
                            })} - {new Date(regularClass.endDate).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost">
                                <Pencil className="size-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-600">
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Student Management</CardTitle>
                    <CardDescription>View and manage student accounts</CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="size-4 mr-2" />
                        Add Student
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Student</DialogTitle>
                        <DialogDescription>Create a new student account</DialogDescription>
                      </DialogHeader>
                      <StudentForm />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>{language === 'it' ? 'Codice Fiscale' : 'Fiscal Code'}</TableHead>
                      <TableHead>{language === 'it' ? 'ACSI' : 'ACSI'}</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Active Classes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{student.name}</div>
                            {student.surname && (
                              <div className="text-xs text-gray-500">{student.surname}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{student.phone}</TableCell>
                        <TableCell>
                          {student.fiscalCode ? (
                            <span className="text-xs font-mono">{student.fiscalCode}</span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.isAcsiMember ? (
                            <Badge className="bg-green-600 text-xs">
                              {language === 'it' ? 'Tesserato' : 'Member'}
                            </Badge>
                          ) : student.acsiMembershipRequested ? (
                            <Badge className="bg-yellow-600 text-xs">
                              {language === 'it' ? 'Pendente' : 'Pending'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {language === 'it' ? 'No' : 'No'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(student.joinedDate).toLocaleDateString('en-GB', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge>{student.activeClasses}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Eye className="size-4 mr-1" />
                                  {language === 'it' ? 'Dettagli' : 'Details'}
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Student Details</DialogTitle>
                                  <DialogDescription>Complete student information</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                  {/* Personal Information */}
                                  <div>
                                    <h4 className="font-semibold text-lg mb-3 text-[#2b2b2b]">
                                      {language === 'it' ? 'Informazioni Personali' : 'Personal Information'}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <Label className="text-gray-600">{language === 'it' ? 'Nome' : 'Name'}</Label>
                                        <p className="font-medium">{student.name}</p>
                                      </div>
                                      {student.surname && (
                                        <div>
                                          <Label className="text-gray-600">{language === 'it' ? 'Cognome' : 'Surname'}</Label>
                                          <p className="font-medium">{student.surname}</p>
                                        </div>
                                      )}
                                      {student.dateOfBirth && (
                                        <div>
                                          <Label className="text-gray-600">{language === 'it' ? 'Data di Nascita' : 'Date of Birth'}</Label>
                                          <p className="font-medium">
                                            {new Date(student.dateOfBirth).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                                              day: 'numeric',
                                              month: 'long',
                                              year: 'numeric'
                                            })}
                                          </p>
                                        </div>
                                      )}
                                      {student.placeOfBirth && (
                                        <div>
                                          <Label className="text-gray-600">{language === 'it' ? 'Luogo di Nascita' : 'Place of Birth'}</Label>
                                          <p className="font-medium">{student.placeOfBirth}</p>
                                        </div>
                                      )}
                                      {student.fiscalCode && (
                                        <div>
                                          <Label className="text-gray-600">{language === 'it' ? 'Codice Fiscale' : 'Fiscal Code'}</Label>
                                          <p className="font-medium font-mono">{student.fiscalCode}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Address */}
                                  {student.address && (
                                    <div>
                                      <h4 className="font-semibold text-lg mb-3 text-[#2b2b2b]">
                                        {language === 'it' ? 'Indirizzo' : 'Address'}
                                      </h4>
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="col-span-2">
                                          <Label className="text-gray-600">{language === 'it' ? 'Via' : 'Street'}</Label>
                                          <p className="font-medium">{student.address.street}</p>
                                        </div>
                                        <div>
                                          <Label className="text-gray-600">{language === 'it' ? 'CAP' : 'Postcode'}</Label>
                                          <p className="font-medium">{student.address.postcode}</p>
                                        </div>
                                        <div>
                                          <Label className="text-gray-600">{language === 'it' ? 'Città' : 'City'}</Label>
                                          <p className="font-medium">{student.address.city}</p>
                                        </div>
                                        <div>
                                          <Label className="text-gray-600">{language === 'it' ? 'Paese' : 'Country'}</Label>
                                          <p className="font-medium">{student.address.country}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Contact Information */}
                                  <div>
                                    <h4 className="font-semibold text-lg mb-3 text-[#2b2b2b]">
                                      {language === 'it' ? 'Contatti' : 'Contact Information'}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <Label className="text-gray-600">Email</Label>
                                        <p className="font-medium">{student.email}</p>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600">{language === 'it' ? 'Telefono' : 'Phone'}</Label>
                                        <p className="font-medium">{student.phone}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* ACSI Membership */}
                                  <div>
                                    <h4 className="font-semibold text-lg mb-3 text-[#2b2b2b]">
                                      {language === 'it' ? 'Tesseramento ACSI' : 'ACSI Membership'}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <Label className="text-gray-600">{language === 'it' ? 'Stato' : 'Status'}</Label>
                                        <p className="font-medium">
                                          {student.isAcsiMember ? (
                                            <Badge className="bg-green-600">
                                              {language === 'it' ? 'Tesserato' : 'Member'}
                                            </Badge>
                                          ) : student.acsiMembershipRequested ? (
                                            <Badge className="bg-yellow-600">
                                              {language === 'it' ? 'Richiesta Pendente' : 'Request Pending'}
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline">
                                              {language === 'it' ? 'Non Tesserato' : 'Not a Member'}
                                            </Badge>
                                          )}
                                        </p>
                                      </div>
                                      {student.acsiNumber && (
                                        <div>
                                          <Label className="text-gray-600">{language === 'it' ? 'Numero Tessera' : 'Membership Number'}</Label>
                                          <p className="font-medium font-mono">{student.acsiNumber}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Registration Details */}
                                  <div>
                                    <h4 className="font-semibold text-lg mb-3 text-[#2b2b2b]">
                                      {language === 'it' ? 'Dettagli Registrazione' : 'Registration Details'}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <Label className="text-gray-600">{language === 'it' ? 'Data Iscrizione' : 'Registration Date'}</Label>
                                        <p className="font-medium">
                                          {new Date(student.joinedDate).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                          })}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600">{language === 'it' ? 'Corsi Attivi' : 'Active Classes'}</Label>
                                        <p className="font-medium">{student.activeClasses}</p>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600">{language === 'it' ? 'Termini Accettati' : 'Terms Accepted'}</Label>
                                        <p className="font-medium">
                                          {student.termsAccepted ? (
                                            <Badge className="bg-green-600">
                                                {language === 'it' ? 'Sì' : 'Yes'}
                                            </Badge>
                                          ) : (
                                            <Badge variant="destructive">
                                              {language === 'it' ? 'No' : 'No'}
                                            </Badge>
                                          )}
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600">{language === 'it' ? 'Consenso Marketing' : 'Marketing Consent'}</Label>
                                        <p className="font-medium">
                                          {student.marketingConsent ? (
                                            <Badge className="bg-green-600">
                                              {language === 'it' ? 'Sì' : 'Yes'}
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline">
                                              {language === 'it' ? 'No' : 'No'}
                                            </Badge>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="ghost">
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600">
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memberships" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Membership Management</CardTitle>
                    <CardDescription>Manage student memberships</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'it' ? 'Studente' : 'Student'}</TableHead>
                      <TableHead>{language === 'it' ? 'Tipo di Membresia' : 'Membership Type'}</TableHead>
                      <TableHead>{language === 'it' ? 'Data di Inizio' : 'Start Date'}</TableHead>
                      <TableHead>{language === 'it' ? 'Data di Scadenza' : 'End Date'}</TableHead>
                      <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userMemberships.map((userMembership) => {
                      const student = students.find(s => s.id === userMembership.userId);
                      const membership = memberships.find(m => m.id === userMembership.membershipId);
                      return (
                        <TableRow key={userMembership.id}>
                          <TableCell className="font-medium">
                            {student ? `${student.name} ${student.surname || ''}` : 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" style={{ backgroundColor: membership?.color, color: 'white' }}>
                              {membership?.name || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(userMembership.validFrom).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            {new Date(userMembership.validTo).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost">
                                <Pencil className="size-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-600">
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="festivals" className="mt-6">
            {!selectedFestival ? (
              // List of Festivals
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>
                        {language === 'it' ? 'Gestione Festival' : 'Festivals Management'}
                      </CardTitle>
                      <CardDescription>
                        {language === 'it' 
                          ? 'Crea e gestisci festival di danza con workshop e feste' 
                          : 'Create and manage dance festivals with workshops and parties'}
                      </CardDescription>
                    </div>
                    <Dialog open={showFestivalWizard} onOpenChange={setShowFestivalWizard}>
                      <DialogTrigger asChild>
                        <Button className="bg-[#e67e22] hover:bg-[#d4b896]">
                          <Plus className="size-4 mr-2" />
                          {language === 'it' ? 'Nuovo Festival' : 'New Festival'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            {language === 'it' ? 'Crea Nuovo Festival' : 'Create New Festival'}
                          </DialogTitle>
                          <DialogDescription>
                            {language === 'it' 
                              ? 'Configura il festival e aggiungi workshop e feste' 
                              : 'Configure the festival and add workshops and parties'}
                          </DialogDescription>
                        </DialogHeader>
                        <FestivalWizard
                          onComplete={(festivalData) => {
                            const newFestival: Festival = {
                              ...festivalData,
                              id: `fest${festivals.length + 1}`,
                              status: 'draft',
                            };
                            setFestivals([...festivals, newFestival]);
                            setShowFestivalWizard(false);
                            setSelectedFestival(newFestival);
                          }}
                          onCancel={() => setShowFestivalWizard(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {festivals.length === 0 ? (
                    <div className="text-center py-12">
                      <PartyPopper className="size-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-4">
                        {language === 'it' 
                          ? 'Nessun festival creato ancora' 
                          : 'No festivals created yet'}
                      </p>
                      <Button 
                        onClick={() => setShowFestivalWizard(true)}
                        className="bg-[#e67e22] hover:bg-[#d4b896]"
                      >
                        <Plus className="size-4 mr-2" />
                        {language === 'it' ? 'Crea il tuo primo festival' : 'Create your first festival'}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {festivals.map((festival) => (
                        <Card key={festival.id} className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setSelectedFestival(festival)}
                        >
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="text-xl font-bold text-[#2b2b2b] mb-2">
                                  {festival.title}
                                </h3>
                                <p className="text-gray-600 mb-3">{festival.description}</p>
                                <div className="flex flex-wrap gap-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="size-4 text-[#e67e22]" />
                                    <span>
                                      {new Date(festival.startDate).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                                        month: 'short',
                                        day: 'numeric',
                                      })} - {new Date(festival.endDate).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Music className="size-4 text-[#e67e22]" />
                                    <span>
                                      {festivalEvents.filter(e => e.festivalId === festival.id).length}{' '}
                                      {language === 'it' ? 'eventi' : 'events'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Badge 
                                variant={festival.status === 'published' ? 'default' : 'outline'}
                                className={festival.status === 'published' ? 'bg-green-500' : ''}
                              >
                                {festival.status === 'published' 
                                  ? (language === 'it' ? 'Pubblicato' : 'Published')
                                  : (language === 'it' ? 'Bozza' : 'Draft')}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              // Festival Schedule Builder
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedFestival(null)}
                  >
                    ← {language === 'it' ? 'Torna ai Festival' : 'Back to Festivals'}
                  </Button>
                  <div className="flex gap-2">
                    <Badge 
                      variant={selectedFestival.status === 'published' ? 'default' : 'outline'}
                      className={selectedFestival.status === 'published' ? 'bg-green-500' : ''}
                    >
                      {selectedFestival.status === 'published' 
                        ? (language === 'it' ? 'Pubblicato' : 'Published')
                        : (language === 'it' ? 'Bozza' : 'Draft')}
                    </Badge>
                    <Button 
                      className="bg-[#e67e22] hover:bg-[#d4b896]"
                      onClick={() => {
                        setFestivals(festivals.map(f => 
                          f.id === selectedFestival.id 
                            ? { ...f, status: f.status === 'published' ? 'draft' : 'published' }
                            : f
                        ));
                        setSelectedFestival({
                          ...selectedFestival,
                          status: selectedFestival.status === 'published' ? 'draft' : 'published',
                        });
                      }}
                    >
                      {selectedFestival.status === 'published'
                        ? (language === 'it' ? 'Rimuovi Pubblicazione' : 'Unpublish')
                        : (language === 'it' ? 'Pubblica' : 'Publish')}
                    </Button>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>{selectedFestival.title}</CardTitle>
                    <CardDescription>{selectedFestival.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <div className="text-sm text-gray-600">
                          {language === 'it' ? 'Durata' : 'Duration'}
                        </div>
                        <div className="font-medium">{selectedFestival.numberOfDays} {language === 'it' ? 'giorni' : 'days'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">
                          {language === 'it' ? 'Sale' : 'Rooms'}
                        </div>
                        <div className="font-medium">{selectedFestival.rooms.length}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">
                          {language === 'it' ? 'Eventi' : 'Events'}
                        </div>
                        <div className="font-medium">
                          {festivalEvents.filter(e => e.festivalId === selectedFestival.id).length}
                        </div>
                      </div>
                    </div>

                    <FestivalScheduleBuilder
                      festival={selectedFestival}
                      events={festivalEvents.filter(e => e.festivalId === selectedFestival.id)}
                      onEventsChange={(updatedEvents) => {
                        setFestivalEvents([
                          ...festivalEvents.filter(e => e.festivalId !== selectedFestival.id),
                          ...updatedEvents,
                        ]);
                      }}
                      onAddEvent={(dayIndex, room, startTime) => {
                        setEventFormData({ dayIndex, room, startTime });
                        setShowEventForm(true);
                      }}
                    />
                  </CardContent>
                </Card>

                {/* Add Event Dialog */}
                <Dialog open={showEventForm} onOpenChange={setShowEventForm}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {language === 'it' ? 'Aggiungi Evento al Festival' : 'Add Event to Festival'}
                      </DialogTitle>
                      <DialogDescription>
                        {language === 'it' 
                          ? 'Crea un workshop o una festa per il festival' 
                          : 'Create a workshop or party for the festival'}
                      </DialogDescription>
                    </DialogHeader>
                    {eventFormData && (
                      <FestivalEventForm
                        festival={selectedFestival}
                        dayIndex={eventFormData.dayIndex}
                        room={eventFormData.room}
                        startTime={eventFormData.startTime}
                        onSubmit={(eventData) => {
                          const newEvent: FestivalEvent = {
                            id: `fe${festivalEvents.length + 1}`,
                            festivalId: selectedFestival.id,
                            title: eventData.name,
                            type: 'workshop',
                            dayIndex: eventData.dayIndex,
                            room: eventData.room,
                            startTime: eventData.startTime,
                            duration: eventData.duration,
                            maxCapacity: eventData.maxCapacity,
                            currentEnrollment: 0,
                            description: eventData.description,
                            style: eventData.style,
                            price: 0,
                          };
                          setFestivalEvents([...festivalEvents, newEvent]);
                          setShowEventForm(false);
                          setEventFormData(null);
                        }}
                        onCancel={() => {
                          setShowEventForm(false);
                          setEventFormData(null);
                        }}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EventsPanel({ events, loading, onRefetch }: { events: EventItem[]; loading: boolean; onRefetch: () => void }) {
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const { accessToken } = useAuth();
  const { remove } = useEvents(accessToken);

  const handleDelete = async (id: number) => {
    await remove(id);
    onRefetch();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Events Management</CardTitle>
            <CardDescription>Create and manage dance classes and events</CardDescription>
          </div>
          <EventFormDialog onSuccess={onRefetch} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-500 py-4">Loading events...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Artists</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell><Badge variant="outline">{event.event_type.name}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{event.status}</Badge></TableCell>
                  <TableCell>{new Date(event.start_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}</TableCell>
                  <TableCell>{event.room.name}</TableCell>
                  <TableCell>{event.artists.map(a => a.full_name).join(', ') || '—'}</TableCell>
                  <TableCell>{event.capacity}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingEvent(event)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(event.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {editingEvent && (
        <Dialog open onOpenChange={(o) => { if (!o) setEditingEvent(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
              <DialogDescription>Update event details</DialogDescription>
            </DialogHeader>
            <EventForm
              initialData={editingEvent}
              onSuccess={() => { onRefetch(); setEditingEvent(null); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function EventFormDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4 mr-2" />Add Event</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>Add a new class, workshop, or event</DialogDescription>
        </DialogHeader>
        <EventForm onSuccess={() => { onSuccess(); setOpen(false); }} />
      </DialogContent>
    </Dialog>
  );
}

function EventForm({ onSuccess, initialData }: { onSuccess: () => void; initialData?: EventItem }) {
  const { accessToken } = useAuth();
  const { eventTypes, loading: loadingTypes } = useEventTypes(accessToken);
  const { rooms, loading: loadingRooms } = useRooms(accessToken);
  const { levels, loading: loadingLevels } = useLevels(accessToken);
  const { artists, loading: loadingArtists } = useArtists(accessToken);
  const { genres, loading: loadingGenres } = useGenres(accessToken);
  const { styles, loading: loadingStyles } = useStyles(accessToken);
  const { create, update } = useEvents(accessToken);

  const parseDate = (iso: string) => iso ? iso.slice(0, 10) : '';
  const parseTime = (iso: string) => iso ? iso.slice(11, 16) : '';

  const [name, setName] = useState(initialData?.name ?? '');
  const [status, setStatus] = useState(initialData?.status ?? 'draft');
  const [eventTypeId, setEventTypeId] = useState(initialData?.event_type.id.toString() ?? '');
  const [accessType, setAccessType] = useState(initialData?.type ?? 'members');
  const [levelId, setLevelId] = useState(initialData?.level?.id.toString() ?? '');
  const [roomId, setRoomId] = useState(initialData?.room.id.toString() ?? '');
  const [startDate, setStartDate] = useState(parseDate(initialData?.start_date ?? ''));
  const [startTime, setStartTime] = useState(parseTime(initialData?.start_date ?? ''));
  const [endDate, setEndDate] = useState(parseDate(initialData?.end_date ?? ''));
  const [endTime, setEndTime] = useState(parseTime(initialData?.end_date ?? ''));
  const [duration, setDuration] = useState(initialData?.duration.toString() ?? '');
  const [capacity, setCapacity] = useState(initialData?.capacity.toString() ?? '');
  const [selectedArtists, setSelectedArtists] = useState<{ id: number; name: string }[]>(
    initialData?.artists.map(a => ({ id: a.id, name: a.full_name })) ?? []
  );
  const [selectedGenres, setSelectedGenres] = useState<{ id: number; name: string }[]>(
    initialData?.genres ?? []
  );
  const [selectedStyles, setSelectedStyles] = useState<{ id: number; name: string }[]>(
    initialData?.styles ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const artistItems = artists.map(a => ({ id: a.id, name: a.full_name }));
  const isEdit = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload = {
      name,
      status,
      event_type_id: Number(eventTypeId),
      type: accessType,
      start_date: `${startDate}T${startTime}:00`,
      end_date: `${endDate}T${endTime}:00`,
      duration: Number(duration),
      room_id: Number(roomId),
      capacity: Number(capacity),
      level_id: levelId ? Number(levelId) : null,
      artist_ids: selectedArtists.map(a => a.id),
      genre_ids: selectedGenres.map(g => g.id),
      style_ids: selectedStyles.map(s => s.id),
    };
    try {
      if (isEdit) {
        await update(initialData.id, payload);
      } else {
        await create(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="name">Event Title *</Label>
          <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Swing Dancing Fundamentals" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="event_type">Event Type *</Label>
          <Select value={eventTypeId} onValueChange={setEventTypeId} disabled={loadingTypes}>
            <SelectTrigger id="event_type"><SelectValue placeholder={loadingTypes ? 'Loading...' : 'Select type'} /></SelectTrigger>
            <SelectContent>
              {eventTypes.map(et => <SelectItem key={et.id} value={et.id.toString()}>{et.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="access_type">Access</Label>
          <Select value={accessType} onValueChange={setAccessType}>
            <SelectTrigger id="access_type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="members">Members</SelectItem>
              <SelectItem value="collaboration">Collaboration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="level">Level</Label>
          <Select value={levelId} onValueChange={setLevelId} disabled={loadingLevels}>
            <SelectTrigger id="level"><SelectValue placeholder={loadingLevels ? 'Loading...' : 'Select level'} /></SelectTrigger>
            <SelectContent>
              {levels.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="room">Room *</Label>
          <Select value={roomId} onValueChange={setRoomId} disabled={loadingRooms}>
            <SelectTrigger id="room"><SelectValue placeholder={loadingRooms ? 'Loading...' : 'Select room'} /></SelectTrigger>
            <SelectContent>
              {rooms.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name} — {r.location.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date *</Label>
          <Input id="start_date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="start_time">Start Time *</Label>
          <Input id="start_time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">End Date *</Label>
          <Input id="end_date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_time">End Time *</Label>
          <Input id="end_time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duration (minutes) *</Label>
          <Input id="duration" type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="90" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="capacity">Max Capacity *</Label>
          <Input id="capacity" type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="20" required />
        </div>

        <div className="col-span-2">
          <MultiSearchSelect label="Instructors / Artists" items={artistItems} selected={selectedArtists} loading={loadingArtists} placeholder="Search artist..." onChange={setSelectedArtists} />
        </div>

        <div className="col-span-2">
          <MultiSearchSelect label="Genres" items={genres} selected={selectedGenres} loading={loadingGenres} placeholder="Search genre..." onChange={setSelectedGenres} />
        </div>

        <div className="col-span-2">
          <MultiSearchSelect label="Styles" items={styles} selected={selectedStyles} loading={loadingStyles} placeholder="Search style..." onChange={setSelectedStyles} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Event'}
        </Button>
      </div>
    </form>
  );
}

function StudentForm() {
  return (
    <form className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" placeholder="John Doe" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="student@example.com" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" placeholder="+1 234 567 8900" />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">Add Student</Button>
      </div>
    </form>
  );
}