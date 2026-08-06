import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Navigate, useNavigate, useParams, useLocation } from 'react-router';
import { ArrowLeft, Globe, Loader2, CheckCircle2, CalendarClock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { authFetch } from '../../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useEvents, type EventItem } from '../hooks/useEvents';
import { useEventDescriptions } from '../hooks/useEventDescriptions';
import { RichHtmlEditor } from '../components/RichHtmlEditor';
import { ScheduleBlockExtension } from '../components/tiptap/ScheduleBlockExtension';
import { renderEventDescriptionHtml } from '../../lib/eventDescriptionBlocks';

const EDITOR_EXTENSIONS = [ScheduleBlockExtension];

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
];

export function EventDescriptionEditorPage() {
  const { user, accessToken } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId } = useParams();
  const backTo = (location.state as { from?: string } | null)?.from ?? '/admin';

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!accessToken || !eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/events/events/${eventId}/`, accessToken);
      if (!res.ok) throw new Error(`${res.status}`);
      setEvent(await res.json());
    } catch {
      setError(language === 'it' ? "Errore nel caricamento dell'evento." : 'Failed to load the event.');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, eventId, language]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  const { descriptions, loading: descLoading, fetchForEvent, save } = useEventDescriptions(accessToken);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].code);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedLanguage, setSavedLanguage] = useState<string | null>(null);

  useEffect(() => {
    if (eventId) fetchForEvent(Number(eventId));
  }, [eventId, fetchForEvent]);

  // Seed drafts from loaded descriptions without clobbering in-progress edits
  // (e.g. after a save triggers a refetch for another language's tab).
  useEffect(() => {
    setDrafts(prev => {
      const next = { ...prev };
      for (const d of descriptions) {
        if (!(d.language in next)) next[d.language] = d.desc;
      }
      return next;
    });
  }, [descriptions]);

  const existingFor = (code: string) => descriptions.find(d => d.language === code);
  const currentText = drafts[selectedLanguage] ?? '';

  // Children of this event (a festival's sub-events), used to resolve the
  // Schedule block live — so it always reflects their current room/time.
  const { events: allEvents } = useEvents(accessToken);
  const children = useMemo(
    () => (event ? allEvents.filter(e => event.events.includes(e.id)) : []),
    [event, allEvents],
  );

  const editorBlocks = useMemo(() => [
    {
      label: language === 'it' ? 'Inserisci blocco orario' : 'Insert schedule block',
      icon: <CalendarClock className="size-3.5" />,
      onInsert: (editor: Editor) => {
        editor.chain().focus().insertContent({ type: 'eventScheduleBlock' }).run();
      },
    },
  ], [language]);

  const handleSave = async () => {
    if (!eventId) return;
    setSaving(true);
    setSaveError(null);
    setSavedLanguage(null);
    try {
      const existing = existingFor(selectedLanguage);
      await save(Number(eventId), selectedLanguage, currentText, existing?.id);
      setSavedLanguage(selectedLanguage);
    } catch {
      setSaveError(language === 'it' ? 'Errore durante il salvataggio.' : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(backTo)}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="size-4" />
          {language === 'it' ? 'Torna agli eventi' : 'Back to events'}
        </Button>

        <div className="flex items-center gap-2 mb-6">
          <Globe className="size-6 text-[#e67e22]" />
          <div>
            <h1 className="text-2xl font-bold text-[#2b2b2b]">
              {language === 'it' ? 'Descrizione Evento' : 'Event Description'}
            </h1>
            {event && <p className="text-sm text-gray-600">{event.name}</p>}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="size-6 animate-spin text-[#e67e22]" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Tabs
                value={selectedLanguage}
                onValueChange={v => { setSelectedLanguage(v); setSaveError(null); setSavedLanguage(null); }}
              >
                <TabsList>
                  {LANGUAGES.map(l => (
                    <TabsTrigger key={l.code} value={l.code} className="flex items-center gap-1.5">
                      {l.label}
                      {existingFor(l.code) && <CheckCircle2 className="size-3.5 text-green-600" />}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {LANGUAGES.map(l => (
                  <TabsContent key={l.code} value={l.code} className="mt-4 space-y-4">
                    {descLoading && !(l.code in drafts) ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="size-5 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      <RichHtmlEditor
                        value={drafts[l.code] ?? ''}
                        onChange={html => setDrafts(prev => ({ ...prev, [l.code]: html }))}
                        extraExtensions={EDITOR_EXTENSIONS}
                        blocks={editorBlocks}
                      />
                    )}

                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white"
                      >
                        {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                        {language === 'it' ? 'Salva' : 'Save'}
                      </Button>
                      {savedLanguage === l.code && (
                        <span className="text-sm text-green-700">
                          {language === 'it' ? 'Salvato.' : 'Saved.'}
                        </span>
                      )}
                      {saveError && selectedLanguage === l.code && (
                        <span className="text-sm text-red-600">{saveError}</span>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#2b2b2b] uppercase tracking-wide mb-2">
                        {language === 'it' ? 'Anteprima' : 'Preview'}
                      </p>
                      <div
                        className="prose prose-sm max-w-none border rounded-md px-4 py-3 [&_.event-schedule-table]:w-full [&_.event-schedule-table]:border-collapse [&_.event-schedule-table_td]:border [&_.event-schedule-table_th]:border [&_.event-schedule-table_td]:p-2 [&_.event-schedule-table_th]:p-2 [&_.event-schedule-table_th]:bg-[#d4b896]/20 [&_.event-schedule-table_th]:text-left"
                        dangerouslySetInnerHTML={{ __html: renderEventDescriptionHtml(drafts[l.code] ?? '', children) }}
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
