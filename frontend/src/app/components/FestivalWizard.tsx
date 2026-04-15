import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Calendar, MapPin, DoorOpen, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Festival } from '../data/mockData';

interface FestivalWizardProps {
  onComplete: (festival: Omit<Festival, 'id' | 'status'>) => void;
  onCancel: () => void;
}

export function FestivalWizard({ onComplete, onCancel }: FestivalWizardProps) {
  const { language } = useLanguage();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    numberOfDays: 3,
    rooms: [''] as string[],
  });

  const handleChange = (field: string, value: any) => {
    if (field === 'startDate' || field === 'endDate') {
      setFormData(prev => {
        const updated = { ...prev, [field]: value };
        
        // Auto-calculate number of days
        if (updated.startDate && updated.endDate) {
          const start = new Date(updated.startDate);
          const end = new Date(updated.endDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          updated.numberOfDays = diffDays;
        }
        
        return updated;
      });
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleAddRoom = () => {
    setFormData(prev => ({
      ...prev,
      rooms: [...prev.rooms, ''],
    }));
  };

  const handleRemoveRoom = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.filter((_, i) => i !== index),
    }));
  };

  const handleRoomChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) => (i === index ? value : room)),
    }));
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    onComplete({
      title: formData.title,
      description: formData.description,
      startDate: formData.startDate,
      endDate: formData.endDate,
      numberOfDays: formData.numberOfDays,
      rooms: formData.rooms.filter(r => r.trim() !== ''),
      location: formData.location,
    });
  };

  const isStep1Valid = formData.title && formData.description && formData.location;
  const isStep2Valid = formData.startDate && formData.endDate && formData.numberOfDays > 0;
  const isStep3Valid = formData.rooms.filter(r => r.trim() !== '').length > 0;

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div className="flex items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold
                  ${step === s ? 'bg-[#e67e22] text-white' : 
                    step > s ? 'bg-green-500 text-white' : 
                    'bg-gray-200 text-gray-500'}
                `}
              >
                {step > s ? <Check className="size-5" /> : s}
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium">
                  {s === 1 && (language === 'it' ? 'Dettagli Festival' : 'Festival Details')}
                  {s === 2 && (language === 'it' ? 'Date' : 'Dates')}
                  {s === 3 && (language === 'it' ? 'Sale' : 'Rooms')}
                </div>
              </div>
            </div>
            {s < 3 && <div className="flex-1 h-1 bg-gray-200 mx-4" />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5" />
              {language === 'it' ? 'Informazioni del Festival' : 'Festival Information'}
            </CardTitle>
            <CardDescription>
              {language === 'it' 
                ? 'Inserisci i dettagli principali del festival' 
                : 'Enter the main details of the festival'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">
                {language === 'it' ? 'Titolo Festival' : 'Festival Title'} *
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={language === 'it' ? 'es. Rome Swing Festival 2026' : 'e.g. Rome Swing Festival 2026'}
              />
            </div>

            <div>
              <Label htmlFor="description">
                {language === 'it' ? 'Descrizione' : 'Description'} *
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={4}
                placeholder={language === 'it' 
                  ? 'Descrivi il festival, i workshop e le feste...' 
                  : 'Describe the festival, workshops and parties...'}
              />
            </div>

            <div>
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="size-4" />
                {language === 'it' ? 'Sede' : 'Location'} *
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder={language === 'it' 
                  ? 'es. Grand Hotel Roma - Via del Corso 126, Roma' 
                  : 'e.g. Grand Hotel Roma - Via del Corso 126, Roma'}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Dates */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5" />
              {language === 'it' ? 'Date del Festival' : 'Festival Dates'}
            </CardTitle>
            <CardDescription>
              {language === 'it' 
                ? 'Seleziona le date di inizio e fine' 
                : 'Select start and end dates'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">
                  {language === 'it' ? 'Data Inizio' : 'Start Date'} *
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
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
                  min={formData.startDate}
                />
              </div>
            </div>

            {formData.startDate && formData.endDate && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="size-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-blue-900">
                      {language === 'it' 
                        ? `Durata del Festival: ${formData.numberOfDays} giorni` 
                        : `Festival Duration: ${formData.numberOfDays} days`}
                    </div>
                    <div className="text-sm text-blue-700">
                      {new Date(formData.startDate).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {' - '}
                      {new Date(formData.endDate).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Rooms */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="size-5" />
              {language === 'it' ? 'Sale del Festival' : 'Festival Rooms'}
            </CardTitle>
            <CardDescription>
              {language === 'it' 
                ? 'Aggiungi le sale dove si svolgeranno i workshop e le feste' 
                : 'Add the rooms where workshops and parties will take place'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.rooms.map((room, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={room}
                    onChange={(e) => handleRoomChange(index, e.target.value)}
                    placeholder={language === 'it' 
                      ? `es. Ballroom ${String.fromCharCode(65 + index)}` 
                      : `e.g. Ballroom ${String.fromCharCode(65 + index)}`}
                  />
                </div>
                {formData.rooms.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRemoveRoom(index)}
                  >
                    {language === 'it' ? 'Rimuovi' : 'Remove'}
                  </Button>
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddRoom}
              className="w-full"
            >
              + {language === 'it' ? 'Aggiungi Sala' : 'Add Room'}
            </Button>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <DoorOpen className="size-5 text-green-600" />
                <div>
                  <div className="font-medium text-green-900">
                    {language === 'it' 
                      ? `${formData.rooms.filter(r => r.trim()).length} sale configurate` 
                      : `${formData.rooms.filter(r => r.trim()).length} rooms configured`}
                  </div>
                  <div className="text-sm text-green-700">
                    {language === 'it' 
                      ? 'Potrai creare workshop e feste per ogni sala' 
                      : 'You can create workshops and parties for each room'}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={step === 1 ? onCancel : handleBack}
        >
          <ChevronLeft className="size-4 mr-2" />
          {step === 1 
            ? (language === 'it' ? 'Annulla' : 'Cancel') 
            : (language === 'it' ? 'Indietro' : 'Back')}
        </Button>

        {step < 3 ? (
          <Button
            onClick={handleNext}
            disabled={
              (step === 1 && !isStep1Valid) ||
              (step === 2 && !isStep2Valid)
            }
            className="bg-[#e67e22] hover:bg-[#d4b896]"
          >
            {language === 'it' ? 'Avanti' : 'Next'}
            <ChevronRight className="size-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!isStep3Valid}
            className="bg-[#e67e22] hover:bg-[#d4b896]"
          >
            <Check className="size-4 mr-2" />
            {language === 'it' ? 'Crea Festival' : 'Create Festival'}
          </Button>
        )}
      </div>
    </div>
  );
}