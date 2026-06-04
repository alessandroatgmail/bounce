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
import { Calendar, Users, DollarSign, Plus, Pencil, Trash2, Repeat, PartyPopper, Eye, Crown, ArrowLeftRight, Menu, ChevronDown, Bell, Upload, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { mockStudents, mockRegularClasses, mockMemberships, mockUserMemberships, RegularClass, Membership, UserMembership } from '../data/mockData';
import { useState, useRef } from 'react';
import { RegularClassForm } from '../components/RegularClassForm';
import { FestivalPanel } from '../components/FestivalPanel';
import { WeeklyGrid } from '../components/WeeklyGrid';
import { EventTypePanel } from '../components/EventTypePanel';
import { LocationPanel } from '../components/LocationPanel';
import { RoomPanel } from '../components/RoomPanel';
import { SimpleNamePanel } from '../components/SimpleNamePanel';
import { useStyles } from '../hooks/useStyles';
import { useGenres } from '../hooks/useGenres';
import { useArtistTypes } from '../hooks/useArtistTypes';
import { ArtistPanel } from '../components/ArtistPanel';
import { MembershipPanel } from '../components/MembershipPanel';
import { MembershipManagementPanel } from '../components/MembershipManagementPanel';
import { DiscountPanel } from '../components/DiscountPanel';
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
  const { events, loading: loadingEvents, refetch: refetchEvents, remove: removeEvent } = useEvents(accessToken);
  const [students, setStudents] = useState(mockStudents);
  const [regularClasses, setRegularClasses] = useState(mockRegularClasses);
  const [memberships, setMemberships] = useState(mockMemberships);
  const [userMemberships, setUserMemberships] = useState(mockUserMemberships);

  const [activeTab, setActiveTab] = useState('events');
  const [showStats, setShowStats] = useState(true);
  const [selectedEventModel, setSelectedEventModel] = useState<string | null>(null);
  const [selectedPackModel, setSelectedPackModel] = useState<string>('plans');

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

  const packModels = [
    { key: 'plans',      label: language === 'it' ? 'Piani'    : 'Plans'      },
    { key: 'management', label: language === 'it' ? 'Gestione' : 'Management' },
    { key: 'discounts',  label: language === 'it' ? 'Sconti'   : 'Discounts'  },
  ];

  const tabs = [
    { value: 'events',          label: language === 'it' ? 'Eventi' : 'Events',                  icon: <Calendar className="size-4" /> },
    { value: 'regular-classes', label: language === 'it' ? 'Corsi Regolari' : 'Regular Classes', icon: <Repeat className="size-4" /> },
    { value: 'students',        label: language === 'it' ? 'Studenti' : 'Students',               icon: <Users className="size-4" /> },
    { value: 'packs',           label: language === 'it' ? 'Pacchetti' : 'Packs',                icon: <Crown className="size-4" /> },
    { value: 'festivals',       label: language === 'it' ? 'Festival' : 'Festivals',              icon: <PartyPopper className="size-4" /> },
    { value: 'notifications',   label: language === 'it' ? 'Notifiche' : 'Notifications',         icon: <Bell className="size-4" /> },
  ];

  const activeTabLabel = activeTab === 'events' && selectedEventModel
    ? (eventModels.find(m => m.key === selectedEventModel)?.label ?? (language === 'it' ? 'Eventi' : 'Events'))
    : activeTab === 'packs'
    ? (packModels.find(m => m.key === selectedPackModel)?.label ?? (language === 'it' ? 'Pacchetti' : 'Packs'))
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

            {/* Remaining tabs — Packs gets a dropdown, the rest are plain triggers */}
            {tabs.filter(t => t.value !== 'events').map(tab =>
              tab.value === 'packs' ? (
                <DropdownMenu key="packs" modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={[
                        'inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow]',
                        activeTab === 'packs'
                          ? 'bg-card border-transparent shadow-sm'
                          : 'border-transparent text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                      onClick={() => setActiveTab('packs')}
                    >
                      <Crown className="size-4" />
                      {language === 'it' ? 'Pacchetti' : 'Packs'}
                      <ChevronDown className="size-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent modal={false}>
                    {packModels.map(model => (
                      <DropdownMenuItem
                        key={model.key}
                        className="cursor-pointer"
                        onSelect={() => { setActiveTab('packs'); setSelectedPackModel(model.key); }}
                      >
                        {model.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                </TabsTrigger>
              )
            )}
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
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Crown className="size-4" />
                  {language === 'it' ? 'Pacchetti' : 'Packs'}
                </DropdownMenuLabel>
                {packModels.map(model => (
                  <DropdownMenuItem
                    key={model.key}
                    className="pl-6 cursor-pointer"
                    onSelect={() => { setActiveTab('packs'); setSelectedPackModel(model.key); }}
                  >
                    {model.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {tabs.filter(t => t.value !== 'events' && t.value !== 'packs').map(tab => (
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
            {(selectedEventModel === null || selectedEventModel === 'event') && <EventsPanel events={events} loading={loadingEvents} onRefetch={refetchEvents} onRemove={removeEvent} />}
          </TabsContent>

          <TabsContent value="regular-classes" className="mt-6">
            <WeeklyGrid events={events} loading={loadingEvents} onRefetch={refetchEvents} />
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

          <TabsContent value="packs" className="mt-6">
            {selectedPackModel === 'plans' && <MembershipPanel />}
            {selectedPackModel === 'management' && <MembershipManagementPanel />}
            {selectedPackModel === 'discounts' && <DiscountPanel />}
          </TabsContent>

          <TabsContent value="festivals" className="mt-6">
            <FestivalPanel />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="size-5 text-[#e67e22]" />
                  <div>
                    <CardTitle>{language === 'it' ? 'Notifiche' : 'Notifications'}</CardTitle>
                    <CardDescription>
                      {language === 'it'
                        ? 'Gestisci le notifiche per gli studenti'
                        : 'Manage notifications for students'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  {language === 'it'
                    ? 'Sezione in arrivo.'
                    : 'Coming soon.'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EventsPanel({ events, loading, onRefetch, onRemove }: { events: EventItem[]; loading: boolean; onRefetch: () => void; onRemove: (id: number) => Promise<void> }) {
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  const [filterName, setFilterName] = useState('');
  const [filterParent, setFilterParent] = useState(false);
  const [filterActive, setFilterActive] = useState(false);
  const [filterStyleId, setFilterStyleId] = useState<string>('');
  const [filterLevelId, setFilterLevelId] = useState<string>('');
  const [filterAccess, setFilterAccess] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCityId, setFilterCityId] = useState<string>('');

  const now = new Date();

  const allStyles = Array.from(
    new Map(events.flatMap(e => e.styles).map(s => [s.id, s])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const allLevels = Array.from(
    new Map(events.flatMap(e => e.level ? [e.level] : []).map(l => [l.id, l])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const allCities = Array.from(
    new Map(events.map(e => e.room.location.city).map(c => [c.id, c])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filtered = events.filter(e => {
    if (filterName && !e.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterParent && e.events.length === 0) return false;
    if (filterActive && new Date(e.end_date) <= now) return false;
    if (filterStyleId && !e.styles.some(s => s.id === Number(filterStyleId))) return false;
    if (filterLevelId && e.level?.id !== Number(filterLevelId)) return false;
    if (filterAccess && e.type !== filterAccess) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterCityId && e.room.location.city.id !== Number(filterCityId)) return false;
    return true;
  });

  const handleDelete = async (id: number) => {
    await onRemove(id);
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
      <CardContent className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px] space-y-1">
            <Label className="text-xs text-gray-500">Name</Label>
            <Input
              placeholder="Search name…"
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="min-w-[140px] space-y-1">
            <Label className="text-xs text-gray-500">Style</Label>
            <Select value={filterStyleId || 'all'} onValueChange={v => setFilterStyleId(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All styles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All styles</SelectItem>
                {allStyles.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[140px] space-y-1">
            <Label className="text-xs text-gray-500">Level</Label>
            <Select value={filterLevelId || 'all'} onValueChange={v => setFilterLevelId(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All levels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {allLevels.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[140px] space-y-1">
            <Label className="text-xs text-gray-500">Access</Label>
            <Select value={filterAccess || 'all'} onValueChange={v => setFilterAccess(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="members">Members</SelectItem>
                <SelectItem value="collaboration">Collaboration</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[140px] space-y-1">
            <Label className="text-xs text-gray-500">Status</Label>
            <Select value={filterStatus || 'all'} onValueChange={v => setFilterStatus(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[140px] space-y-1">
            <Label className="text-xs text-gray-500">City</Label>
            <Select value={filterCityId || 'all'} onValueChange={v => setFilterCityId(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All cities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                {allCities.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <button
            type="button"
            onClick={() => setFilterParent(v => !v)}
            className={[
              'h-8 px-3 rounded-md border text-xs font-medium transition-colors',
              filterParent
                ? 'bg-[#2b2b2b] text-white border-[#2b2b2b]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
            ].join(' ')}
          >
            Parent only
          </button>

          <button
            type="button"
            onClick={() => setFilterActive(v => !v)}
            className={[
              'h-8 px-3 rounded-md border text-xs font-medium transition-colors',
              filterActive
                ? 'bg-[#2b2b2b] text-white border-[#2b2b2b]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
            ].join(' ')}
          >
            Active only
          </button>

          {(filterName || filterParent || filterActive || filterStyleId || filterLevelId || filterAccess || filterStatus || filterCityId) && (
            <button
              type="button"
              onClick={() => { setFilterName(''); setFilterParent(false); setFilterActive(false); setFilterStyleId(''); setFilterLevelId(''); setFilterAccess(''); setFilterStatus(''); setFilterCityId(''); }}
              className="h-8 px-3 rounded-md border text-xs text-red-500 border-red-200 hover:bg-red-50"
            >
              Clear
            </button>
          )}
        </div>

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
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">No events match the current filters.</TableCell>
                </TableRow>
              )}
              {filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {event.effective_image && (
                        <img src={event.effective_image} alt="" className="size-8 rounded object-cover shrink-0" />
                      )}
                      {event.name}
                      {event.events.length > 0 && (
                        <Badge variant="outline" className="text-xs">{event.events.length} children</Badge>
                      )}
                    </div>
                  </TableCell>
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
  const { create, update, uploadImage } = useEvents(accessToken);

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.effective_image ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const artistItems = artists.map(a => ({ id: a.id, name: a.full_name }));
  const isEdit = !!initialData;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(initialData?.effective_image ?? null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
        if (imageFile) await uploadImage(initialData.id, imageFile);
      } else {
        const newId = await create(payload);
        if (imageFile) await uploadImage(newId, imageFile);
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

        <div className="col-span-2 space-y-2">
          <Label>Event Image</Label>
          {imagePreview ? (
            <div className="relative w-full h-40 rounded-md overflow-hidden border border-gray-200 group">
              <img src={imagePreview} alt="Event" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 rounded-md border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
            >
              <Upload className="size-5" />
              <span className="text-sm">Click to upload an image</span>
            </button>
          )}
          {imagePreview && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Change image
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
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