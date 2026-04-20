import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useEventTypes } from '../hooks/useEventTypes';
import { useArtists } from '../hooks/useArtists';
import { Festival } from '../data/mockData';

type Status = 'draft' | 'confirmed' | 'published';

interface FestivalEventFormProps {
  festival: Festival;
  dayIndex?: number;
  room?: string;
  startTime?: string;
  onSubmit?: (data: EventFormData) => void;
  onCancel?: () => void;
}

export interface EventFormData {
  name: string;
  status: Status;
  event_type_id: number | '';
  artist_ids: number[];
  dayIndex: number;
  room: string;
  startTime: string;
  duration: number;
  maxCapacity: number;
  description: string;
  style: string;
}

export function FestivalEventForm({
  festival,
  dayIndex = 0,
  room,
  startTime = '10:00',
  onSubmit,
  onCancel,
}: FestivalEventFormProps) {
  const { language } = useLanguage();
  const { accessToken } = useAuth();
  const { eventTypes, loading: loadingTypes } = useEventTypes(accessToken);
  const { artists, loading: loadingArtists } = useArtists(accessToken);

  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    status: 'draft',
    event_type_id: '',
    artist_ids: [],
    dayIndex,
    room: room || festival.rooms[0] || '',
    startTime,
    duration: 90,
    maxCapacity: 30,
    description: '',
    style: '',
  });

  const handleChange = (field: keyof EventFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArtist = (id: number) => {
    setFormData(prev => ({
      ...prev,
      artist_ids: prev.artist_ids.includes(id)
        ? prev.artist_ids.filter(a => a !== id)
        : [...prev.artist_ids, id],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">
            {language === 'it' ? 'Titolo Evento' : 'Event Title'} *
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={language === 'it' ? 'es. Lindy Hop Fundamentals' : 'e.g. Lindy Hop Fundamentals'}
            required
          />
        </div>

        <div>
          <Label htmlFor="status">
            {language === 'it' ? 'Stato' : 'Status'} *
          </Label>
          <Select
            value={formData.status}
            onValueChange={(value) => handleChange('status', value as Status)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{language === 'it' ? 'Bozza' : 'Draft'}</SelectItem>
              <SelectItem value="confirmed">{language === 'it' ? 'Confermato' : 'Confirmed'}</SelectItem>
              <SelectItem value="published">{language === 'it' ? 'Pubblicato' : 'Published'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="event_type_id">
            {language === 'it' ? 'Tipo Evento' : 'Event Type'} *
          </Label>
          <Select
            value={formData.event_type_id.toString()}
            onValueChange={(value) => handleChange('event_type_id', parseInt(value))}
            disabled={loadingTypes}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingTypes ? '...' : (language === 'it' ? 'Seleziona tipo' : 'Select type')} />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((et) => (
                <SelectItem key={et.id} value={et.id.toString()}>
                  {et.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="style">
            {language === 'it' ? 'Stile di Danza' : 'Dance Style'}
          </Label>
          <Input
            id="style"
            value={formData.style}
            onChange={(e) => handleChange('style', e.target.value)}
            placeholder={language === 'it' ? 'es. Lindy Hop' : 'e.g. Lindy Hop'}
          />
        </div>

        <div>
          <Label htmlFor="dayIndex">
            {language === 'it' ? 'Giorno del Festival' : 'Festival Day'} *
          </Label>
          <Select
            value={formData.dayIndex.toString()}
            onValueChange={(value) => handleChange('dayIndex', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: festival.numberOfDays }, (_, i) => {
                const date = new Date(festival.startDate);
                date.setDate(date.getDate() + i);
                return (
                  <SelectItem key={i} value={i.toString()}>
                    {language === 'it' ? 'Giorno' : 'Day'} {i + 1} -{' '}
                    {date.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="room">
            {language === 'it' ? 'Sala' : 'Room'} *
          </Label>
          <Select
            value={formData.room}
            onValueChange={(value) => handleChange('room', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {festival.rooms.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="startTime">
            {language === 'it' ? 'Ora Inizio' : 'Start Time'} *
          </Label>
          <Input
            id="startTime"
            type="time"
            value={formData.startTime}
            onChange={(e) => handleChange('startTime', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="duration">
            {language === 'it' ? 'Durata (minuti)' : 'Duration (minutes)'} *
          </Label>
          <Input
            id="duration"
            type="number"
            value={formData.duration}
            onChange={(e) => handleChange('duration', parseInt(e.target.value))}
            required
          />
        </div>

        <div>
          <Label htmlFor="maxCapacity">
            {language === 'it' ? 'Capacità Massima' : 'Max Capacity'} *
          </Label>
          <Input
            id="maxCapacity"
            type="number"
            value={formData.maxCapacity}
            onChange={(e) => handleChange('maxCapacity', parseInt(e.target.value))}
            required
          />
        </div>

        <div className="col-span-2">
          <Label>
            {language === 'it' ? 'Istruttori / Artisti' : 'Instructors / Artists'}
          </Label>
          {loadingArtists ? (
            <p className="text-sm text-gray-500 mt-1">...</p>
          ) : artists.length === 0 ? (
            <p className="text-sm text-gray-500 mt-1">
              {language === 'it' ? 'Nessun artista disponibile' : 'No artists available'}
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
              {artists.map((artist) => (
                <div key={artist.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`artist-${artist.id}`}
                    checked={formData.artist_ids.includes(artist.id)}
                    onCheckedChange={() => toggleArtist(artist.id)}
                  />
                  <label htmlFor={`artist-${artist.id}`} className="text-sm cursor-pointer">
                    {artist.full_name}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">
            {language === 'it' ? 'Descrizione' : 'Description'} *
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            required
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {language === 'it' ? 'Annulla' : 'Cancel'}
          </Button>
        )}
        <Button type="submit" className="bg-[#e67e22] hover:bg-[#d4b896]">
          {language === 'it' ? 'Aggiungi Evento' : 'Add Event'}
        </Button>
      </div>
    </form>
  );
}
