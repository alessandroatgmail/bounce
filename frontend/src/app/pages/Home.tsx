import { Link } from 'react-router';
import { Calendar, Clock, Users, Music } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { mockEvents } from '../data/mockData';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { useLanguage } from '../contexts/LanguageContext';

export function Home() {
  const { t, language } = useLanguage();
  const upcomingEvents = mockEvents
    .filter((event) => new Date(event.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'class':
        return 'bg-[#d4b896] text-[#2b2b2b]';
      case 'workshop':
        return 'bg-[#c89968] text-white';
      case 'social':
        return 'bg-[#e67e22] text-white';
      case 'performance':
        return 'bg-[#2b2b2b] text-[#d4b896]';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section with Dark Background */}
      <section className="relative bg-[#2b2b2b] text-white py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <ImageWithFallback 
            src="https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=1600&h=900&fit=crop" 
            alt="Dancing"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="container mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-light mb-4 italic">
            {language === 'it' ? 'Lo Swing' : 'Swing'}
            <br />
            <span className="font-normal not-italic">
              {language === 'it' ? 'nel Cuore?' : 'in Your Heart?'}
            </span>
          </h1>
          <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-wide">
            {language === 'it' ? 'BALLA CON NOI' : 'DANCE WITH US'}
          </h2>
          <p className="text-lg md:text-xl mb-12 max-w-2xl mx-auto opacity-90 leading-relaxed">
            {language === 'it' ? (
              <>
                Musica swing, divertimento, atmosfere "Sociali" e sorrisi.
                <br />
                Entra con noi nel magico mondo vintage. Un vero e proprio
                <br />
                viaggio nel tempo, emozionante, ritmato e coinvolgente
                <br />
                con il quale dare colore ad ogni tua giornata.
              </>
            ) : (
              <>
                Swing music, fun, "Social" atmospheres and smiles.
                <br />
                Step into the magical vintage world with us. A true
                <br />
                journey through time, exciting, rhythmic and engaging
                <br />
                to bring color to every day.
              </>
            )}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/events">
              <Button size="lg" className="bg-[#e67e22] hover:bg-[#d4b896] text-white px-8 py-6 text-lg uppercase tracking-wide">
                {language === 'it' ? 'Scopri di più' : 'Discover More'}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Image Section with Text Overlay */}
      <section className="relative h-[500px] overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback 
            src="https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&h=900&fit=crop" 
            alt="Dancers from above"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="text-center text-white px-4">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 uppercase tracking-wider">
              {language === 'it' ? 'I NOSTRI CORSI' : 'OUR COURSES'}
            </h2>
            <Link to="/events">
              <Button size="lg" className="bg-[#e67e22] hover:bg-[#d4b896] text-white px-8 uppercase tracking-wide">
                {language === 'it' ? 'Scopri di più' : 'Discover More'}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonial-style Section */}
      <section className="py-20 px-4 bg-[#d4b896]">
        <div className="container mx-auto text-center max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-light italic mb-6 text-[#2b2b2b]">
            {language === 'it' ? 'DICONO DI NOI' : 'TESTIMONIALS'}
          </h2>
          <p className="text-lg md:text-xl mb-4 text-[#2b2b2b]/90 leading-relaxed">
            {language === 'it' 
              ? "L'atmosfera che si respira in Bounce è bellissima! Mi sento libero e questo mi dà gioia."
              : "The atmosphere at Bounce is wonderful! I feel free and this brings me joy."}
          </p>
          <p className="text-sm uppercase tracking-widest text-[#2b2b2b]/70">
            FLORA - LINDY HOPPERS
          </p>
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[#2b2b2b] uppercase tracking-wide">
              {t('home.upcoming.title')}
            </h2>
            <p className="text-lg text-gray-600">
              {language === 'it' ? 'Scopri le nostre prossime lezioni e eventi' : 'Discover our upcoming classes and events'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event) => (
              <Card key={event.id} className="hover:shadow-2xl transition-all duration-300 border-[#d4b896]/20 overflow-hidden group">
                <div className="h-2 bg-gradient-to-r from-[#d4b896] to-[#e67e22]" />
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge className={getEventTypeColor(event.type)}>
                      {event.type.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="border-[#2b2b2b] text-[#2b2b2b]">{event.level}</Badge>
                  </div>
                  <CardTitle className="text-xl text-[#2b2b2b] group-hover:text-[#e67e22] transition-colors">{event.title}</CardTitle>
                  <CardDescription className="text-[#6b6b6b]">
                    {language === 'it' ? 'con' : 'with'} {event.instructor}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-[#d4b896]" />
                      {new Date(event.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-[#d4b896]" />
                      {event.time} ({event.duration} min)
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-[#d4b896]" />
                      {event.currentEnrollment} / {event.maxCapacity} {language === 'it' ? 'iscritti' : 'enrolled'}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                  <div className="mt-4 pt-4 border-t border-[#d4b896]/20 flex justify-end items-center">
                    <Button size="sm" className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white">
                      {language === 'it' ? 'Diventa Membro' : 'Become a Member'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/events">
              <Button size="lg" variant="outline" className="border-[#2b2b2b] text-[#2b2b2b] hover:bg-[#2b2b2b] hover:text-white uppercase tracking-wide">
                {t('home.upcoming.viewAll')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-[#2b2b2b] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <ImageWithFallback 
            src="https://images.unsplash.com/photo-1545128942-d3f3c77f53f5?w=1600&h=600&fit=crop" 
            alt="Dance floor"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="container mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 uppercase tracking-wide">
            {language === 'it' ? (
              <>
                Impara a Ballare, Socializza
                <br />
                e Divertiti con Bounce
              </>
            ) : (
              <>
                Learn to Dance, Socialize
                <br />
                and Have Fun with Bounce
              </>
            )}
          </h2>
          <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto">
            {language === 'it' 
              ? 'Unisciti alla nostra community e scopri il magico mondo dello swing!'
              : 'Join our community and discover the magical world of swing!'}
          </p>
          <Link to="/login">
            <Button size="lg" className="bg-[#e67e22] hover:bg-[#d4b896] text-white px-12 py-6 text-lg uppercase tracking-wide">
              {language === 'it' ? 'Inizia Oggi' : 'Start Today'}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer Info Section */}
      <section className="py-12 px-4 bg-white border-t border-[#d4b896]/20">
        <div className="container mx-auto grid md:grid-cols-3 gap-8 text-center">
          <div>
            <h3 className="text-xl font-bold mb-3 text-[#e67e22] uppercase tracking-wide">
              {language === 'it' ? 'Orario Segreteria' : 'Office Hours'}
            </h3>
            <p className="text-gray-600">
              {language === 'it' ? 'LUN - GIO | 19:30 - 22:00' : 'MON - THU | 7:30 PM - 10:00 PM'}
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-3 text-[#e67e22] uppercase tracking-wide">
              {language === 'it' ? 'Restiamo in Contatto' : 'Stay in Touch'}
            </h3>
            <p className="text-gray-600 text-sm">
              {language === 'it' ? (
                <>
                  Resta aggiornato sugli eventi, i corsi in partenza,
                  <br />
                  i nuovi workshop ed i party a tema.
                </>
              ) : (
                <>
                  Stay updated on events, upcoming courses,
                  <br />
                  new workshops and themed parties.
                </>
              )}
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-3 text-[#e67e22] uppercase tracking-wide">
              {t('home.upcoming.title')}
            </h3>
            <p className="text-gray-600">
              {upcomingEvents.length > 0 
                ? (language === 'it' ? `${upcomingEvents.length} eventi in arrivo` : `${upcomingEvents.length} upcoming events`)
                : t('home.upcoming.noEvents')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}