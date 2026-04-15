import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { useLanguage } from '../contexts/LanguageContext';
import { FestivalEvent, Festival } from '../data/mockData';

interface FestivalEventFormProps {
  festival: Festival;
  dayIndex?: number;
  room?: string;
  startTime?: string;
  onSubmit?: (event: Omit<FestivalEvent, 'id' | 'festivalId' | 'currentEnrollment'>) => void;
  onCancel?: () => void;
}

export function FestivalEventForm({ 
  festival, 
  dayIndex = 0,
  room,
  startTime = '10:00',
  onSubmit, 
  onCancel 
}: FestivalEventFormProps) {
  const { language } = useLanguage();
  const [formData, setFormData] = useState({
    title: '',
    type: 'workshop' as 'workshop' | 'party' | 'social' | 'performance',
    instructor: '',
    dj: '',
    dayIndex: dayIndex,
    room: room || festival.rooms[0] || '',
    startTime: startTime,
    duration: 90,
    level: 'Intermediate' as 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels' | undefined,
    price: 35,
    maxCapacity: 30,
    description: '',
    style: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({
        ...formData,
        level: formData.type === 'party' ? undefined : formData.level,
        instructor: formData.type === 'party' ? undefined : formData.instructor,
        dj: formData.type === 'party' ? formData.dj : undefined,
      });
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="title">
            {language === 'it' ? 'Titolo Evento' : 'Event Title'} *
          </Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder={language === 'it' ? 'es. Lindy Hop Fundamentals' : 'e.g. Lindy Hop Fundamentals'}
            required
          />
        </div>

        <div>
          <Label htmlFor="type">
            {language === 'it' ? 'Tipo' : 'Type'} *
          </Label>
          <Select
            value={formData.type}
            onValueChange={(value) => handleChange('type', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workshop">
                {language === 'it' ? 'Workshop' : 'Workshop'}
              </SelectItem>
              <SelectItem value="party">
                {language === 'it' ? 'Festa' : 'Party'}
              </SelectItem>
              <SelectItem value="social">
                {language === 'it' ? 'Social' : 'Social'}
              </SelectItem>
              <SelectItem value="performance">
                {language === 'it' ? 'Performance' : 'Performance'}
              </SelectItem>
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

        {formData.type !== 'party' ? (
          <div>
            <Label htmlFor="instructor">
              {language === 'it' ? 'Istruttore' : 'Instructor'} *
            </Label>
            <Input
              id="instructor"
              value={formData.instructor}
              onChange={(e) => handleChange('instructor', e.target.value)}
              placeholder={language === 'it' ? 'es. Mike Thompson' : 'e.g. Mike Thompson'}
              required={formData.type !== 'party'}
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="dj">
              DJ *
            </Label>
            <Input
              id="dj"
              value={formData.dj}
              onChange={(e) => handleChange('dj', e.target.value)}
              placeholder="DJ Swing Master"
              required
            />
          </div>
        )}

        {formData.type !== 'party' && (
          <div>
            <Label htmlFor="level">
              {language === 'it' ? 'Livello' : 'Level'}
            </Label>
            <Select
              value={formData.level}
              onValueChange={(value) => handleChange('level', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Beginner">
                  {language === 'it' ? 'Principiante' : 'Beginner'}
                </SelectItem>
                <SelectItem value="Intermediate">
                  {language === 'it' ? 'Intermedio' : 'Intermediate'}
                </SelectItem>
                <SelectItem value="Advanced">
                  {language === 'it' ? 'Avanzato' : 'Advanced'}
                </SelectItem>
                <SelectItem value="All Levels">
                  {language === 'it' ? 'Tutti i Livelli' : 'All Levels'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
                    {language === 'it' ? 'Giorno' : 'Day'} {i + 1} - {date.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
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
          <Label htmlFor="price">
            {language === 'it' ? 'Prezzo (€)' : 'Price (€)'} *
          </Label>
          <Input
            id="price"
            type="number"
            value={formData.price}
            onChange={(e) => handleChange('price', parseFloat(e.target.value))}
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
