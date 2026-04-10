import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { useLanguage } from '../contexts/LanguageContext';
import { RegularClass } from '../data/mockData';

interface RegularClassFormProps {
  onSubmit?: (regularClass: Omit<RegularClass, 'id' | 'isActive'>) => void;
  onCancel?: () => void;
}

const DAYS_OF_WEEK = [
  { value: 1, labelIt: 'Lunedì', labelEn: 'Monday' },
  { value: 2, labelIt: 'Martedì', labelEn: 'Tuesday' },
  { value: 3, labelIt: 'Mercoledì', labelEn: 'Wednesday' },
  { value: 4, labelIt: 'Giovedì', labelEn: 'Thursday' },
  { value: 5, labelIt: 'Venerdì', labelEn: 'Friday' },
  { value: 6, labelIt: 'Sabato', labelEn: 'Saturday' },
  { value: 0, labelIt: 'Domenica', labelEn: 'Sunday' },
];

export function RegularClassForm({ onSubmit, onCancel }: RegularClassFormProps) {
  const { language } = useLanguage();
  const [formData, setFormData] = useState({
    title: '',
    instructor: '',
    dayOfWeek: 1 as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    time: '',
    duration: 90,
    level: 'Beginner' as 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels',
    price: 15,
    maxCapacity: 20,
    location: '',
    description: '',
    frequency: 'weekly' as 'weekly' | 'fortnightly' | 'monthly',
    startDate: '',
    endDate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({
        ...formData,
        type: 'class',
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
            {language === 'it' ? 'Titolo Corso' : 'Class Title'} *
          </Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder={language === 'it' ? 'es. Lindy Hop Intermediate - Tuesday' : 'e.g. Lindy Hop Intermediate - Tuesday'}
            required
          />
        </div>

        <div>
          <Label htmlFor="instructor">
            {language === 'it' ? 'Istruttore' : 'Instructor'} *
          </Label>
          <Input
            id="instructor"
            value={formData.instructor}
            onChange={(e) => handleChange('instructor', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="level">
            {language === 'it' ? 'Livello' : 'Level'} *
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

        <div>
          <Label htmlFor="dayOfWeek">
            {language === 'it' ? 'Giorno della Settimana' : 'Day of Week'} *
          </Label>
          <Select
            value={formData.dayOfWeek.toString()}
            onValueChange={(value) => handleChange('dayOfWeek', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map(day => (
                <SelectItem key={day.value} value={day.value.toString()}>
                  {language === 'it' ? day.labelIt : day.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="time">
            {language === 'it' ? 'Ora' : 'Time'} *
          </Label>
          <Input
            id="time"
            type="time"
            value={formData.time}
            onChange={(e) => handleChange('time', e.target.value)}
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
          <Label htmlFor="frequency">
            {language === 'it' ? 'Frequenza' : 'Frequency'} *
          </Label>
          <Select
            value={formData.frequency}
            onValueChange={(value) => handleChange('frequency', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">
                {language === 'it' ? 'Settimanale' : 'Weekly'}
              </SelectItem>
              <SelectItem value="fortnightly">
                {language === 'it' ? 'Bisettimanale' : 'Fortnightly'}
              </SelectItem>
              <SelectItem value="monthly">
                {language === 'it' ? 'Mensile' : 'Monthly'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="price">
            {language === 'it' ? 'Prezzo per Lezione (€)' : 'Price per Class (€)'} *
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
          <Label htmlFor="location">
            {language === 'it' ? 'Sede' : 'Location'} *
          </Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder={language === 'it' ? 'es. Studio A - Via della Danza 123, Roma' : 'e.g. Studio A - Via della Danza 123, Rome'}
            required
          />
        </div>

        <div>
          <Label htmlFor="startDate">
            {language === 'it' ? 'Data Inizio' : 'Start Date'} *
          </Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="endDate">
            {language === 'it' ? 'Data Fine' : 'End Date'} *
          </Label>
          <Input
            id="endDate"
            type="date"
            value={formData.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
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
          {language === 'it' ? 'Crea Corso Regolare' : 'Create Regular Class'}
        </Button>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>
            {language === 'it' ? '💡 Nota:' : '💡 Note:'}
          </strong>{' '}
          {language === 'it'
            ? 'Creando un corso regolare, il sistema genererà automaticamente tutte le lezioni individuali dal giorno di inizio al giorno di fine secondo la frequenza scelta.'
            : 'By creating a regular class, the system will automatically generate all individual lessons from the start date to the end date according to the selected frequency.'}
        </p>
      </div>
    </form>
  );
}
