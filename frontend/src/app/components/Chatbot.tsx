import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../contexts/LanguageContext';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const TRANSLATIONS = {
  it: {
    assistantName: 'Assistente BSL',
    online: 'Online',
    placeholder: 'Scrivi un messaggio...',
    suggestions: 'Prova a chiedere: orari, prezzi, contatti, prenotare',
    openChat: 'Apri chat',
    welcome: 'Ciao! 👋 Benvenuto a Bounce Swing Lovers!\n\nCome posso aiutarti oggi?',
  },
  en: {
    assistantName: 'BSL Assistant',
    online: 'Online',
    placeholder: 'Type a message...',
    suggestions: 'Try asking: schedule, prices, contact, booking',
    openChat: 'Open chat',
    welcome: 'Hello! 👋 Welcome to Bounce Swing Lovers!\n\nHow can I help you today?',
  }
};

const PREDEFINED_RESPONSES = {
  it: {
    // Greetings
    'ciao': 'Ciao! Come posso aiutarti oggi? 😊',
    'buongiorno': 'Buongiorno! Sono qui per rispondere alle tue domande.',
    'buonasera': 'Buonasera! Come posso esserti utile?',
    
    // Common questions
    'orari': 'Le nostre lezioni si tengono:\n• Lunedì e Mercoledì: 19:00-21:00\n• Martedì e Giovedì: 20:00-22:00\n• Weekend: vari orari per workshop\n\nVuoi vedere il calendario completo?',
    'orario': 'Le nostre lezioni si tengono:\n• Lunedì e Mercoledì: 19:00-21:00\n• Martedì e Giovedì: 20:00-22:00\n• Weekend: vari orari per workshop\n\nVuoi vedere il calendario completo?',
    'prezzi': 'I nostri prezzi:\n• Lezione singola: €15\n• Pacchetto 5 lezioni: €65\n• Pacchetto 10 lezioni: €120\n• Abbonamento mensile: €100\n\nContattaci per maggiori dettagli!',
    'prezzo': 'I nostri prezzi:\n• Lezione singola: €15\n• Pacchetto 5 lezioni: €65\n• Pacchetto 10 lezioni: €120\n• Abbonamento mensile: €100\n\nContattaci per maggiori dettagli!',
    'costo': 'I nostri prezzi:\n• Lezione singola: €15\n• Pacchetto 5 lezioni: €65\n• Pacchetto 10 lezioni: €120\n• Abbonamento mensile: €100\n\nContattaci per maggiori dettagli!',
    'principiante': 'Perfetto per principianti! 🎉\n\nNon serve esperienza precedente. Le nostre lezioni per principianti partono dalle basi dello swing. Ti consigliamo di iniziare con le lezioni del lunedì o mercoledì sera.',
    'principianti': 'Perfetto per principianti! 🎉\n\nNon serve esperienza precedente. Le nostre lezioni per principianti partono dalle basi dello swing. Ti consigliamo di iniziare con le lezioni del lunedì o mercoledì sera.',
    'dove': 'Ci troviamo a Roma, presso:\n📍 Via della Danza 123\n00100 Roma, Italia\n\nVicino alla metro B fermata Piramide.',
    'indirizzo': 'Ci troviamo a Roma, presso:\n📍 Via della Danza 123\n00100 Roma, Italia\n\nVicino alla metro B fermata Piramide.',
    'contatti': 'Puoi contattarci:\n📧 Email: info@bounceswinglovers.com\n📱 Tel: +39 06 1234 5678\n💬 WhatsApp: +39 333 123 4567\n\nOppure seguici sui social!',
    'email': 'Scrivici a: info@bounceswinglovers.com\n\nTi risponderemo entro 24 ore! 📧',
    'telefono': 'Chiamaci al: +39 06 1234 5678\nWhatsApp: +39 333 123 4567 📱',
    'prenotare': 'Per prenotare una lezione:\n\n1. Crea un account (o fai login)\n2. Vai alla sezione Eventi\n3. Seleziona la lezione che ti interessa\n4. Clicca su "Prenota Ora"\n\nSe hai problemi, contattaci!',
    'prenotazione': 'Per prenotare una lezione:\n\n1. Crea un account (o fai login)\n2. Vai alla sezione Eventi\n3. Seleziona la lezione che ti interessa\n4. Clicca su "Prenota Ora"\n\nSe hai problemi, contattaci!',
    'pagamento': 'Accettiamo:\n💳 Carte di credito/debito\n💰 Contanti (in sede)\n📱 PayPal\n🏦 Bonifico bancario\n\nI pagamenti online sono sicuri e protetti.',
    'workshop': 'Organizziamo workshop speciali ogni mese! 🎪\n\nI prossimi workshop:\n• Lindy Hop avanzato\n• Charleston Style\n• Balboa fundamentals\n\nControlla il calendario per le date!',
    'eventi': 'Abbiamo tanti eventi in programma! Controlla il nostro calendario nella sezione Eventi per vedere:\n\n• Lezioni regolari\n• Workshop speciali\n• Social dance\n• Serate a tema\n\nCi sono sempre novità! 🎉',
    
    // Help
    'aiuto': 'Posso aiutarti con:\n\n• Informazioni su orari e prezzi\n• Come prenotare una lezione\n• Corsi per principianti\n• Contatti e sede\n• Eventi e workshop\n\nCosa vuoi sapere?',
    'help': 'Posso aiutarti con:\n\n• Informazioni su orari e prezzi\n• Come prenotare una lezione\n• Corsi per principianti\n• Contatti e sede\n• Eventi e workshop\n\nCosa vuoi sapere?',
    
    // Default
    'default': 'Grazie per il messaggio! 😊\n\nPer domande specifiche, prova a chiedere di:\n• Orari e prezzi\n• Prenotazioni\n• Contatti\n• Eventi e workshop\n\nOppure contattaci direttamente a: info@bounceswinglovers.com'
  },
  en: {
    // Greetings
    'hello': 'Hello! How can I help you today? 😊',
    'hi': 'Hi! How can I help you today? 😊',
    'hey': 'Hey! How can I help you today? 😊',
    'good morning': 'Good morning! I\'m here to answer your questions.',
    'good evening': 'Good evening! How can I assist you?',
    
    // Common questions
    'schedule': 'Our classes are held:\n• Monday & Wednesday: 7:00 PM - 9:00 PM\n• Tuesday & Thursday: 8:00 PM - 10:00 PM\n• Weekends: various times for workshops\n\nWould you like to see the full calendar?',
    'time': 'Our classes are held:\n• Monday & Wednesday: 7:00 PM - 9:00 PM\n• Tuesday & Thursday: 8:00 PM - 10:00 PM\n• Weekends: various times for workshops\n\nWould you like to see the full calendar?',
    'times': 'Our classes are held:\n• Monday & Wednesday: 7:00 PM - 9:00 PM\n• Tuesday & Thursday: 8:00 PM - 10:00 PM\n• Weekends: various times for workshops\n\nWould you like to see the full calendar?',
    'price': 'Our prices:\n• Single lesson: €15\n• 5-lesson package: €65\n• 10-lesson package: €120\n• Monthly subscription: €100\n\nContact us for more details!',
    'prices': 'Our prices:\n• Single lesson: €15\n• 5-lesson package: €65\n• 10-lesson package: €120\n• Monthly subscription: €100\n\nContact us for more details!',
    'cost': 'Our prices:\n• Single lesson: €15\n• 5-lesson package: €65\n• 10-lesson package: €120\n• Monthly subscription: €100\n\nContact us for more details!',
    'beginner': 'Perfect for beginners! 🎉\n\nNo previous experience required. Our beginner classes start from the basics of swing. We recommend starting with Monday or Wednesday evening classes.',
    'beginners': 'Perfect for beginners! 🎉\n\nNo previous experience required. Our beginner classes start from the basics of swing. We recommend starting with Monday or Wednesday evening classes.',
    'where': 'We are located in Rome at:\n📍 Via della Danza 123\n00100 Rome, Italy\n\nNear metro B Piramide stop.',
    'location': 'We are located in Rome at:\n📍 Via della Danza 123\n00100 Rome, Italy\n\nNear metro B Piramide stop.',
    'address': 'We are located in Rome at:\n📍 Via della Danza 123\n00100 Rome, Italy\n\nNear metro B Piramide stop.',
    'contact': 'You can contact us:\n📧 Email: info@bounceswinglovers.com\n📱 Phone: +39 06 1234 5678\n💬 WhatsApp: +39 333 123 4567\n\nOr follow us on social media!',
    'email': 'Email us at: info@bounceswinglovers.com\n\nWe\'ll reply within 24 hours! 📧',
    'phone': 'Call us at: +39 06 1234 5678\nWhatsApp: +39 333 123 4567 📱',
    'book': 'To book a lesson:\n\n1. Create an account (or login)\n2. Go to the Events section\n3. Select the class you\'re interested in\n4. Click "Book Now"\n\nIf you have problems, contact us!',
    'booking': 'To book a lesson:\n\n1. Create an account (or login)\n2. Go to the Events section\n3. Select the class you\'re interested in\n4. Click "Book Now"\n\nIf you have problems, contact us!',
    'payment': 'We accept:\n💳 Credit/debit cards\n💰 Cash (in-person)\n📱 PayPal\n🏦 Bank transfer\n\nOnline payments are secure and protected.',
    'workshop': 'We organize special workshops every month! 🎪\n\nUpcoming workshops:\n• Advanced Lindy Hop\n• Charleston Style\n• Balboa Fundamentals\n\nCheck the calendar for dates!',
    'workshops': 'We organize special workshops every month! 🎪\n\nUpcoming workshops:\n• Advanced Lindy Hop\n• Charleston Style\n• Balboa Fundamentals\n\nCheck the calendar for dates!',
    'event': 'We have many events scheduled! Check our calendar in the Events section to see:\n\n• Regular classes\n• Special workshops\n• Social dance\n• Themed evenings\n\nThere\'s always something new! 🎉',
    'events': 'We have many events scheduled! Check our calendar in the Events section to see:\n\n• Regular classes\n• Special workshops\n• Social dance\n• Themed evenings\n\nThere\'s always something new! 🎉',
    
    // Help
    'help': 'I can help you with:\n\n• Schedule and pricing information\n• How to book a lesson\n• Beginner courses\n• Contact and location\n• Events and workshops\n\nWhat would you like to know?',
    
    // Default
    'default': 'Thank you for your message! 😊\n\nFor specific questions, try asking about:\n• Schedule and prices\n• Bookings\n• Contact\n• Events and workshops\n\nOr contact us directly at: info@bounceswinglovers.com'
  }
};

export function Chatbot() {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcome message when language changes
  useEffect(() => {
    setMessages([{
      id: '1',
      text: TRANSLATIONS[language].welcome,
      sender: 'bot',
      timestamp: new Date()
    }]);
  }, [language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getBotResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase().trim();
    const responses = PREDEFINED_RESPONSES[language];
    
    // Check for keyword matches
    for (const [keyword, response] of Object.entries(responses)) {
      if (keyword !== 'default' && lowerMessage.includes(keyword)) {
        return response;
      }
    }
    
    // Default response
    return responses.default;
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Simulate bot response delay
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: getBotResponse(inputValue),
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const t = TRANSLATIONS[language];

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border-2 border-[var(--bounce-tan)]">
          {/* Header */}
          <div className="bg-[var(--bounce-dark)] text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--bounce-tan)] rounded-full flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-[var(--bounce-dark)]" />
              </div>
              <div>
                <h3 className="font-medium">{t.assistantName}</h3>
                <p className="text-xs text-gray-300">{t.online}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-[var(--bounce-tan)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === 'user'
                      ? 'bg-[var(--bounce-dark)] text-white'
                      : 'bg-white border-2 border-[var(--bounce-tan)] text-gray-800'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                  <p className={`text-xs mt-1 ${
                    message.sender === 'user' ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString(language === 'it' ? 'it-IT' : 'en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t-2 border-[var(--bounce-tan)] rounded-b-lg">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t.placeholder}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[var(--bounce-tan)] transition-colors"
              />
              <Button
                onClick={handleSendMessage}
                className="bg-[var(--bounce-orange)] hover:bg-[var(--bounce-gold)] text-white px-4 py-2"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {t.suggestions}
            </p>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-[var(--bounce-orange)] hover:bg-[var(--bounce-gold)] text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-50 border-4 border-[var(--bounce-tan)]"
        aria-label={t.openChat}
      >
        {isOpen ? (
          <X className="w-7 h-7" />
        ) : (
          <MessageCircle className="w-7 h-7" />
        )}
      </button>
    </>
  );
}
