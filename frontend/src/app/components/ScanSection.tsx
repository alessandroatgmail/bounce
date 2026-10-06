import { useCallback, useEffect, useRef, useState } from 'react';
import type jsQRType from 'jsqr';
import { toast } from 'sonner';
import { CameraOff, CheckCircle2, Loader2, ScanQrCode, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useEvents } from '../hooks/useEvents';
import { authFetch } from '../../lib/api';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';

const CHECK_IN_URL = '/api/scanner/check-in/';
const registerListUrl = (eventId: string) => `/api/scanner/register/${eventId}/`;
const attendanceUrl = (bookingId: number) => `/api/scanner/bookings/${bookingId}/attendance/`;
const logUrl = (eventId: string) => `/api/scanner/log/${eventId}/`;

type RegisterRow = {
  booking_id: number;
  first_name: string;
  last_name: string;
  status: string | null;
  attended: boolean;
};

const HOURS_BEFORE = 3;
const HOURS_AFTER = 6;

// The backend's start_date_before/end_date_after filters are date-only
// (no time-of-day), so they can only narrow things down to "the calendar
// day(s) this window touches" — the precise hour-level window is then
// applied client-side in filterToClassWindow below.
const classWindowQueryString = (): string => {
  const now = new Date();
  const before = new Date(now.getTime() - HOURS_BEFORE * 60 * 60 * 1000);
  const after = new Date(now.getTime() + HOURS_AFTER * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const asDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `start_date_before=${asDate(after)}&end_date_after=${asDate(before)}`;
};

const isInClassWindow = (startDate: string): boolean => {
  const now = Date.now();
  const start = new Date(startDate).getTime();
  return start >= now - HOURS_BEFORE * 60 * 60 * 1000 && start <= now + HOURS_AFTER * 60 * 60 * 1000;
};

type ScanOutcome = { kind: 'success' | 'warning' | 'error'; message: string; name?: string };

export function ScanSection() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { events: fetchedEvents, loading } = useEvents(accessToken, classWindowQueryString());
  const events = fetchedEvents.filter(ev => isInClassWindow(ev.start_date));
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<ScanOutcome | null>(null);
  const [tab, setTab] = useState<'scanner' | 'register'>('scanner');
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [logText, setLogText] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // Loaded lazily on first scan start — jsQR is only needed by staff who
  // actually open this tab, so it shouldn't bloat everyone else's bundle.
  const jsQRRef = useRef<typeof jsQRType | null>(null);

  const it = language === 'it';

  const formatTime = (iso: string): string =>
    new Date(iso).toLocaleTimeString(it ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const handleStopClick = () => {
    stopCamera();
    setLastOutcome(null);
    setProcessing(false);
  };

  const handleDecoded = useCallback(async (uuid: string) => {
    if (!accessToken || !selectedEventId) return;
    // A successful read stops the camera outright — the Start button comes
    // back on its own, and staff explicitly taps it again for the next scan.
    stopCamera();
    setLastOutcome(null);
    setProcessing(true);
    try {
      const res = await authFetch(CHECK_IN_URL, accessToken, {
        method: 'POST',
        body: JSON.stringify({ uuid, event_id: Number(selectedEventId) }),
      });
      const body = await res.json().catch(() => ({}));
      const name = [body.first_name, body.last_name].filter(Boolean).join(' ') || undefined;

      if (res.ok && (!body.errors || body.errors.length === 0)) {
        const message = it ? 'Check-in effettuato.' : 'Checked in.';
        setLastOutcome({ kind: 'success', message, name });
        toast.success(name ? `${message} — ${name}` : message);
      } else if (res.ok) {
        const message = (body.errors as string[]).join(' — ');
        setLastOutcome({ kind: 'warning', message, name });
        const prefix = it ? 'Check-in con avvisi' : 'Checked in with warnings';
        toast.warning(name ? `${prefix} — ${name}: ${message}` : `${prefix}: ${message}`);
      } else {
        const message = body.detail ?? `Error ${res.status}`;
        setLastOutcome({ kind: 'error', message, name });
        toast.error(name ? `${name}: ${message}` : message);
      }
    } catch {
      const message = it ? 'Richiesta di check-in non riuscita.' : 'Check-in request failed.';
      setLastOutcome({ kind: 'error', message });
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  }, [accessToken, selectedEventId, it, stopCamera]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQRRef.current?.(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleDecoded(code.data);
          return; // camera is stopping — don't schedule another frame
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [handleDecoded]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setLastOutcome(null);
    try {
      if (!jsQRRef.current) {
        const mod = await import('jsqr');
        jsQRRef.current = mod.default;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError(it
        ? "Impossibile accedere alla fotocamera. Controlla i permessi del browser."
        : "Couldn't access the camera. Check your browser permissions.");
    }
  }, [it, tick]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Switching class keeps whichever tab staff were on — only the data
  // underneath is stale and needs clearing, not their choice of view.
  useEffect(() => {
    setRegisterRows([]);
    setRegisterError(null);
    setLogText('');
    setNoteInput('');
  }, [selectedEventId]);

  const loadRegister = useCallback(async () => {
    if (!accessToken || !selectedEventId) return;
    setRegisterLoading(true);
    setRegisterError(null);
    try {
      const res = await authFetch(registerListUrl(selectedEventId), accessToken);
      if (!res.ok) throw new Error();
      const body = await res.json();
      setRegisterRows(body.rows);
    } catch {
      setRegisterError(it ? 'Impossibile caricare il registro.' : 'Could not load the register.');
    } finally {
      setRegisterLoading(false);
    }
  }, [accessToken, selectedEventId, it]);

  const loadLog = useCallback(async () => {
    if (!accessToken || !selectedEventId) return;
    try {
      const res = await authFetch(logUrl(selectedEventId), accessToken);
      if (!res.ok) throw new Error();
      const body = await res.json();
      setLogText(body.logs);
    } catch {
      // Notes are supplementary — a failed fetch just leaves the box
      // empty rather than blocking the register view.
    }
  }, [accessToken, selectedEventId]);

  useEffect(() => {
    if (tab === 'register' && selectedEventId) {
      loadRegister();
      loadLog();
    }
  }, [tab, selectedEventId, loadRegister, loadLog]);

  const handleAddNote = useCallback(async () => {
    if (!accessToken || !selectedEventId || !noteInput.trim()) return;
    setNoteSubmitting(true);
    try {
      const res = await authFetch(logUrl(selectedEventId), accessToken, {
        method: 'POST',
        body: JSON.stringify({ note: noteInput.trim() }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setLogText(body.logs);
      setNoteInput('');
    } catch {
      toast.error(it ? 'Impossibile salvare la nota.' : 'Could not save the note.');
    } finally {
      setNoteSubmitting(false);
    }
  }, [accessToken, selectedEventId, noteInput, it]);

  const handleToggleAttended = useCallback(async (bookingId: number, attended: boolean) => {
    if (!accessToken) return;
    // Optimistic update — staff are flipping these quickly in a room full
    // of people, the toggle should feel instant rather than wait on the network.
    setRegisterRows(rows => rows.map(r => r.booking_id === bookingId ? { ...r, attended } : r));
    try {
      const res = await authFetch(attendanceUrl(bookingId), accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ attended }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure.
      setRegisterRows(rows => rows.map(r => r.booking_id === bookingId ? { ...r, attended: !attended } : r));
      toast.error(it ? 'Aggiornamento non riuscito.' : 'Update failed.');
    }
  }, [accessToken, it]);

  const outcomeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  } as const;

  return (
    <div className="flex flex-col items-center gap-6 pt-6 select-none">
      <div className="w-full max-w-sm space-y-2">
        <Label>{it ? "Evento di oggi" : "Today's event"}</Label>
        <Select value={selectedEventId} onValueChange={setSelectedEventId} disabled={loading || events.length === 0 || cameraOn}>
          <SelectTrigger>
            <SelectValue
              placeholder={
                loading
                  ? (it ? 'Caricamento...' : 'Loading...')
                  : events.length === 0
                    ? (it ? 'Nessun evento oggi' : 'No events today')
                    : (it ? 'Seleziona un evento...' : 'Select an event...')
              }
            />
          </SelectTrigger>
          <SelectContent>
            {events.map(ev => (
              <SelectItem key={ev.id} value={String(ev.id)}>
                {ev.name} — {formatTime(ev.start_date)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedEventId ? (
        <p className="text-xs text-gray-400 text-center">
          {it ? "Seleziona prima l'evento di oggi." : "Select today's event first."}
        </p>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'scanner' | 'register')} className="w-full max-w-sm">
          <TabsList className="w-full">
            <TabsTrigger value="scanner" className="flex-1">{it ? 'Scanner' : 'Scanner'}</TabsTrigger>
            <TabsTrigger value="register" className="flex-1">{it ? 'Registro' : 'Register'}</TabsTrigger>
          </TabsList>

          <TabsContent value="scanner">
            <div className="w-full flex flex-col items-center gap-4">
              <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center">
                <video ref={videoRef} muted playsInline className={`w-full h-full object-cover ${cameraOn ? '' : 'hidden'}`} />
                <canvas ref={canvasRef} className="hidden" />
                {!cameraOn && (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    {cameraError ? <CameraOff className="size-12" /> : <ScanQrCode className="size-12" />}
                    <p className="text-xs text-center max-w-[80%]">
                      {cameraError ?? (it ? 'La fotocamera è spenta.' : 'Camera is off.')}
                    </p>
                  </div>
                )}
              </div>

              {/* The scan result lives here, between the camera and the button —
                  not overlaid on the feed, since the camera has already stopped
                  by the time there's anything to show. */}
              {processing ? (
                <div className="w-full flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm text-gray-500">
                  <Loader2 className="size-4 animate-spin" />
                  {it ? 'Elaborazione...' : 'Processing...'}
                </div>
              ) : lastOutcome ? (
                <div className={`w-full flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${outcomeStyles[lastOutcome.kind]}`}>
                  {lastOutcome.kind === 'success'
                    ? <CheckCircle2 className="size-4 mt-0.5 flex-shrink-0" />
                    : <XCircle className="size-4 mt-0.5 flex-shrink-0" />}
                  <div className="flex flex-col">
                    {lastOutcome.name && <span className="font-semibold">{lastOutcome.name}</span>}
                    <span>{lastOutcome.message}</span>
                  </div>
                </div>
              ) : null}

              {!cameraOn ? (
                <Button onClick={startCamera} disabled={!selectedEventId || processing} className="w-full">
                  <ScanQrCode className="size-4 mr-2" />
                  {it ? 'Avvia scanner' : 'Start scanning'}
                </Button>
              ) : (
                <Button onClick={handleStopClick} variant="outline" className="w-full">
                  {it ? 'Ferma scanner' : 'Stop scanning'}
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="register">
            <div className="w-full flex flex-col gap-2 pt-2">
              {registerLoading ? (
                <div className="w-full flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
                  <Loader2 className="size-4 animate-spin" />
                  {it ? 'Caricamento...' : 'Loading...'}
                </div>
              ) : registerError ? (
                <p className="text-sm text-red-600 text-center py-6">{registerError}</p>
              ) : registerRows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  {it ? 'Nessun partecipante.' : 'No participants.'}
                </p>
              ) : (
                registerRows.map(row => (
                  <div
                    key={row.booking_id}
                    className="w-full flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">
                        {row.first_name} {row.last_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {row.status ?? (it ? 'nessuna contribuzione' : 'no contribution')}
                      </span>
                    </div>
                    <Switch
                      checked={row.attended}
                      onCheckedChange={(checked) => handleToggleAttended(row.booking_id, checked)}
                    />
                  </div>
                ))
              )}

              <div className="w-full flex flex-col gap-2 pt-4 border-t mt-2">
                <Label>{it ? 'Note' : 'Notes'}</Label>
                {logText && (
                  <pre className="w-full max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    {logText}
                  </pre>
                )}
                <Textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder={it
                    ? 'Es: Mario Rossi presente, non nel registro...'
                    : 'E.g. Mario Rossi attended, not on the register...'}
                  disabled={noteSubmitting}
                />
                <Button
                  onClick={handleAddNote}
                  disabled={noteSubmitting || !noteInput.trim()}
                  className="w-full"
                  variant="outline"
                >
                  {it ? 'Aggiungi nota' : 'Add note'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
