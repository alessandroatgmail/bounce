import { useRef, useState } from 'react';
import { FileText, Camera, User, Home, CreditCard, ShieldCheck, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiUrl } from '../../lib/api';
import { mockDocuments } from '../data/mockData';
import { CitySearch, type CityResult } from './CitySearch';

type EditSection = 'personal' | 'address' | 'acsi' | 'consents' | null;

function FieldRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-2 text-sm border-b last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-[#2b2b2b] font-medium">{value ?? '—'}</span>
    </div>
  );
}

export function ProfileSection() {
  const { user, accessToken, updateUser, logout } = useAuth();
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingSection, setEditingSection] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [personalDraft, setPersonalDraft] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    date_of_birth: '',
    place_of_birth_id: null as number | null,
    place_of_birth_name: '',
    ci: '',
  });

  const [addressDraft, setAddressDraft] = useState({
    address: '',
    postal_code: '',
    city_id: null as number | null,
    city_name: '',
    country_id: null as number | null,
    country_name: '',
  });

  const [acsiDraft, setAcsiDraft] = useState({
    acsi: false,
    acsi_number: '',
    acsi_expiration_date: '',
  });

  const [consentsDraft, setConsentsDraft] = useState({
    privacy_consent: false,
    marketing_consent: false,
  });
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!user) return null;

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  const t = (it: string, en: string) => language === 'it' ? it : en;

  const formatDate = (d?: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const startEditing = (section: NonNullable<EditSection>) => {
    setSaveError(null);
    if (section === 'personal') {
      setPersonalDraft({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        phone: user.phone ?? '',
        date_of_birth: user.date_of_birth ?? '',
        place_of_birth_id: user.place_of_birth?.id ?? null,
        place_of_birth_name: user.place_of_birth?.name ?? '',
        ci: user.ci ?? '',
      });
    } else if (section === 'address') {
      setAddressDraft({
        address: user.address ?? '',
        postal_code: user.postal_code ?? '',
        city_id: user.city?.id ?? null,
        city_name: user.city?.name ?? '',
        country_id: user.country?.id ?? null,
        country_name: user.country?.name ?? '',
      });
    } else if (section === 'acsi') {
      setAcsiDraft({
        acsi: user.acsi ?? false,
        acsi_number: user.acsi_number ? String(user.acsi_number) : '',
        acsi_expiration_date: user.acsi_expiration_date ?? '',
      });
    } else if (section === 'consents') {
      setConsentsDraft({
        privacy_consent: user.privacy_consent ?? false,
        marketing_consent: user.marketing_consent ?? false,
      });
    }
    setEditingSection(section);
  };

  const handleSave = async (section: NonNullable<EditSection>) => {
    if (!accessToken) return;
    setSaving(true);
    setSaveError(null);

    let payload: Record<string, unknown> = {};
    if (section === 'personal') {
      payload = {
        first_name: personalDraft.first_name,
        last_name: personalDraft.last_name,
        phone: personalDraft.phone,
        date_of_birth: personalDraft.date_of_birth || null,
        place_of_birth: personalDraft.place_of_birth_id,
        ci: personalDraft.ci,
      };
    } else if (section === 'address') {
      payload = {
        address: addressDraft.address,
        postal_code: addressDraft.postal_code,
        city: addressDraft.city_id,
        country: addressDraft.country_id,
      };
    } else if (section === 'acsi') {
      payload = {
        acsi: acsiDraft.acsi,
        acsi_number: acsiDraft.acsi_number ? Number(acsiDraft.acsi_number) : null,
        acsi_expiration_date: acsiDraft.acsi_expiration_date || null,
      };
    } else if (section === 'consents') {
      payload = {
        privacy_consent: consentsDraft.privacy_consent,
        marketing_consent: consentsDraft.marketing_consent,
      };
    }

    try {
      const res = await fetch(apiUrl('/api/auth/me/'), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        updateUser({
          name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          date_of_birth: data.date_of_birth,
          place_of_birth: data.place_of_birth,
          ci: data.ci,
          address: data.address,
          city: data.city,
          postal_code: data.postal_code,
          country: data.country,
          acsi: data.acsi,
          acsi_number: data.acsi_number,
          acsi_expiration_date: data.acsi_expiration_date,
          privacy_consent: data.privacy_consent,
          marketing_consent: data.marketing_consent,
        });
        setEditingSection(null);
        if (data.is_active === false) {
          logout();
          return;
        }
      } else {
        const errData = await res.json();
        const msgs = Object.values(errData).flat().join('; ');
        setSaveError(msgs || t('Errore nel salvataggio.', 'Save failed.'));
      }
    } catch {
      setSaveError(t('Errore di rete.', 'Network error.'));
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setUploading(true);
    const form = new FormData();
    form.append('profile_image', file);
    try {
      const res = await fetch(apiUrl('/api/auth/me/'), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        updateUser({ profile_image: data.profile_image });
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeactivate = async () => {
    if (!accessToken) return;
    setActionLoading(true);
    try {
      await fetch(apiUrl('/api/auth/me/deactivate/'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } finally {
      setActionLoading(false);
      logout();
    }
  };

  const handleDelete = async () => {
    if (!accessToken) return;
    setActionLoading(true);
    try {
      await fetch(apiUrl('/api/auth/me/'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } finally {
      setActionLoading(false);
      logout();
    }
  };

  const EditActions = ({ section }: { section: NonNullable<EditSection> }) => (
    <div className="flex gap-2 pt-3">
      <Button
        size="sm"
        onClick={() => handleSave(section)}
        disabled={saving}
        className="bg-[#e67e22] hover:bg-[#d4b896] text-white"
      >
        {saving ? t('Salvataggio...', 'Saving...') : t('Salva', 'Save')}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setEditingSection(null)} disabled={saving}>
        {t('Annulla', 'Cancel')}
      </Button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <Tabs defaultValue="profile">
        <TabsList className="bg-[#2b2b2b] mb-6">
          <TabsTrigger value="profile" className="data-[state=active]:bg-[#e67e22] data-[state=active]:text-white text-gray-300">
            {t('Profilo', 'Profile')}
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-[#e67e22] data-[state=active]:text-white text-gray-300">
            {t('Documenti', 'Documents')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar className="size-20">
                    {user.profile_image && (
                      <AvatarImage src={user.profile_image} alt={user.name} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-[#e67e22] text-white text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 bg-[#e67e22] text-white rounded-full p-1 shadow hover:bg-[#d4b896] transition-colors disabled:opacity-50"
                    title={t('Cambia foto', 'Change photo')}
                  >
                    <Camera className="size-3.5" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#2b2b2b]">{user.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
                </div>
              </div>

              {saveError && (
                <Alert variant="destructive">
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              )}

              <AlertDialog open={showPrivacyWarning} onOpenChange={setShowPrivacyWarning}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('Attenzione', 'Warning')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t(
                        'Revocare il consenso alla privacy disattiverà il tuo account e verrai disconnesso immediatamente. Questa azione non può essere annullata da te.',
                        'Revoking your privacy consent will deactivate your account and you will be logged out immediately. This action cannot be undone by you.',
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowPrivacyWarning(false)}>
                      {t('Annulla', 'Cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => {
                        setConsentsDraft(p => ({ ...p, privacy_consent: false }));
                        setShowPrivacyWarning(false);
                      }}
                    >
                      {t('Confermo, disattiva account', 'Confirm, deactivate account')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Accordion type="multiple" defaultValue={['personal']}>

                {/* Personal Info */}
                <AccordionItem value="personal">
                  <AccordionTrigger className="font-semibold text-[#2b2b2b]">
                    <span className="flex items-center gap-2">
                      <User className="size-4 text-[#e67e22]" />
                      {t('Informazioni Personali', 'Personal Information')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {editingSection === 'personal' ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>{t('Nome', 'First Name')}</Label>
                            <Input
                              value={personalDraft.first_name}
                              onChange={e => setPersonalDraft(p => ({ ...p, first_name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>{t('Cognome', 'Last Name')}</Label>
                            <Input
                              value={personalDraft.last_name}
                              onChange={e => setPersonalDraft(p => ({ ...p, last_name: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>{t('Telefono', 'Phone')}</Label>
                          <Input
                            type="tel"
                            value={personalDraft.phone}
                            onChange={e => setPersonalDraft(p => ({ ...p, phone: e.target.value }))}
                            placeholder="+39 333 1234567"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>{t('Data di Nascita', 'Date of Birth')}</Label>
                            <Input
                              type="date"
                              value={personalDraft.date_of_birth}
                              onChange={e => setPersonalDraft(p => ({ ...p, date_of_birth: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>{t('Luogo di Nascita', 'Place of Birth')}</Label>
                            <CitySearch
                              value={personalDraft.place_of_birth_id}
                              displayValue={personalDraft.place_of_birth_name}
                              onSelect={(city: CityResult) =>
                                setPersonalDraft(p => ({ ...p, place_of_birth_id: city.id, place_of_birth_name: city.name }))
                              }
                              placeholder={t('Cerca città...', 'Search city...')}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>{t('Codice Fiscale / N.I.', 'Fiscal Code / N.I.')}</Label>
                          <Input
                            value={personalDraft.ci}
                            onChange={e => setPersonalDraft(p => ({ ...p, ci: e.target.value }))}
                          />
                        </div>
                        <EditActions section="personal" />
                      </div>
                    ) : (
                      <div>
                        <FieldRow label={t('Nome', 'First Name')} value={user.first_name} />
                        <FieldRow label={t('Cognome', 'Last Name')} value={user.last_name} />
                        <FieldRow label={t('Telefono', 'Phone')} value={user.phone} />
                        <FieldRow label={t('Data di Nascita', 'Date of Birth')} value={formatDate(user.date_of_birth)} />
                        <FieldRow label={t('Luogo di Nascita', 'Place of Birth')} value={user.place_of_birth?.name} />
                        <FieldRow label={t('Codice Fiscale / N.I.', 'Fiscal Code / N.I.')} value={user.ci} />
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 flex items-center gap-1.5"
                          onClick={() => startEditing('personal')}
                          disabled={editingSection !== null}
                        >
                          <Pencil className="size-3.5" />
                          {t('Modifica', 'Edit')}
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Address */}
                <AccordionItem value="address">
                  <AccordionTrigger className="font-semibold text-[#2b2b2b]">
                    <span className="flex items-center gap-2">
                      <Home className="size-4 text-[#e67e22]" />
                      {t('Indirizzo', 'Address')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {editingSection === 'address' ? (
                      <div className="space-y-3">
                        <div>
                          <Label>{t('Via', 'Street Address')}</Label>
                          <Input
                            value={addressDraft.address}
                            onChange={e => setAddressDraft(p => ({ ...p, address: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label>{t('CAP', 'Postal Code')}</Label>
                            <Input
                              value={addressDraft.postal_code}
                              onChange={e => setAddressDraft(p => ({ ...p, postal_code: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>{t('Città', 'City')}</Label>
                            <CitySearch
                              value={addressDraft.city_id}
                              displayValue={addressDraft.city_name}
                              onSelect={(city: CityResult) =>
                                setAddressDraft(p => ({
                                  ...p,
                                  city_id: city.id,
                                  city_name: city.name,
                                  country_id: city.country_id,
                                  country_name: city.country_name,
                                }))
                              }
                              placeholder={t('Cerca città...', 'Search city...')}
                            />
                          </div>
                          <div>
                            <Label>{t('Paese', 'Country')}</Label>
                            <Input
                              value={addressDraft.country_name}
                              readOnly
                              className="bg-muted cursor-not-allowed"
                              placeholder={t('Auto dalla città', 'Auto from city')}
                            />
                          </div>
                        </div>
                        <EditActions section="address" />
                      </div>
                    ) : (
                      <div>
                        <FieldRow label={t('Via', 'Street Address')} value={user.address} />
                        <FieldRow label={t('Città', 'City')} value={user.city?.name} />
                        <FieldRow label={t('CAP', 'Postal Code')} value={user.postal_code} />
                        <FieldRow label={t('Paese', 'Country')} value={user.country?.name} />
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 flex items-center gap-1.5"
                          onClick={() => startEditing('address')}
                          disabled={editingSection !== null}
                        >
                          <Pencil className="size-3.5" />
                          {t('Modifica', 'Edit')}
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* ACSI */}
                <AccordionItem value="acsi">
                  <AccordionTrigger className="font-semibold text-[#2b2b2b]">
                    <span className="flex items-center gap-2">
                      <CreditCard className="size-4 text-[#e67e22]" />
                      {t('Tesseramento ACSI', 'ACSI Membership')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {editingSection === 'acsi' ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Switch
                            id="acsi-toggle"
                            checked={acsiDraft.acsi}
                            onCheckedChange={v =>
                              setAcsiDraft(p => ({
                                ...p,
                                acsi: v,
                                acsi_number: v ? p.acsi_number : '',
                                acsi_expiration_date: v ? p.acsi_expiration_date : '',
                              }))
                            }
                          />
                          <Label htmlFor="acsi-toggle">{t('Tesserato ACSI', 'ACSI Member')}</Label>
                        </div>
                        {acsiDraft.acsi && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>{t('Numero Tessera', 'Membership Number')}</Label>
                              <Input
                                type="number"
                                value={acsiDraft.acsi_number}
                                onChange={e => setAcsiDraft(p => ({ ...p, acsi_number: e.target.value }))}
                              />
                            </div>
                            <div>
                              <Label>{t('Data Scadenza', 'Expiry Date')}</Label>
                              <Input
                                type="date"
                                value={acsiDraft.acsi_expiration_date}
                                onChange={e => setAcsiDraft(p => ({ ...p, acsi_expiration_date: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}
                        <EditActions section="acsi" />
                      </div>
                    ) : (
                      <div>
                        <FieldRow
                          label={t('Tesserato ACSI', 'ACSI Member')}
                          value={user.acsi ? t('Sì', 'Yes') : t('No', 'No')}
                        />
                        {user.acsi && (
                          <>
                            <FieldRow
                              label={t('Numero Tessera', 'Membership Number')}
                              value={user.acsi_number ?? null}
                            />
                            <FieldRow
                              label={t('Scadenza', 'Expiry Date')}
                              value={formatDate(user.acsi_expiration_date)}
                            />
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 flex items-center gap-1.5"
                          onClick={() => startEditing('acsi')}
                          disabled={editingSection !== null}
                        >
                          <Pencil className="size-3.5" />
                          {t('Modifica', 'Edit')}
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Consents */}
                <AccordionItem value="consents">
                  <AccordionTrigger className="font-semibold text-[#2b2b2b]">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-[#e67e22]" />
                      {t('Consensi', 'Consents')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {editingSection === 'consents' ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between py-3 border-b">
                          <div>
                            <p className="text-sm font-medium">{t('Privacy Policy', 'Privacy Policy')}</p>
                            <p className="text-xs text-gray-500">
                              {t('Consenso al trattamento dei dati personali', 'Consent to personal data processing')}
                            </p>
                            {consentsDraft.privacy_consent && (
                              <p className="text-xs text-red-500 mt-1">
                                {t('Disattivare revocherà il tuo account', 'Disabling will deactivate your account')}
                              </p>
                            )}
                          </div>
                          <Switch
                            checked={consentsDraft.privacy_consent}
                            onCheckedChange={v => {
                              if (!v) {
                                setShowPrivacyWarning(true);
                              } else {
                                setConsentsDraft(p => ({ ...p, privacy_consent: true }));
                              }
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-sm font-medium">{t('Marketing', 'Marketing')}</p>
                            <p className="text-xs text-gray-500">
                              {t('Ricezione di comunicazioni e newsletter', 'Receiving communications and newsletters')}
                            </p>
                          </div>
                          <Switch
                            checked={consentsDraft.marketing_consent}
                            onCheckedChange={v => setConsentsDraft(p => ({ ...p, marketing_consent: v }))}
                          />
                        </div>
                        <EditActions section="consents" />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between py-3 border-b">
                          <div>
                            <p className="text-sm font-medium">{t('Privacy Policy', 'Privacy Policy')}</p>
                            <p className="text-xs text-gray-500">
                              {t('Trattamento dati personali', 'Personal data processing')}
                            </p>
                          </div>
                          <Badge className={user.privacy_consent ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}>
                            {user.privacy_consent ? t('Accettata', 'Accepted') : t('Non accettata', 'Not accepted')}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between py-3">
                          <div>
                            <p className="text-sm font-medium">{t('Marketing', 'Marketing')}</p>
                            <p className="text-xs text-gray-500">
                              {t('Comunicazioni e newsletter', 'Communications and newsletters')}
                            </p>
                          </div>
                          <Badge className={user.marketing_consent ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}>
                            {user.marketing_consent ? t('Accettato', 'Opted in') : t('Non accettato', 'Opted out')}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1 flex items-center gap-1.5"
                          onClick={() => startEditing('consents')}
                          disabled={editingSection !== null}
                        >
                          <Pencil className="size-3.5" />
                          {t('Modifica', 'Edit')}
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

              </Accordion>

              {/* Danger zone */}
              <div className="border border-red-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-red-600">
                  {t('Zona pericolosa', 'Danger zone')}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-orange-400 text-orange-600 hover:bg-orange-50"
                    onClick={() => setShowDeactivateDialog(true)}
                    disabled={actionLoading}
                  >
                    {t('Disattiva account', 'Deactivate account')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500 text-red-600 hover:bg-red-50"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={actionLoading}
                  >
                    {t('Elimina account', 'Delete account')}
                  </Button>
                </div>
              </div>

              {/* Deactivate dialog */}
              <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('Disattiva account', 'Deactivate account')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t(
                        'Il tuo account verrà disattivato e verrai disconnesso. I tuoi dati verranno conservati. Contatta l\'amministratore per riattivarlo.',
                        'Your account will be deactivated and you will be logged out. Your data will be kept. Contact an administrator to reactivate it.',
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('Annulla', 'Cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={handleDeactivate}
                    >
                      {t('Disattiva', 'Deactivate')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete / anonymize dialog */}
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600">
                      {t('Elimina account', 'Delete account')}
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>
                          {t(
                            'Questa azione è irreversibile. Il tuo account verrà anonimizzato:',
                            'This action is irreversible. Your account will be anonymized:',
                          )}
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>{t('Email sostituita con un indirizzo non rintracciabile', 'Email replaced with a non-traceable address')}</li>
                          <li>{t('Tutti i dati personali cancellati', 'All personal data deleted')}</li>
                          <li>{t('Consensi revocati e account disattivato', 'Consents revoked and account deactivated')}</li>
                        </ul>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('Annulla', 'Cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleDelete}
                    >
                      {t('Elimina definitivamente', 'Delete permanently')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                {t('Documenti', 'Documents')}
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Nome', 'Name')}</TableHead>
                    <TableHead>{t('Data', 'Date')}</TableHead>
                    <TableHead>{t('Tipo', 'Type')}</TableHead>
                    <TableHead>{t('Azioni', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockDocuments.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-mono text-sm">{doc.name}</TableCell>
                      <TableCell>
                        {new Date(doc.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="font-semibold">{doc.type}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="size-4" />
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                            {t('Visualizza', 'View')}
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
