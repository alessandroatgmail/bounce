import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'it' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  it: {
    // Header
    'nav.home': 'Home',
    'nav.events': 'Eventi',
    'nav.admin': 'Admin',
    'nav.dashboard': 'Dashboard',
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'nav.myAccount': 'Il Mio Account',
    'nav.settings': 'Impostazioni',
    'nav.adminPanel': 'Pannello Admin',
    
    // Footer
    'footer.about': 'Chi Siamo',
    'footer.contact': 'Contatti',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Termini di Servizio',
    'footer.rights': 'Tutti i diritti riservati.',
    
    // Home Page
    'home.hero.title': 'Benvenuto a Bounce Swing Lovers',
    'home.hero.subtitle': 'Scopri la magia del ballo swing con noi',
    'home.hero.description': 'Unisciti alla nostra community di appassionati di swing dance. Offriamo lezioni per tutti i livelli, dai principianti agli avanzati.',
    'home.hero.cta': 'Vedi Eventi',
    'home.features.title': 'Perché Scegliere Noi',
    'home.features.expert.title': 'Istruttori Esperti',
    'home.features.expert.description': 'Impara dai migliori insegnanti di swing con anni di esperienza',
    'home.features.community.title': 'Community Vibrante',
    'home.features.community.description': 'Unisciti a una community accogliente di ballerini appassionati',
    'home.features.events.title': 'Eventi Regolari',
    'home.features.events.description': 'Partecipa a lezioni settimanali, workshop e serate social',
    'home.upcoming.title': 'Prossimi Eventi',
    'home.upcoming.viewAll': 'Vedi Tutti gli Eventi',
    'home.upcoming.noEvents': 'Nessun evento in programma al momento.',
    
    // Events Page
    'events.title': 'Eventi e Lezioni',
    'events.subtitle': 'Scopri i nostri corsi e workshop',
    'events.filter.all': 'Tutti',
    'events.filter.class': 'Lezioni',
    'events.filter.workshop': 'Workshop',
    'events.filter.social': 'Social',
    'events.calendar': 'Calendario',
    'events.list': 'Lista',
    'events.noEvents': 'Nessun evento trovato.',
    'events.bookNow': 'Prenota Ora',
    'events.fullyBooked': 'Al Completo',
    'events.spots': 'posti disponibili',
    'events.spot': 'posto disponibile',
    
    // Login Page
    'login.title': 'Accedi al tuo Account',
    'login.subtitle': 'Benvenuto! Inserisci le tue credenziali',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Accedi',
    'login.noAccount': 'Non hai un account?',
    'login.register': 'Registrati qui',
    'login.termsPrefix': 'Cliccando su "Accedi" o "Registrati qui" accetti i nostri',
    'login.termsLink': 'Termini e Condizioni e la Cookie Policy',
    'login.acsiNotice': 'Messaggio riservato ai soci ACSI',
    
    // Admin Dashboard
    'admin.title': 'Pannello Amministratore',
    'admin.welcome': 'Benvenuto',
    'admin.tabs.overview': 'Panoramica',
    'admin.tabs.events': 'Gestione Eventi',
    'admin.tabs.users': 'Gestione Utenti',
    'admin.overview.stats': 'Statistiche',
    'admin.overview.totalEvents': 'Eventi Totali',
    'admin.overview.totalStudents': 'Studenti Totali',
    'admin.overview.revenue': 'Entrate Totali',
    'admin.overview.upcomingEvents': 'Prossimi Eventi',
    'admin.events.title': 'Gestione Eventi',
    'admin.events.add': 'Aggiungi Evento',
    'admin.events.search': 'Cerca eventi...',
    'admin.events.name': 'Nome',
    'admin.events.type': 'Tipo',
    'admin.events.date': 'Data',
    'admin.events.attendees': 'Partecipanti',
    'admin.events.actions': 'Azioni',
    'admin.events.edit': 'Modifica',
    'admin.events.delete': 'Elimina',
    'admin.users.title': 'Gestione Utenti',
    'admin.users.search': 'Cerca utenti...',
    'admin.users.name': 'Nome',
    'admin.users.email': 'Email',
    'admin.users.role': 'Ruolo',
    'admin.users.joined': 'Iscritto il',
    'admin.users.actions': 'Azioni',
    'admin.users.edit': 'Modifica',
    'admin.users.delete': 'Elimina',
    
    // Student Dashboard
    'student.title': 'Dashboard Studente',
    'student.welcome': 'Benvenuto',
    'student.tabs.overview': 'Panoramica',
    'student.tabs.bookings': 'Le Mie Prenotazioni',
    'student.tabs.payments': 'Pagamenti',
    'student.tabs.settings': 'Impostazioni',
    'student.overview.stats': 'Il Mio Profilo',
    'student.overview.totalBookings': 'Prenotazioni Totali',
    'student.overview.completedClasses': 'Lezioni Completate',
    'student.overview.upcomingClasses': 'Prossime Lezioni',
    'student.overview.memberSince': 'Membro dal',
    'student.bookings.title': 'Le Mie Prenotazioni',
    'student.bookings.upcoming': 'Prossime',
    'student.bookings.past': 'Passate',
    'student.bookings.cancelled': 'Cancellate',
    'student.bookings.noBookings': 'Nessuna prenotazione trovata.',
    'student.bookings.cancel': 'Annulla',
    'student.payments.title': 'Storico Pagamenti',
    'student.payments.date': 'Data',
    'student.payments.description': 'Descrizione',
    'student.payments.amount': 'Importo',
    'student.payments.status': 'Stato',
    'student.payments.completed': 'Completato',
    'student.payments.pending': 'In Attesa',
    'student.payments.failed': 'Fallito',
    'student.payments.noPayments': 'Nessun pagamento trovato.',
    'student.settings.title': 'Impostazioni Account',
    'student.settings.profile': 'Informazioni Profilo',
    'student.settings.name': 'Nome',
    'student.settings.email': 'Email',
    'student.settings.phone': 'Telefono',
    'student.settings.preferences': 'Preferenze',
    'student.settings.language': 'Lingua',
    'student.settings.notifications': 'Notifiche Email',
    'student.settings.newsletter': 'Newsletter',
    'student.settings.saveChanges': 'Salva Modifiche',
    
    // Common
    'common.loading': 'Caricamento...',
    'common.error': 'Si è verificato un errore',
    'common.success': 'Operazione completata con successo',
    'common.cancel': 'Annulla',
    'common.confirm': 'Conferma',
    'common.save': 'Salva',
    'common.edit': 'Modifica',
    'common.delete': 'Elimina',
    'common.close': 'Chiudi',
    'common.search': 'Cerca',
    'common.filter': 'Filtra',
    'common.sort': 'Ordina',
    'common.more': 'Altro',
    'common.less': 'Meno',
    'common.viewDetails': 'Vedi Dettagli',
  },
  en: {
    // Header
    'nav.home': 'Home',
    'nav.events': 'Events',
    'nav.admin': 'Admin',
    'nav.dashboard': 'Dashboard',
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'nav.myAccount': 'My Account',
    'nav.settings': 'Settings',
    'nav.adminPanel': 'Admin Panel',
    
    // Footer
    'footer.about': 'About Us',
    'footer.contact': 'Contact',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Service',
    'footer.rights': 'All rights reserved.',
    
    // Home Page
    'home.hero.title': 'Welcome to Bounce Swing Lovers',
    'home.hero.subtitle': 'Discover the magic of swing dance with us',
    'home.hero.description': 'Join our community of swing dance enthusiasts. We offer classes for all levels, from beginners to advanced.',
    'home.hero.cta': 'View Events',
    'home.features.title': 'Why Choose Us',
    'home.features.expert.title': 'Expert Instructors',
    'home.features.expert.description': 'Learn from the best swing teachers with years of experience',
    'home.features.community.title': 'Vibrant Community',
    'home.features.community.description': 'Join a welcoming community of passionate dancers',
    'home.features.events.title': 'Regular Events',
    'home.features.events.description': 'Attend weekly classes, workshops, and social dance nights',
    'home.upcoming.title': 'Upcoming Events',
    'home.upcoming.viewAll': 'View All Events',
    'home.upcoming.noEvents': 'No upcoming events at the moment.',
    
    // Events Page
    'events.title': 'Events & Classes',
    'events.subtitle': 'Discover our courses and workshops',
    'events.filter.all': 'All',
    'events.filter.class': 'Classes',
    'events.filter.workshop': 'Workshops',
    'events.filter.social': 'Social',
    'events.calendar': 'Calendar',
    'events.list': 'List',
    'events.noEvents': 'No events found.',
    'events.bookNow': 'Book Now',
    'events.fullyBooked': 'Fully Booked',
    'events.spots': 'spots available',
    'events.spot': 'spot available',
    
    // Login Page
    'login.title': 'Login to Your Account',
    'login.subtitle': 'Welcome back! Please enter your credentials',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Sign In',
    'login.noAccount': 'Don\'t have an account?',
    'login.register': 'Register here',
    'login.termsPrefix': 'By clicking "Sign In" or "Register here" you accept our',
    'login.termsLink': 'Terms and Conditions and Cookie Policy',
    'login.acsiNotice': 'Message reserved for ACSI members',
    
    // Admin Dashboard
    'admin.title': 'Administrator Panel',
    'admin.welcome': 'Welcome',
    'admin.tabs.overview': 'Overview',
    'admin.tabs.events': 'Event Management',
    'admin.tabs.users': 'User Management',
    'admin.overview.stats': 'Statistics',
    'admin.overview.totalEvents': 'Total Events',
    'admin.overview.totalStudents': 'Total Students',
    'admin.overview.revenue': 'Total Revenue',
    'admin.overview.upcomingEvents': 'Upcoming Events',
    'admin.events.title': 'Event Management',
    'admin.events.add': 'Add Event',
    'admin.events.search': 'Search events...',
    'admin.events.name': 'Name',
    'admin.events.type': 'Type',
    'admin.events.date': 'Date',
    'admin.events.attendees': 'Attendees',
    'admin.events.actions': 'Actions',
    'admin.events.edit': 'Edit',
    'admin.events.delete': 'Delete',
    'admin.users.title': 'User Management',
    'admin.users.search': 'Search users...',
    'admin.users.name': 'Name',
    'admin.users.email': 'Email',
    'admin.users.role': 'Role',
    'admin.users.joined': 'Joined',
    'admin.users.actions': 'Actions',
    'admin.users.edit': 'Edit',
    'admin.users.delete': 'Delete',
    
    // Student Dashboard
    'student.title': 'Student Dashboard',
    'student.welcome': 'Welcome',
    'student.tabs.overview': 'Overview',
    'student.tabs.bookings': 'My Bookings',
    'student.tabs.payments': 'Payments',
    'student.tabs.settings': 'Settings',
    'student.overview.stats': 'My Profile',
    'student.overview.totalBookings': 'Total Bookings',
    'student.overview.completedClasses': 'Completed Classes',
    'student.overview.upcomingClasses': 'Upcoming Classes',
    'student.overview.memberSince': 'Member Since',
    'student.bookings.title': 'My Bookings',
    'student.bookings.upcoming': 'Upcoming',
    'student.bookings.past': 'Past',
    'student.bookings.cancelled': 'Cancelled',
    'student.bookings.noBookings': 'No bookings found.',
    'student.bookings.cancel': 'Cancel',
    'student.payments.title': 'Payment History',
    'student.payments.date': 'Date',
    'student.payments.description': 'Description',
    'student.payments.amount': 'Amount',
    'student.payments.status': 'Status',
    'student.payments.completed': 'Completed',
    'student.payments.pending': 'Pending',
    'student.payments.failed': 'Failed',
    'student.payments.noPayments': 'No payments found.',
    'student.settings.title': 'Account Settings',
    'student.settings.profile': 'Profile Information',
    'student.settings.name': 'Name',
    'student.settings.email': 'Email',
    'student.settings.phone': 'Phone',
    'student.settings.preferences': 'Preferences',
    'student.settings.language': 'Language',
    'student.settings.notifications': 'Email Notifications',
    'student.settings.newsletter': 'Newsletter',
    'student.settings.saveChanges': 'Save Changes',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.success': 'Operation completed successfully',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.sort': 'Sort',
    'common.more': 'More',
    'common.less': 'Less',
    'common.viewDetails': 'View Details',
  }
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    return (saved === 'it' || saved === 'en') ? saved : 'it';
  });

  useEffect(() => {
    localStorage.setItem('app-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['it']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}