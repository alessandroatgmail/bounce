export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'student';
  surname?: string;
  address?: {
    street: string;
    postcode: string;
    city: string;
    country: string;
  };
  placeOfBirth?: string;
  dateOfBirth?: string;
  fiscalCode?: string;
  acsiNumber?: string;
  isAcsiMember?: boolean;
  acsiMembershipRequested?: boolean;
  termsAccepted?: boolean;
  marketingConsent?: boolean;
  registrationDate?: string;
}

export interface Document {
  id: string;
  userId: string;
  type: 'membership_request' | 'health_certificate';
  fileName: string;
  uploadDate: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

export interface Membership {
  id: string;
  name: string;
  color: string;
  stylesIncluded: number; // 0 for basic, 1-5 for style memberships
  priceMonthly: number;
  priceTotal: number;
  validFrom?: string;
  validTo?: string;
  timeframe: string; // e.g., "Mensile", "Trimestrale", "Annuale"
  type: 'weekly' | 'workshops' | 'basic';
  description: string;
}

export interface UserMembership {
  id: string;
  userId: string;
  membershipId: string;
  purchaseDate: string;
  validFrom: string;
  validTo: string;
  status: 'active' | 'expired' | 'pending';
  associatedCourses: string[]; // Event IDs
  paymentId?: string;
}

export interface DanceEvent {
  id: string;
  title: string;
  type: 'class' | 'workshop' | 'social' | 'performance';
  instructor: string;
  date: string;
  time: string;
  duration: number; // in minutes
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  price: number;
  maxCapacity: number;
  currentEnrollment: number;
  description: string;
  imageUrl?: string;
  location?: string;
  regularClassId?: string; // Links to a RegularClass if this is a recurring instance
}

export interface RegularClass {
  id: string;
  title: string;
  type: 'class';
  instructor: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
  time: string;
  duration: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  price: number;
  maxCapacity: number;
  location: string;
  description: string;
  frequency: 'weekly' | 'fortnightly' | 'monthly';
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  regularClassId: string;
  type: 'monthly' | '4-month';
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled';
  price: number;
  paymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  bookingDate: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  amount: number;
  subscriptionId?: string; // If booked via subscription, reference it
}

export interface Payment {
  id: string;
  userId: string;
  bookingId?: string;
  subscriptionId?: string;
  amount: number;
  date: string;
  method: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
  status: 'completed' | 'pending' | 'refunded';
  description: string;
}

export interface Festival {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  rooms: string[]; // Array of room names/IDs
  location: string;
  imageUrl?: string;
  status: 'draft' | 'published' | 'cancelled';
}

export interface FestivalEvent {
  id: string;
  festivalId: string;
  title: string;
  type: 'workshop' | 'party' | 'social' | 'performance';
  instructor?: string;
  dj?: string;
  dayIndex: number; // 0-based day index within the festival
  room: string;
  startTime: string; // HH:mm format
  duration: number; // in minutes
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  price: number;
  maxCapacity: number;
  currentEnrollment: number;
  description: string;
  style?: string; // e.g., "Lindy Hop", "Balboa", etc.
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  likes: string[]; // Array of user IDs who liked
  comments: Comment[];
  images?: string[];
}

export interface Comment {
  id: string;
  userId: string;
  postId: string;
  content: string;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface Connection {
  userId: string;
  connectedUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'friend_request' | 'friend_accept' | 'event_reminder' | 'message';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedId?: string; // ID of the related post, user, event, etc.
}

export interface Trip {
  id: string;
  eventId: string;
  eventName: string;
  eventLocation: string;
  eventDate: string;
  createdBy: string;
  carSharing: CarShare[];
  hotelSharing: HotelShare[];
  participants: string[]; // User IDs interested in the trip
}

export interface CarShare {
  id: string;
  tripId: string;
  driverId: string;
  departureLocation: string;
  departureTime: string;
  availableSeats: number;
  passengers: string[]; // User IDs
  notes?: string;
}

export interface HotelShare {
  id: string;
  tripId: string;
  organizerId: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  totalCost: number;
  maxPeople: number;
  currentPeople: string[]; // User IDs
  notes?: string;
}

// Regular class templates
export const mockRegularClasses: RegularClass[] = [
  {
    id: 'rc1',
    title: 'Lindy Hop Intermediate - Tuesday',
    type: 'class',
    instructor: 'Sarah Martinez',
    dayOfWeek: 2, // Tuesday
    time: '20:00',
    duration: 90,
    level: 'Intermediate',
    price: 15,
    maxCapacity: 20,
    location: 'Studio A - Via della Danza 123, Roma',
    description: 'Regular intermediate Lindy Hop class every Tuesday evening.',
    frequency: 'weekly',
    startDate: '2026-04-01',
    endDate: '2026-07-31',
    isActive: true,
  },
  {
    id: 'rc2',
    title: 'Swing Fundamentals - Monday',
    type: 'class',
    instructor: 'Mike Thompson',
    dayOfWeek: 1, // Monday
    time: '19:00',
    duration: 90,
    level: 'Beginner',
    price: 12,
    maxCapacity: 25,
    location: 'Studio B - Via della Danza 123, Roma',
    description: 'Weekly beginner swing class for newcomers.',
    frequency: 'weekly',
    startDate: '2026-04-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    id: 'rc3',
    title: 'Charleston Advanced - Thursday',
    type: 'class',
    instructor: 'Emily Chen',
    dayOfWeek: 4, // Thursday
    time: '20:30',
    duration: 90,
    level: 'Advanced',
    price: 18,
    maxCapacity: 16,
    location: 'Studio A - Via della Danza 123, Roma',
    description: 'Advanced Charleston technique and styling.',
    frequency: 'weekly',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    isActive: true,
  },
];

// Generate event instances from regular classes
function generateEventsFromRegularClass(regularClass: RegularClass): DanceEvent[] {
  const events: DanceEvent[] = [];
  const startDate = new Date(regularClass.startDate);
  const endDate = new Date(regularClass.endDate);
  
  // Find the first occurrence of the day of week
  let currentDate = new Date(startDate);
  while (currentDate.getDay() !== regularClass.dayOfWeek) {
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  let eventCounter = 0;
  while (currentDate <= endDate) {
    events.push({
      id: `${regularClass.id}-${eventCounter}`,
      title: regularClass.title,
      type: regularClass.type,
      instructor: regularClass.instructor,
      date: currentDate.toISOString().split('T')[0],
      time: regularClass.time,
      duration: regularClass.duration,
      level: regularClass.level,
      price: regularClass.price,
      maxCapacity: regularClass.maxCapacity,
      currentEnrollment: Math.floor(Math.random() * regularClass.maxCapacity * 0.7),
      description: regularClass.description,
      location: regularClass.location,
      regularClassId: regularClass.id,
    });
    
    // Move to next occurrence based on frequency
    if (regularClass.frequency === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (regularClass.frequency === 'fortnightly') {
      currentDate.setDate(currentDate.getDate() + 14);
    } else if (regularClass.frequency === 'monthly') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    eventCounter++;
  }
  
  return events;
}

// Generate events from all regular classes
const generatedEvents = mockRegularClasses
  .filter(rc => rc.isActive)
  .flatMap(rc => generateEventsFromRegularClass(rc));

export const mockEvents: DanceEvent[] = [
  {
    id: '1',
    title: 'Swing Dancing Fundamentals',
    type: 'class',
    instructor: 'Mike Thompson',
    date: '2026-04-10',
    time: '18:00',
    duration: 90,
    level: 'Beginner',
    price: 25,
    maxCapacity: 20,
    currentEnrollment: 15,
    description: 'Learn the basics of swing dancing including the basic step, rhythm, and partner connection.',
  },
  {
    id: '2',
    title: 'Lindy Hop Intermediate',
    type: 'class',
    instructor: 'Sarah Martinez',
    date: '2026-04-11',
    time: '19:00',
    duration: 90,
    level: 'Intermediate',
    price: 30,
    maxCapacity: 16,
    currentEnrollment: 12,
    description: 'Take your Lindy Hop skills to the next level with advanced moves and styling.',
  },
  {
    id: '3',
    title: 'Friday Night Social Dance',
    type: 'social',
    instructor: 'DJ Smith',
    date: '2026-04-11',
    time: '20:30',
    duration: 180,
    level: 'All Levels',
    price: 15,
    maxCapacity: 50,
    currentEnrollment: 35,
    description: 'Join us for a fun evening of social dancing! All levels welcome.',
  },
  {
    id: '4',
    title: 'Charleston Workshop',
    type: 'workshop',
    instructor: 'Emily Chen',
    date: '2026-04-12',
    time: '14:00',
    duration: 120,
    level: 'All Levels',
    price: 35,
    maxCapacity: 24,
    currentEnrollment: 18,
    description: 'Explore the energetic and playful Charleston dance with variations and styling.',
  },
  {
    id: '5',
    title: 'Blues Dancing Basics',
    type: 'class',
    instructor: 'Marcus Johnson',
    date: '2026-04-13',
    time: '17:00',
    duration: 90,
    level: 'Beginner',
    price: 25,
    maxCapacity: 20,
    currentEnrollment: 10,
    description: 'Introduction to blues dancing with focus on connection and musicality.',
  },
  {
    id: '6',
    title: 'Advanced Aerials Workshop',
    type: 'workshop',
    instructor: 'Jake Williams',
    date: '2026-04-14',
    time: '15:00',
    duration: 150,
    level: 'Advanced',
    price: 45,
    maxCapacity: 12,
    currentEnrollment: 8,
    description: 'Learn and practice advanced aerial moves safely with spotting techniques.',
  },
  {
    id: '7',
    title: 'Balboa Essentials',
    type: 'class',
    instructor: 'Lisa Rodriguez',
    date: '2026-04-15',
    time: '18:30',
    duration: 90,
    level: 'Intermediate',
    price: 28,
    maxCapacity: 16,
    currentEnrollment: 14,
    description: 'Master the essentials of Balboa dancing for crowded dance floors.',
  },
  {
    id: '8',
    title: 'Spring Showcase Performance',
    type: 'performance',
    instructor: 'Dance School Team',
    date: '2026-04-20',
    time: '19:00',
    duration: 120,
    level: 'All Levels',
    price: 20,
    maxCapacity: 100,
    currentEnrollment: 65,
    description: 'Watch our talented students perform their best routines! Tickets include refreshments.',
  },
  {
    id: '9',
    title: 'Swing Out Mastery',
    type: 'class',
    instructor: 'Mike Thompson',
    date: '2026-04-17',
    time: '18:00',
    duration: 90,
    level: 'Intermediate',
    price: 30,
    maxCapacity: 20,
    currentEnrollment: 16,
    description: 'Perfect your swing out technique and add variations to your dancing.',
  },
  {
    id: '10',
    title: 'Sunday Social Practice',
    type: 'social',
    instructor: 'Open Floor',
    date: '2026-04-13',
    time: '16:00',
    duration: 120,
    level: 'All Levels',
    price: 10,
    maxCapacity: 40,
    currentEnrollment: 25,
    description: 'Casual social dancing and practice session. Great for beginners!',
  },
  ...generatedEvents,
];

export const mockBookings: Booking[] = [
  {
    id: 'b1',
    userId: '2',
    eventId: '1',
    bookingDate: '2026-03-15',
    status: 'confirmed',
    amount: 25,
  },
  {
    id: 'b2',
    userId: '2',
    eventId: '3',
    bookingDate: '2026-03-20',
    status: 'confirmed',
    amount: 15,
  },
  {
    id: 'b3',
    userId: '2',
    eventId: '4',
    bookingDate: '2026-03-22',
    status: 'confirmed',
    amount: 35,
  },
];

export const mockPayments: Payment[] = [
  {
    id: 'p1',
    userId: '2',
    bookingId: 'b1',
    amount: 25,
    date: '2026-03-15',
    method: 'credit_card',
    status: 'completed',
    description: 'Payment for Swing Dancing Fundamentals class.',
  },
  {
    id: 'p2',
    userId: '2',
    bookingId: 'b2',
    amount: 15,
    date: '2026-03-20',
    method: 'credit_card',
    status: 'completed',
    description: 'Payment for Friday Night Social Dance.',
  },
  {
    id: 'p3',
    userId: '2',
    bookingId: 'b3',
    amount: 35,
    date: '2026-03-22',
    method: 'paypal',
    status: 'completed',
    description: 'Payment for Charleston Workshop.',
  },
];

export const mockStudents = [
  { 
    id: '2', 
    name: 'Sarah Johnson', 
    email: 'student@example.com', 
    phone: '+1 234 567 8901', 
    joinedDate: '2025-02-15', 
    activeClasses: 3,
    surname: 'Johnson',
    address: {
      street: 'Via Roma 123',
      postcode: '00100',
      city: 'Roma',
      country: 'Italia'
    },
    placeOfBirth: 'Milano',
    dateOfBirth: '1995-06-15',
    fiscalCode: 'JHNSRH95H55F205X',
    acsiNumber: 'ACSI123456',
    isAcsiMember: true,
    termsAccepted: true,
    marketingConsent: true,
    registrationDate: '2025-02-15'
  },
  { 
    id: '3', 
    name: 'John Davis', 
    email: 'john.davis@example.com', 
    phone: '+1 234 567 8902', 
    joinedDate: '2025-03-10', 
    activeClasses: 2,
    surname: 'Davis',
    address: {
      street: 'Corso Vittorio Emanuele 45',
      postcode: '00186',
      city: 'Roma',
      country: 'Italia'
    },
    placeOfBirth: 'Napoli',
    dateOfBirth: '1992-03-22',
    fiscalCode: 'DVSJHN92C22F839K',
    isAcsiMember: false,
    acsiMembershipRequested: true,
    termsAccepted: true,
    marketingConsent: false,
    registrationDate: '2025-03-10'
  },
  { 
    id: '4', 
    name: 'Emily Brown', 
    email: 'emily.brown@example.com', 
    phone: '+1 234 567 8903', 
    joinedDate: '2025-01-20', 
    activeClasses: 5,
    surname: 'Brown',
    address: {
      street: 'Via Nazionale 88',
      postcode: '00184',
      city: 'Roma',
      country: 'Italia'
    },
    placeOfBirth: 'Roma',
    dateOfBirth: '1998-11-30',
    fiscalCode: 'BRWMLY98S70H501T',
    acsiNumber: 'ACSI789012',
    isAcsiMember: true,
    termsAccepted: true,
    marketingConsent: true,
    registrationDate: '2025-01-20'
  },
  { 
    id: '5', 
    name: 'Michael Lee', 
    email: 'michael.lee@example.com', 
    phone: '+1 234 567 8904', 
    joinedDate: '2025-04-01', 
    activeClasses: 1,
    surname: 'Lee',
    address: {
      street: 'Piazza Navona 12',
      postcode: '00186',
      city: 'Roma',
      country: 'Italia'
    },
    placeOfBirth: 'Firenze',
    dateOfBirth: '1990-08-10',
    fiscalCode: 'LEMCHL90M10D612P',
    isAcsiMember: false,
    acsiMembershipRequested: false,
    termsAccepted: true,
    marketingConsent: true,
    registrationDate: '2025-04-01'
  },
  { 
    id: '6', 
    name: 'Jessica White', 
    email: 'jessica.white@example.com', 
    phone: '+1 234 567 8905', 
    joinedDate: '2024-12-15', 
    activeClasses: 4,
    surname: 'White',
    address: {
      street: 'Via del Tritone 99',
      postcode: '00187',
      city: 'Roma',
      country: 'Italia'
    },
    placeOfBirth: 'Torino',
    dateOfBirth: '1994-02-28',
    fiscalCode: 'WHTJSC94B68L219M',
    acsiNumber: 'ACSI345678',
    isAcsiMember: true,
    termsAccepted: true,
    marketingConsent: false,
    registrationDate: '2024-12-15'
  },
];

export const mockSubscriptions: Subscription[] = [
  {
    id: 'sub1',
    userId: '2',
    regularClassId: 'rc1',
    type: 'monthly',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    status: 'active',
    price: 50,
    paymentMethod: 'credit_card',
  },
  {
    id: 'sub2',
    userId: '2',
    regularClassId: 'rc2',
    type: '4-month',
    startDate: '2026-04-01',
    endDate: '2026-07-31',
    status: 'active',
    price: 180,
    paymentMethod: 'bank_transfer',
  },
  {
    id: 'sub3',
    userId: '3',
    regularClassId: 'rc1',
    type: 'monthly',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    status: 'active',
    price: 50,
    paymentMethod: 'paypal',
  },
];

export const mockFestivals: Festival[] = [
  {
    id: 'fest1',
    title: 'Rome Swing Festival 2026',
    description: 'Three days of intensive workshops with world-class instructors and amazing parties every night!',
    startDate: '2026-06-12',
    endDate: '2026-06-14',
    numberOfDays: 3,
    rooms: ['Ballroom A', 'Ballroom B', 'Studio 1', 'Studio 2'],
    location: 'Grand Hotel Roma - Via del Corso 126, Roma',
    status: 'published',
  },
  {
    id: 'fest2',
    title: 'Summer Lindy Exchange',
    description: 'Weekend of social dancing and workshops in the heart of Rome.',
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    numberOfDays: 3,
    rooms: ['Main Hall', 'Studio A', 'Studio B'],
    location: 'Centro Danza Roma - Piazza Venezia 45, Roma',
    status: 'draft',
  },
];

export const mockFestivalEvents: FestivalEvent[] = [
  // Day 1 - Rome Swing Festival
  {
    id: 'fe1',
    festivalId: 'fest1',
    title: 'Lindy Hop Fundamentals',
    type: 'workshop',
    instructor: 'Mike Thompson & Sarah Martinez',
    dayIndex: 0,
    room: 'Ballroom A',
    startTime: '10:00',
    duration: 90,
    level: 'Beginner',
    price: 35,
    maxCapacity: 40,
    currentEnrollment: 32,
    description: 'Perfect your basic Lindy Hop technique.',
    style: 'Lindy Hop',
  },
  {
    id: 'fe2',
    festivalId: 'fest1',
    title: 'Charleston Variations',
    type: 'workshop',
    instructor: 'Emily Chen',
    dayIndex: 0,
    room: 'Ballroom B',
    startTime: '10:00',
    duration: 90,
    level: 'Intermediate',
    price: 35,
    maxCapacity: 30,
    currentEnrollment: 28,
    description: 'Explore creative Charleston variations.',
    style: 'Charleston',
  },
  {
    id: 'fe3',
    festivalId: 'fest1',
    title: 'Balboa Technique',
    type: 'workshop',
    instructor: 'Lisa Rodriguez',
    dayIndex: 0,
    room: 'Studio 1',
    startTime: '12:00',
    duration: 90,
    level: 'All Levels',
    price: 35,
    maxCapacity: 25,
    currentEnrollment: 20,
    description: 'Master Balboa footwork and connection.',
    style: 'Balboa',
  },
  {
    id: 'fe4',
    festivalId: 'fest1',
    title: 'Evening Social Dance',
    type: 'party',
    dj: 'DJ Swing Master',
    dayIndex: 0,
    room: 'Ballroom A',
    startTime: '21:00',
    duration: 240,
    level: 'All Levels',
    price: 20,
    maxCapacity: 150,
    currentEnrollment: 95,
    description: 'Dance the night away with live band and DJ!',
  },
  // Day 2 - Rome Swing Festival
  {
    id: 'fe5',
    festivalId: 'fest1',
    title: 'Advanced Aerials',
    type: 'workshop',
    instructor: 'Jake Williams',
    dayIndex: 1,
    room: 'Ballroom A',
    startTime: '10:00',
    duration: 120,
    level: 'Advanced',
    price: 45,
    maxCapacity: 20,
    currentEnrollment: 18,
    description: 'Learn advanced aerial techniques safely.',
    style: 'Lindy Hop',
  },
  {
    id: 'fe6',
    festivalId: 'fest1',
    title: 'Styling & Musicality',
    type: 'workshop',
    instructor: 'Sarah Martinez',
    dayIndex: 1,
    room: 'Ballroom B',
    startTime: '10:00',
    duration: 90,
    level: 'Intermediate',
    price: 35,
    maxCapacity: 35,
    currentEnrollment: 30,
    description: 'Enhance your dancing with style and musicality.',
    style: 'Lindy Hop',
  },
  {
    id: 'fe7',
    festivalId: 'fest1',
    title: 'Midnight Party',
    type: 'party',
    dj: 'DJ Rhythm & Blues',
    dayIndex: 1,
    room: 'Ballroom A',
    startTime: '22:00',
    duration: 300,
    level: 'All Levels',
    price: 25,
    maxCapacity: 150,
    currentEnrollment: 120,
    description: 'Dance until dawn with the best DJs!',
  },
];

export const mockPosts: Post[] = [
  {
    id: 'post1',
    userId: '3',
    content: 'Had an amazing time at the Friday Night Social Dance! The energy was incredible. Can\'t wait for the next one! 💃🕺',
    createdAt: '2026-04-12T08:30:00Z',
    likes: ['2', '4', '5'],
    comments: [
      {
        id: 'c1',
        userId: '2',
        postId: 'post1',
        content: 'It was great dancing with you! See you next week!',
        createdAt: '2026-04-12T09:15:00Z',
      },
      {
        id: 'c2',
        userId: '5',
        postId: 'post1',
        content: 'Totally agree! Best social of the month!',
        createdAt: '2026-04-12T10:00:00Z',
      },
    ],
  },
  {
    id: 'post2',
    userId: '4',
    content: 'Looking for a dance partner for the upcoming Charleston Workshop on Sunday. Anyone interested? I\'m intermediate level. 🎵',
    createdAt: '2026-04-11T14:20:00Z',
    likes: ['2', '3'],
    comments: [
      {
        id: 'c3',
        userId: '6',
        postId: 'post2',
        content: 'I might be interested! What time does it start?',
        createdAt: '2026-04-11T15:00:00Z',
      },
      {
        id: 'c4',
        userId: '4',
        postId: 'post2',
        content: 'It starts at 2 PM! Let me know if you want to partner up.',
        createdAt: '2026-04-11T15:30:00Z',
      },
    ],
  },
  {
    id: 'post3',
    userId: '6',
    content: 'Just finished the Lindy Hop Intermediate class with Sarah. Her teaching style is amazing! Learning so much every week. Thanks Sarah! 🙏',
    createdAt: '2026-04-11T21:00:00Z',
    likes: ['2', '3', '4', '5'],
    comments: [
      {
        id: 'c5',
        userId: '2',
        postId: 'post3',
        content: 'Sarah is the best! I\'ve been taking her classes for months.',
        createdAt: '2026-04-11T21:30:00Z',
      },
    ],
  },
  {
    id: 'post4',
    userId: '5',
    content: 'Does anyone have recommendations for good swing music playlists? Trying to practice at home! 🎶',
    createdAt: '2026-04-10T16:45:00Z',
    likes: ['3', '4'],
    comments: [
      {
        id: 'c6',
        userId: '3',
        postId: 'post4',
        content: 'Check out "Swing Essentials" on Spotify - it\'s my go-to!',
        createdAt: '2026-04-10T17:00:00Z',
      },
      {
        id: 'c7',
        userId: '6',
        postId: 'post4',
        content: 'I have a playlist I can share! DM me.',
        createdAt: '2026-04-10T18:00:00Z',
      },
    ],
  },
  {
    id: 'post5',
    userId: '2',
    content: 'Excited to announce I just signed up for the Rome Swing Festival in June! Who else is going? Let\'s organize a group! 🎉',
    createdAt: '2026-04-09T12:00:00Z',
    likes: ['3', '4', '5', '6'],
    comments: [
      {
        id: 'c8',
        userId: '4',
        postId: 'post5',
        content: 'I\'m going! We should definitely meet up there!',
        createdAt: '2026-04-09T13:00:00Z',
      },
      {
        id: 'c9',
        userId: '3',
        postId: 'post5',
        content: 'Count me in! Already booked my hotel.',
        createdAt: '2026-04-09T14:30:00Z',
      },
    ],
  },
];

export const mockDirectMessages: DirectMessage[] = [
  {
    id: 'dm1',
    senderId: '3',
    receiverId: '2',
    content: 'Hey! Would you like to practice together before the Charleston workshop?',
    createdAt: '2026-04-11T10:00:00Z',
    read: true,
  },
  {
    id: 'dm2',
    senderId: '2',
    receiverId: '3',
    content: 'Sure! That sounds great. How about Saturday afternoon?',
    createdAt: '2026-04-11T10:30:00Z',
    read: true,
  },
  {
    id: 'dm3',
    senderId: '3',
    receiverId: '2',
    content: 'Perfect! Let\'s meet at the studio around 3 PM?',
    createdAt: '2026-04-11T11:00:00Z',
    read: true,
  },
  {
    id: 'dm4',
    senderId: '4',
    receiverId: '2',
    content: 'Hi Sarah! I noticed you\'re going to the Rome Festival. Do you want to share a ride?',
    createdAt: '2026-04-09T15:00:00Z',
    read: false,
  },
  {
    id: 'dm5',
    senderId: '6',
    receiverId: '2',
    content: 'Thanks for the dance last night! You\'re a great lead!',
    createdAt: '2026-04-12T09:00:00Z',
    read: false,
  },
  {
    id: 'dm6',
    senderId: '5',
    receiverId: '2',
    content: 'Hey, do you have the schedule for next month\'s classes?',
    createdAt: '2026-04-08T14:00:00Z',
    read: true,
  },
];

export const mockConnections: Connection[] = [
  {
    userId: '2',
    connectedUserId: '3',
    status: 'accepted',
    createdAt: '2026-03-15T10:00:00Z',
  },
  {
    userId: '2',
    connectedUserId: '4',
    status: 'accepted',
    createdAt: '2026-03-20T14:30:00Z',
  },
  {
    userId: '2',
    connectedUserId: '5',
    status: 'accepted',
    createdAt: '2026-04-01T11:00:00Z',
  },
  {
    userId: '2',
    connectedUserId: '6',
    status: 'accepted',
    createdAt: '2026-04-05T16:00:00Z',
  },
  {
    userId: '3',
    connectedUserId: '4',
    status: 'accepted',
    createdAt: '2026-03-18T12:00:00Z',
  },
];

export const mockNotifications: Notification[] = [
  {
    id: 'notif1',
    userId: '2',
    type: 'message',
    title: 'New Message',
    message: 'Jessica White sent you a message',
    read: false,
    createdAt: '2026-04-12T09:00:00Z',
    relatedId: 'dm5',
  },
  {
    id: 'notif2',
    userId: '2',
    type: 'message',
    title: 'New Message',
    message: 'Emily Brown sent you a message',
    read: false,
    createdAt: '2026-04-09T15:00:00Z',
    relatedId: 'dm4',
  },
  {
    id: 'notif3',
    userId: '2',
    type: 'like',
    title: 'Post Liked',
    message: 'Michael Lee liked your post about the Rome Festival',
    read: false,
    createdAt: '2026-04-09T12:30:00Z',
    relatedId: 'post5',
  },
  {
    id: 'notif4',
    userId: '2',
    type: 'comment',
    title: 'New Comment',
    message: 'Emily Brown commented on your post',
    read: true,
    createdAt: '2026-04-09T13:00:00Z',
    relatedId: 'post5',
  },
  {
    id: 'notif5',
    userId: '2',
    type: 'event_reminder',
    title: 'Class Reminder',
    message: 'Charleston Workshop starts tomorrow at 2:00 PM',
    read: true,
    createdAt: '2026-04-11T10:00:00Z',
    relatedId: '4',
  },
  {
    id: 'notif6',
    userId: '2',
    type: 'like',
    title: 'Post Liked',
    message: 'John Davis liked your post',
    read: true,
    createdAt: '2026-04-09T12:15:00Z',
    relatedId: 'post5',
  },
];

export const mockTrips: Trip[] = [
  {
    id: 'trip1',
    eventId: 'fest1',
    eventName: 'Rome Swing Festival 2026',
    eventLocation: 'Grand Hotel Roma - Via del Corso 126, Roma',
    eventDate: '2026-06-12',
    createdBy: '2',
    carSharing: [
      {
        id: 'car1',
        tripId: 'trip1',
        driverId: '2',
        departureLocation: 'Milano Centro',
        departureTime: '2026-06-12T08:00:00Z',
        availableSeats: 3,
        passengers: ['3', '4'],
        notes: 'Leaving from Piazza Duomo. Happy to split gas costs!',
      },
      {
        id: 'car2',
        tripId: 'trip1',
        driverId: '5',
        departureLocation: 'Firenze',
        departureTime: '2026-06-12T10:00:00Z',
        availableSeats: 2,
        passengers: [],
        notes: 'Driving from Florence, can pick up along the way.',
      },
    ],
    hotelSharing: [
      {
        id: 'hotel1',
        tripId: 'trip1',
        organizerId: '2',
        hotelName: 'Hotel Colosseo',
        checkIn: '2026-06-12',
        checkOut: '2026-06-15',
        roomType: 'Quadrupla (4 beds)',
        totalCost: 480,
        maxPeople: 4,
        currentPeople: ['2', '3', '4'],
        notes: 'Room near the festival venue. €120 per person for 3 nights!',
      },
      {
        id: 'hotel2',
        tripId: 'trip1',
        organizerId: '6',
        hotelName: 'B&B Roman Holiday',
        checkIn: '2026-06-12',
        checkOut: '2026-06-15',
        roomType: 'Doppia (2 beds)',
        totalCost: 300,
        maxPeople: 2,
        currentPeople: ['6'],
        notes: 'Cozy B&B with breakfast included. Looking for 1 roommate!',
      },
    ],
    participants: ['2', '3', '4', '5', '6'],
  },
  {
    id: 'trip2',
    eventId: 'fest2',
    eventName: 'Summer Lindy Exchange',
    eventLocation: 'Centro Danza Roma - Piazza Venezia 45, Roma',
    eventDate: '2026-07-10',
    createdBy: '4',
    carSharing: [],
    hotelSharing: [
      {
        id: 'hotel3',
        tripId: 'trip2',
        organizerId: '4',
        hotelName: 'Airbnb Apartment',
        checkIn: '2026-07-10',
        checkOut: '2026-07-13',
        roomType: 'Apartment (6 beds)',
        totalCost: 600,
        maxPeople: 6,
        currentPeople: ['4', '5'],
        notes: 'Large apartment with kitchen. Looking for 4 more people to split costs!',
      },
    ],
    participants: ['4', '5'],
  },
];

export const mockDocuments: Document[] = [
  {
    id: 'doc1',
    userId: '2',
    type: 'membership_request',
    fileName: 'ACSI_Membership_Request_Sarah_Johnson.pdf',
    uploadDate: '2025-02-20',
    status: 'approved',
    notes: 'Membership approved and processed',
  },
  {
    id: 'doc2',
    userId: '2',
    type: 'health_certificate',
    fileName: 'Medical_Certificate_Sarah_Johnson.pdf',
    uploadDate: '2025-02-18',
    status: 'approved',
  },
  {
    id: 'doc3',
    userId: '3',
    type: 'membership_request',
    fileName: 'ACSI_Request_John_Davis.pdf',
    uploadDate: '2025-03-15',
    status: 'pending',
    notes: 'Waiting for payment confirmation',
  },
  {
    id: 'doc4',
    userId: '3',
    type: 'health_certificate',
    fileName: 'Health_Cert_Davis.pdf',
    uploadDate: '2025-03-12',
    status: 'approved',
  },
  {
    id: 'doc5',
    userId: '4',
    type: 'health_certificate',
    fileName: 'Medical_Emily_Brown.pdf',
    uploadDate: '2025-01-25',
    status: 'approved',
  },
  {
    id: 'doc6',
    userId: '5',
    type: 'health_certificate',
    fileName: 'Certificate_Michael_Lee.pdf',
    uploadDate: '2025-04-05',
    status: 'pending',
    notes: 'Certificate expires soon - renewal needed',
  },
];

export const mockMemberships: Membership[] = [
  {
    id: 'mem1',
    name: 'Basic',
    color: '#8B8B8B',
    stylesIncluded: 0,
    priceMonthly: 0,
    priceTotal: 5,
    timeframe: 'Annuale',
    type: 'basic',
    description: 'Accesso al sito web e visualizzazione eventi',
  },
  {
    id: 'mem2',
    name: 'Blue',
    color: '#3B82F6',
    stylesIncluded: 1,
    priceMonthly: 45,
    priceTotal: 45,
    timeframe: 'Mensile',
    type: 'weekly',
    description: '1 stile - Accesso a tutti i corsi settimanali di un singolo stile',
  },
  {
    id: 'mem3',
    name: 'Green',
    color: '#10B981',
    stylesIncluded: 2,
    priceMonthly: 80,
    priceTotal: 80,
    timeframe: 'Mensile',
    type: 'weekly',
    description: '2 stili - Accesso a tutti i corsi settimanali di due stili',
  },
  {
    id: 'mem4',
    name: 'Bronze',
    color: '#CD7F32',
    stylesIncluded: 3,
    priceMonthly: 110,
    priceTotal: 110,
    timeframe: 'Mensile',
    type: 'weekly',
    description: '3 stili - Accesso a tutti i corsi settimanali di tre stili',
  },
  {
    id: 'mem5',
    name: 'Silver',
    color: '#C0C0C0',
    stylesIncluded: 4,
    priceMonthly: 135,
    priceTotal: 135,
    timeframe: 'Mensile',
    type: 'weekly',
    description: '4 stili - Accesso a tutti i corsi settimanali di quattro stili',
  },
  {
    id: 'mem6',
    name: 'Gold',
    color: '#FFD700',
    stylesIncluded: 5,
    priceMonthly: 155,
    priceTotal: 155,
    timeframe: 'Mensile',
    type: 'weekly',
    description: '5 stili - Accesso illimitato a tutti i corsi settimanali della scuola',
  },
];

export const mockUserMemberships: UserMembership[] = [
  {
    id: 'umem1',
    userId: '2',
    membershipId: 'mem3',
    purchaseDate: '2026-04-01',
    validFrom: '2026-04-01',
    validTo: '2026-04-30',
    status: 'active',
    associatedCourses: ['rc1', 'rc2'],
    paymentId: 'p4',
  },
  {
    id: 'umem2',
    userId: '3',
    membershipId: 'mem2',
    purchaseDate: '2026-04-01',
    validFrom: '2026-04-01',
    validTo: '2026-04-30',
    status: 'active',
    associatedCourses: ['rc1'],
    paymentId: 'p5',
  },
  {
    id: 'umem3',
    userId: '4',
    membershipId: 'mem6',
    purchaseDate: '2026-04-01',
    validFrom: '2026-04-01',
    validTo: '2026-04-30',
    status: 'active',
    associatedCourses: ['rc1', 'rc2', 'rc3'],
    paymentId: 'p6',
  },
  {
    id: 'umem4',
    userId: '5',
    membershipId: 'mem1',
    purchaseDate: '2026-03-15',
    validFrom: '2026-03-15',
    validTo: '2027-03-15',
    status: 'active',
    associatedCourses: [],
    paymentId: 'p7',
  },
];