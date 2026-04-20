import { useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Clock, Users, Music, GripVertical } from 'lucide-react';
import { FestivalEvent, Festival } from '../data/mockData';
import { useLanguage } from '../contexts/LanguageContext';

interface FestivalScheduleBuilderProps {
  festival: Festival;
  events: FestivalEvent[];
  onEventsChange: (events: FestivalEvent[]) => void;
  onAddEvent: (dayIndex: number, room: string, startTime: string) => void;
}

interface ScheduleSlot {
  dayIndex: number;
  room: string;
  startTime: string;
}

const ITEM_TYPE = 'FESTIVAL_EVENT';

// Time slots from 9:00 to 02:00 next day
const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', 
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00', '23:00', '00:00', '01:00', '02:00'
];

function DraggableEvent({ 
  event, 
  onMove 
}: { 
  event: FestivalEvent; 
  onMove: (eventId: string, dayIndex: number, room: string, startTime: string) => void;
}) {
  const { language } = useLanguage();
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ITEM_TYPE,
    item: { event },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const endTime = (() => {
    const [hours, minutes] = event.startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + event.duration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  })();

  const heightInSlots = Math.ceil(event.duration / 60);

  return (
    <div
      ref={drag}
      className={`
        absolute left-0 right-0 p-2 rounded cursor-move border-l-4 shadow-sm
        ${event.type === 'party' ? 'bg-purple-100 border-purple-500' : 
          event.type === 'workshop' ? 'bg-blue-100 border-blue-500' : 
          'bg-green-100 border-green-500'}
        ${isDragging ? 'opacity-50' : ''}
      `}
      style={{ 
        opacity: isDragging ? 0.5 : 1,
        height: `${heightInSlots * 60}px`,
        minHeight: '55px'
      }}
    >
      <div className="flex items-start gap-1">
        <GripVertical className="size-3 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-xs truncate">{event.title}</div>
          <div className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
            <Clock className="size-3" />
            {event.startTime} - {endTime}
          </div>
          {event.instructor && (
            <div className="text-xs text-gray-500 truncate">{event.instructor}</div>
          )}
          {event.dj && (
            <div className="text-xs text-gray-500 truncate flex items-center gap-1">
              <Music className="size-3" />
              {event.dj}
            </div>
          )}
          <div className="flex items-center gap-1 mt-1">
            {event.level && (
              <Badge variant="outline" className="text-xs py-0 px-1">
                {event.level}
              </Badge>
            )}
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Users className="size-3" />
              {event.currentEnrollment}/{event.maxCapacity}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DroppableSlot({
  dayIndex,
  room,
  timeSlot,
  events,
  onDrop,
  onAddEvent,
}: {
  dayIndex: number;
  room: string;
  timeSlot: string;
  events: FestivalEvent[];
  onDrop: (eventId: string, dayIndex: number, room: string, startTime: string) => void;
  onAddEvent: (dayIndex: number, room: string, startTime: string) => void;
}) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ITEM_TYPE,
    drop: (item: { event: FestivalEvent }) => {
      onDrop(item.event.id, dayIndex, room, timeSlot);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  // Check if there's an event starting at this exact time
  const eventAtSlot = events.find(
    e => e.dayIndex === dayIndex && 
         e.room === room && 
         e.startTime === timeSlot
  );

  // Check if this slot is covered by an event starting earlier
  const isCoveredByEvent = events.some(e => {
    if (e.dayIndex !== dayIndex || e.room !== room) return false;
    
    const eventStart = e.startTime;
    const [eventHours, eventMinutes] = eventStart.split(':').map(Number);
    const eventStartMinutes = eventHours * 60 + eventMinutes;
    const eventEndMinutes = eventStartMinutes + e.duration;
    
    const [slotHours, slotMins] = timeSlot.split(':').map(Number);
    const slotMinutes = slotHours * 60 + slotMins;
    
    return slotMinutes >= eventStartMinutes && slotMinutes < eventEndMinutes && eventStart !== timeSlot;
  });

  if (isCoveredByEvent) {
    return <div className="h-[60px]" />;
  }

  return (
    <div
      ref={drop}
      className={`
        relative h-[60px] border-b border-r border-gray-200
        ${isOver ? 'bg-yellow-50' : 'bg-white hover:bg-gray-50'}
        transition-colors
      `}
    >
      {eventAtSlot ? (
        <DraggableEvent event={eventAtSlot} onMove={onDrop} />
      ) : (
        <button
          onClick={() => onAddEvent(dayIndex, room, timeSlot)}
          className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity group"
        >
          <Plus className="size-4 text-gray-400 group-hover:text-gray-600" />
        </button>
      )}
    </div>
  );
}

export function FestivalScheduleBuilder({
  festival,
  events,
  onEventsChange,
  onAddEvent,
}: FestivalScheduleBuilderProps) {
  const { language } = useLanguage();

  const handleDrop = (eventId: string, dayIndex: number, room: string, startTime: string) => {
    const updatedEvents = events.map(e =>
      e.id === eventId
        ? { ...e, dayIndex, room, startTime }
        : e
    );
    onEventsChange(updatedEvents);
  };

  const days = Array.from({ length: festival.numberOfDays }, (_, i) => {
    const date = new Date(festival.startDate);
    date.setDate(date.getDate() + i);
    return {
      index: i,
      date: date,
      label: date.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    };
  });

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        {days.map((day) => (
          <Card key={day.index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {language === 'it' ? 'Giorno' : 'Day'} {day.index + 1} - {day.label}
                </span>
                <Badge variant="outline">
                  {events.filter(e => e.festivalId === festival.id && e.dayIndex === day.index).length}{' '}
                  {language === 'it' ? 'eventi' : 'events'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="grid" style={{ gridTemplateColumns: `100px repeat(${festival.rooms.length}, 1fr)` }}>
                    {/* Header */}
                    <div className="sticky left-0 bg-gray-100 border-b border-r border-gray-300 p-2 font-medium">
                      {language === 'it' ? 'Orario' : 'Time'}
                    </div>
                    {festival.rooms.map((room) => (
                      <div
                        key={room}
                        className="bg-gray-100 border-b border-r border-gray-300 p-2 font-medium text-center"
                      >
                        {room}
                      </div>
                    ))}

                    {/* Time slots */}
                    {TIME_SLOTS.map((timeSlot) => (
                      <div key={timeSlot} className="contents">
                        <div className="sticky left-0 bg-gray-50 border-b border-r border-gray-200 p-2 text-sm font-medium">
                          {timeSlot}
                        </div>
                        {festival.rooms.map((room) => (
                          <DroppableSlot
                            key={`${day.index}-${room}-${timeSlot}`}
                            dayIndex={day.index}
                            room={room}
                            timeSlot={timeSlot}
                            events={events.filter(e => e.festivalId === festival.id)}
                            onDrop={handleDrop}
                            onAddEvent={onAddEvent}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DndProvider>
  );
}