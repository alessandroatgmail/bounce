import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Car, Hotel, MapPin, Clock, Users, Plus, Calendar } from 'lucide-react';
import { Trip, CarShare, HotelShare, mockStudents } from '../data/mockData';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

interface TripsProps {
  trips: Trip[];
  onJoinCar: (carId: string) => void;
  onLeaveCar: (carId: string) => void;
  onJoinHotel: (hotelId: string) => void;
  onLeaveHotel: (hotelId: string) => void;
  onAddCarShare: (tripId: string, carShare: Omit<CarShare, 'id' | 'tripId'>) => void;
  onAddHotelShare: (tripId: string, hotelShare: Omit<HotelShare, 'id' | 'tripId'>) => void;
}

export function Trips({
  trips,
  onJoinCar,
  onLeaveCar,
  onJoinHotel,
  onLeaveHotel,
  onAddCarShare,
  onAddHotelShare,
}: TripsProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showCarDialog, setShowCarDialog] = useState(false);
  const [showHotelDialog, setShowHotelDialog] = useState(false);

  // Car share form state
  const [carForm, setCarForm] = useState({
    departureLocation: '',
    departureTime: '',
    availableSeats: 1,
    notes: '',
  });

  // Hotel share form state
  const [hotelForm, setHotelForm] = useState({
    hotelName: '',
    checkIn: '',
    checkOut: '',
    roomType: '',
    totalCost: 0,
    maxPeople: 1,
    notes: '',
  });

  if (!user) return null;

  const getUserName = (userId: string) => {
    const student = mockStudents.find(s => s.id === userId);
    return student?.name || 'Unknown User';
  };

  const getUserInitials = (userId: string) => {
    const name = getUserName(userId);
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleAddCar = () => {
    if (selectedTrip && user) {
      onAddCarShare(selectedTrip.id, {
        driverId: user.id,
        departureLocation: carForm.departureLocation,
        departureTime: carForm.departureTime,
        availableSeats: carForm.availableSeats,
        passengers: [],
        notes: carForm.notes,
      });
      setShowCarDialog(false);
      setCarForm({
        departureLocation: '',
        departureTime: '',
        availableSeats: 1,
        notes: '',
      });
    }
  };

  const handleAddHotel = () => {
    if (selectedTrip && user) {
      onAddHotelShare(selectedTrip.id, {
        organizerId: user.id,
        hotelName: hotelForm.hotelName,
        checkIn: hotelForm.checkIn,
        checkOut: hotelForm.checkOut,
        roomType: hotelForm.roomType,
        totalCost: hotelForm.totalCost,
        maxPeople: hotelForm.maxPeople,
        currentPeople: [user.id],
        notes: hotelForm.notes,
      });
      setShowHotelDialog(false);
      setHotelForm({
        hotelName: '',
        checkIn: '',
        checkOut: '',
        roomType: '',
        totalCost: 0,
        maxPeople: 1,
        notes: '',
      });
    }
  };

  const upcomingTrips = trips
    .filter(trip => new Date(trip.eventDate) >= new Date())
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  return (
    <div className="space-y-6">
      {upcomingTrips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="size-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">
              {language === 'it' 
                ? 'Nessun viaggio programmato al momento' 
                : 'No upcoming trips at the moment'}
            </p>
          </CardContent>
        </Card>
      ) : (
        upcomingTrips.map((trip) => (
          <Card key={trip.id} className="border-[#d4b896]/30">
            <CardHeader className="bg-gradient-to-r from-[#2b2b2b] to-[#3b3b3b] text-white">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl mb-2">{trip.eventName}</CardTitle>
                  <div className="flex flex-col gap-2 text-sm opacity-90">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4" />
                      {trip.eventLocation}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      {format(new Date(trip.eventDate), 'PPP', {
                        locale: language === 'it' ? it : enUS,
                      })}
                    </div>
                  </div>
                </div>
                <Badge className="bg-[#e67e22]">
                  <Users className="size-3 mr-1" />
                  {trip.participants.length} {language === 'it' ? 'partecipanti' : 'participants'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <Tabs defaultValue="cars" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="cars">
                    <Car className="size-4 mr-2" />
                    {language === 'it' ? 'Passaggi' : 'Car Sharing'}
                    <Badge variant="secondary" className="ml-2">
                      {trip.carSharing.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="hotels">
                    <Hotel className="size-4 mr-2" />
                    {language === 'it' ? 'Alloggi' : 'Hotel Sharing'}
                    <Badge variant="secondary" className="ml-2">
                      {trip.hotelSharing.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                {/* Car Sharing Tab */}
                <TabsContent value="cars" className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-gray-600">
                      {language === 'it' 
                        ? 'Condividi un passaggio o unisciti a uno esistente' 
                        : 'Share a ride or join an existing one'}
                    </p>
                    <Dialog open={showCarDialog} onOpenChange={setShowCarDialog}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => setSelectedTrip(trip)}
                          className="bg-[#e67e22] hover:bg-[#d4b896]"
                        >
                          <Plus className="size-4 mr-1" />
                          {language === 'it' ? 'Offri Passaggio' : 'Offer Ride'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {language === 'it' ? 'Offri un Passaggio' : 'Offer a Ride'}
                          </DialogTitle>
                          <DialogDescription>
                            {language === 'it' 
                              ? 'Condividi i dettagli del tuo viaggio' 
                              : 'Share your trip details'}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <Label>{language === 'it' ? 'Luogo di Partenza' : 'Departure Location'}</Label>
                            <Input
                              value={carForm.departureLocation}
                              onChange={(e) => setCarForm({ ...carForm, departureLocation: e.target.value })}
                              placeholder={language === 'it' ? 'es. Milano Centro' : 'e.g. Milan Center'}
                            />
                          </div>
                          <div>
                            <Label>{language === 'it' ? 'Ora di Partenza' : 'Departure Time'}</Label>
                            <Input
                              type="datetime-local"
                              value={carForm.departureTime}
                              onChange={(e) => setCarForm({ ...carForm, departureTime: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>{language === 'it' ? 'Posti Disponibili' : 'Available Seats'}</Label>
                            <Input
                              type="number"
                              min="1"
                              max="8"
                              value={carForm.availableSeats}
                              onChange={(e) => setCarForm({ ...carForm, availableSeats: parseInt(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>{language === 'it' ? 'Note (opzionale)' : 'Notes (optional)'}</Label>
                            <Textarea
                              value={carForm.notes}
                              onChange={(e) => setCarForm({ ...carForm, notes: e.target.value })}
                              placeholder={language === 'it' ? 'es. Felice di dividere i costi del carburante' : 'e.g. Happy to split gas costs'}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowCarDialog(false)}>
                            {language === 'it' ? 'Annulla' : 'Cancel'}
                          </Button>
                          <Button
                            onClick={handleAddCar}
                            className="bg-[#e67e22] hover:bg-[#d4b896]"
                            disabled={!carForm.departureLocation || !carForm.departureTime}
                          >
                            {language === 'it' ? 'Conferma' : 'Confirm'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {trip.carSharing.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {language === 'it' 
                        ? 'Nessun passaggio disponibile. Sii il primo!' 
                        : 'No rides available. Be the first!'}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {trip.carSharing.map((car) => {
                        const seatsLeft = car.availableSeats - car.passengers.length;
                        const isDriver = car.driverId === user.id;
                        const isPassenger = car.passengers.includes(user.id);

                        return (
                          <div key={car.id} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-start gap-3">
                                <Avatar>
                                  <AvatarFallback className="bg-[#d4b896] text-[#2b2b2b]">
                                    {getUserInitials(car.driverId)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-[#2b2b2b]">
                                    {getUserName(car.driverId)}
                                    {isDriver && (
                                      <Badge variant="outline" className="ml-2 text-xs">
                                        {language === 'it' ? 'Tu' : 'You'}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex gap-4 text-sm text-gray-600 mt-1">
                                    <span className="flex items-center gap-1">
                                      <MapPin className="size-3" />
                                      {car.departureLocation}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="size-3" />
                                      {format(new Date(car.departureTime), 'PPp', {
                                        locale: language === 'it' ? it : enUS,
                                      })}
                                    </span>
                                  </div>
                                  {car.notes && (
                                    <p className="text-sm text-gray-500 mt-2 italic">{car.notes}</p>
                                  )}
                                </div>
                              </div>
                              <Badge className={seatsLeft > 0 ? 'bg-green-600' : 'bg-gray-400'}>
                                {seatsLeft} {language === 'it' ? 'posti' : 'seats'}
                              </Badge>
                            </div>

                            {car.passengers.length > 0 && (
                              <div className="flex items-center gap-2 mb-3 pl-12">
                                <Users className="size-4 text-gray-500" />
                                <div className="flex -space-x-2">
                                  {car.passengers.map((passengerId) => (
                                    <Avatar key={passengerId} className="size-6 border-2 border-white">
                                      <AvatarFallback className="text-xs bg-gray-300 text-gray-700">
                                        {getUserInitials(passengerId)}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                </div>
                                <span className="text-sm text-gray-600">
                                  {car.passengers.map(id => getUserName(id)).join(', ')}
                                </span>
                              </div>
                            )}

                            {!isDriver && (
                              <div className="pl-12">
                                {isPassenger ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onLeaveCar(car.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    {language === 'it' ? 'Annulla Prenotazione' : 'Cancel Booking'}
                                  </Button>
                                ) : seatsLeft > 0 ? (
                                  <Button
                                    size="sm"
                                    onClick={() => onJoinCar(car.id)}
                                    className="bg-[#e67e22] hover:bg-[#d4b896]"
                                  >
                                    {language === 'it' ? 'Prenota Posto' : 'Book Seat'}
                                  </Button>
                                ) : (
                                  <Badge variant="secondary">
                                    {language === 'it' ? 'Completo' : 'Full'}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Hotel Sharing Tab */}
                <TabsContent value="hotels" className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-gray-600">
                      {language === 'it' 
                        ? 'Condividi una camera o unisciti a una prenotazione' 
                        : 'Share a room or join a booking'}
                    </p>
                    <Dialog open={showHotelDialog} onOpenChange={setShowHotelDialog}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => setSelectedTrip(trip)}
                          className="bg-[#e67e22] hover:bg-[#d4b896]"
                        >
                          <Plus className="size-4 mr-1" />
                          {language === 'it' ? 'Condividi Alloggio' : 'Share Room'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {language === 'it' ? 'Condividi Alloggio' : 'Share Accommodation'}
                          </DialogTitle>
                          <DialogDescription>
                            {language === 'it' 
                              ? 'Condividi i dettagli della tua prenotazione' 
                              : 'Share your booking details'}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <Label>{language === 'it' ? 'Nome Hotel/Alloggio' : 'Hotel/Accommodation Name'}</Label>
                            <Input
                              value={hotelForm.hotelName}
                              onChange={(e) => setHotelForm({ ...hotelForm, hotelName: e.target.value })}
                              placeholder={language === 'it' ? 'es. Hotel Colosseo' : 'e.g. Colosseum Hotel'}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>{language === 'it' ? 'Check-in' : 'Check-in'}</Label>
                              <Input
                                type="date"
                                value={hotelForm.checkIn}
                                onChange={(e) => setHotelForm({ ...hotelForm, checkIn: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>{language === 'it' ? 'Check-out' : 'Check-out'}</Label>
                              <Input
                                type="date"
                                value={hotelForm.checkOut}
                                onChange={(e) => setHotelForm({ ...hotelForm, checkOut: e.target.value })}
                              />
                            </div>
                          </div>
                          <div>
                            <Label>{language === 'it' ? 'Tipo di Camera' : 'Room Type'}</Label>
                            <Input
                              value={hotelForm.roomType}
                              onChange={(e) => setHotelForm({ ...hotelForm, roomType: e.target.value })}
                              placeholder={language === 'it' ? 'es. Quadrupla (4 letti)' : 'e.g. Quad (4 beds)'}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>{language === 'it' ? 'Costo Totale (€)' : 'Total Cost (€)'}</Label>
                              <Input
                                type="number"
                                min="0"
                                value={hotelForm.totalCost}
                                onChange={(e) => setHotelForm({ ...hotelForm, totalCost: parseFloat(e.target.value) })}
                              />
                            </div>
                            <div>
                              <Label>{language === 'it' ? 'Max Persone' : 'Max People'}</Label>
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                value={hotelForm.maxPeople}
                                onChange={(e) => setHotelForm({ ...hotelForm, maxPeople: parseInt(e.target.value) })}
                              />
                            </div>
                          </div>
                          <div>
                            <Label>{language === 'it' ? 'Note (opzionale)' : 'Notes (optional)'}</Label>
                            <Textarea
                              value={hotelForm.notes}
                              onChange={(e) => setHotelForm({ ...hotelForm, notes: e.target.value })}
                              placeholder={language === 'it' ? 'es. Vicino al locale del festival' : 'e.g. Near festival venue'}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowHotelDialog(false)}>
                            {language === 'it' ? 'Annulla' : 'Cancel'}
                          </Button>
                          <Button
                            onClick={handleAddHotel}
                            className="bg-[#e67e22] hover:bg-[#d4b896]"
                            disabled={!hotelForm.hotelName || !hotelForm.checkIn || !hotelForm.checkOut}
                          >
                            {language === 'it' ? 'Conferma' : 'Confirm'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {trip.hotelSharing.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {language === 'it' 
                        ? 'Nessun alloggio condiviso. Sii il primo!' 
                        : 'No shared accommodations. Be the first!'}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {trip.hotelSharing.map((hotel) => {
                        const spotsLeft = hotel.maxPeople - hotel.currentPeople.length;
                        const isOrganizer = hotel.organizerId === user.id;
                        const isParticipant = hotel.currentPeople.includes(user.id);
                        const costPerPerson = hotel.totalCost / hotel.maxPeople;

                        return (
                          <div key={hotel.id} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-start gap-3">
                                <Avatar>
                                  <AvatarFallback className="bg-[#d4b896] text-[#2b2b2b]">
                                    {getUserInitials(hotel.organizerId)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Hotel className="size-4 text-[#e67e22]" />
                                    <span className="font-semibold text-[#2b2b2b]">{hotel.hotelName}</span>
                                    {isOrganizer && (
                                      <Badge variant="outline" className="text-xs">
                                        {language === 'it' ? 'Tu' : 'You'}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 space-y-1">
                                    <div className="flex items-center gap-1">
                                      {getUserName(hotel.organizerId)} - {hotel.roomType}
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span>
                                        {format(new Date(hotel.checkIn), 'PP', {
                                          locale: language === 'it' ? it : enUS,
                                        })}
                                      </span>
                                      <span>→</span>
                                      <span>
                                        {format(new Date(hotel.checkOut), 'PP', {
                                          locale: language === 'it' ? it : enUS,
                                        })}
                                      </span>
                                    </div>
                                    <div className="font-medium text-[#e67e22]">
                                      €{costPerPerson.toFixed(0)} {language === 'it' ? 'a persona' : 'per person'}
                                    </div>
                                  </div>
                                  {hotel.notes && (
                                    <p className="text-sm text-gray-500 mt-2 italic">{hotel.notes}</p>
                                  )}
                                </div>
                              </div>
                              <Badge className={spotsLeft > 0 ? 'bg-green-600' : 'bg-gray-400'}>
                                {spotsLeft} {language === 'it' ? 'posti' : 'spots'}
                              </Badge>
                            </div>

                            {hotel.currentPeople.length > 0 && (
                              <div className="flex items-center gap-2 mb-3 pl-12">
                                <Users className="size-4 text-gray-500" />
                                <div className="flex -space-x-2">
                                  {hotel.currentPeople.map((personId) => (
                                    <Avatar key={personId} className="size-6 border-2 border-white">
                                      <AvatarFallback className="text-xs bg-gray-300 text-gray-700">
                                        {getUserInitials(personId)}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                </div>
                                <span className="text-sm text-gray-600">
                                  {hotel.currentPeople.map(id => getUserName(id)).join(', ')}
                                </span>
                              </div>
                            )}

                            {!isOrganizer && (
                              <div className="pl-12">
                                {isParticipant ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onLeaveHotel(hotel.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    {language === 'it' ? 'Annulla Partecipazione' : 'Leave Room'}
                                  </Button>
                                ) : spotsLeft > 0 ? (
                                  <Button
                                    size="sm"
                                    onClick={() => onJoinHotel(hotel.id)}
                                    className="bg-[#e67e22] hover:bg-[#d4b896]"
                                  >
                                    {language === 'it' ? 'Unisciti' : 'Join'}
                                  </Button>
                                ) : (
                                  <Badge variant="secondary">
                                    {language === 'it' ? 'Completo' : 'Full'}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
