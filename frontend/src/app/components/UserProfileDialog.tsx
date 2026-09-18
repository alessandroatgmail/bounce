import { useEffect, useState } from 'react';
import { Loader2, User, Home, CreditCard, ShieldCheck, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { authFetch } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { CitySearch, type CityResult } from './CitySearch';

interface NestedNamed {
  id: number;
  name: string;
}

export interface AdminUserProfile {
  id: number;
  uuid: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  date_of_birth: string | null;
  place_of_birth: NestedNamed | null;
  ci: string;
  address: string;
  city: NestedNamed | null;
  postal_code: string;
  country: NestedNamed | null;
  acsi: boolean;
  acsi_number: string | null;
  acsi_starting_date: string | null;
  acsi_expiration_date: string | null;
  privacy_consent: boolean;
  marketing_consent: boolean;
  is_active: boolean;
  date_joined: string;
  profile_image: string | null;
}

interface Props {
  userId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EditSection = 'personal' | 'address' | 'acsi' | 'consents' | null;

function FieldRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 text-sm border-b last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-[#2b2b2b] font-medium">{value ?? '—'}</span>
    </div>
  );
}

export function UserProfileDialog({ userId, open, onOpenChange }: Props) {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const it = language === 'it';
  const locale = it ? 'it-IT' : 'en-GB';
  const t = (itText: string, enText: string) => (it ? itText : enText);

  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingSection, setEditingSection] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [personalDraft, setPersonalDraft] = useState({
    first_name: '', last_name: '', phone: '', date_of_birth: '',
    place_of_birth_id: null as number | null, place_of_birth_name: '', ci: '',
  });
  const [addressDraft, setAddressDraft] = useState({
    address: '', postal_code: '',
    city_id: null as number | null, city_name: '',
    country_id: null as number | null, country_name: '',
  });
  const [acsiDraft, setAcsiDraft] = useState({ acsi: false, acsi_number: '', acsi_starting_date: '' });
  const [consentsDraft, setConsentsDraft] = useState({ privacy_consent: false, marketing_consent: false });

  useEffect(() => {
    if (!open || !userId || !accessToken) return;
    setProfile(null);
    setError(null);
    setEditingSection(null);
    setLoading(true);
    authFetch(`/api/auth/users/${userId}/`, accessToken)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(setProfile)
      .catch(() => setError(it ? 'Impossibile caricare il profilo.' : 'Failed to load profile.'))
      .finally(() => setLoading(false));
  }, [open, userId, accessToken, it]);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  const startEditing = (section: NonNullable<EditSection>) => {
    if (!profile) return;
    setSaveError(null);
    if (section === 'personal') {
      setPersonalDraft({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        phone: profile.phone ?? '',
        date_of_birth: profile.date_of_birth ?? '',
        place_of_birth_id: profile.place_of_birth?.id ?? null,
        place_of_birth_name: profile.place_of_birth?.name ?? '',
        ci: profile.ci ?? '',
      });
    } else if (section === 'address') {
      setAddressDraft({
        address: profile.address ?? '',
        postal_code: profile.postal_code ?? '',
        city_id: profile.city?.id ?? null,
        city_name: profile.city?.name ?? '',
        country_id: profile.country?.id ?? null,
        country_name: profile.country?.name ?? '',
      });
    } else if (section === 'acsi') {
      setAcsiDraft({
        acsi: profile.acsi ?? false,
        acsi_number: profile.acsi_number ?? '',
        acsi_starting_date: profile.acsi_starting_date ?? '',
      });
    } else if (section === 'consents') {
      setConsentsDraft({
        privacy_consent: profile.privacy_consent ?? false,
        marketing_consent: profile.marketing_consent ?? false,
      });
    }
    setEditingSection(section);
  };

  const handleSave = async (section: NonNullable<EditSection>) => {
    if (!accessToken || !userId) return;
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
        acsi_number: acsiDraft.acsi_number || null,
        acsi_starting_date: acsiDraft.acsi_starting_date || null,
      };
    } else if (section === 'consents') {
      payload = {
        privacy_consent: consentsDraft.privacy_consent,
        marketing_consent: consentsDraft.marketing_consent,
      };
    }

    try {
      const res = await authFetch(`/api/auth/users/${userId}/`, accessToken, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setProfile(await res.json());
        setEditingSection(null);
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

  const EditActions = ({ section }: { section: NonNullable<EditSection> }) => (
    <div className="flex flex-col gap-2 pt-3">
      {saveError && <p className="text-sm text-red-500">{saveError}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => handleSave(section)} disabled={saving}>
          {saving ? t('Salvataggio...', 'Saving...') : t('Salva', 'Save')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditingSection(null)} disabled={saving}>
          {t('Annulla', 'Cancel')}
        </Button>
      </div>
    </div>
  );

  const EditButton = ({ section }: { section: NonNullable<EditSection> }) => (
    <Button
      size="sm"
      variant="outline"
      className="mt-3 flex items-center gap-1.5"
      onClick={() => startEditing(section)}
      disabled={editingSection !== null}
    >
      <Pencil className="size-3.5" />
      {t('Modifica', 'Edit')}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {profile ? `${profile.first_name} ${profile.last_name}` : (it ? 'Profilo' : 'Profile')}
          </DialogTitle>
          <DialogDescription>
            {it ? 'Dati completi del profilo' : 'Full profile data'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 py-4">{error}</p>
        ) : profile && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-14">
                <AvatarImage src={profile.profile_image ?? undefined} />
                <AvatarFallback>{profile.first_name[0]}{profile.last_name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{profile.first_name} {profile.last_name}</p>
                <p className="text-sm text-gray-500">{profile.email}</p>
              </div>
              <Badge variant={profile.is_active ? 'default' : 'outline'} className="ml-auto">
                {profile.is_active ? t('Attivo', 'Active') : t('Non attivo', 'Inactive')}
              </Badge>
            </div>

            <Accordion type="multiple" defaultValue={['personal']} className="w-full">
              {/* Personal */}
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
                      <FieldRow label={t('Nome', 'First Name')} value={profile.first_name} />
                      <FieldRow label={t('Cognome', 'Last Name')} value={profile.last_name} />
                      <FieldRow label={t('Telefono', 'Phone')} value={profile.phone} />
                      <FieldRow label={t('Data di Nascita', 'Date of Birth')} value={formatDate(profile.date_of_birth)} />
                      <FieldRow label={t('Luogo di Nascita', 'Place of Birth')} value={profile.place_of_birth?.name} />
                      <FieldRow label={t('Codice Fiscale / N.I.', 'Fiscal Code / N.I.')} value={profile.ci} />
                      <EditButton section="personal" />
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
                                ...p, city_id: city.id, city_name: city.name,
                                country_id: city.country_id, country_name: city.country_name,
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
                      <FieldRow label={t('Via', 'Street Address')} value={profile.address} />
                      <FieldRow label={t('Città', 'City')} value={profile.city?.name} />
                      <FieldRow label={t('CAP', 'Postal Code')} value={profile.postal_code} />
                      <FieldRow label={t('Paese', 'Country')} value={profile.country?.name} />
                      <EditButton section="address" />
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
                              ...p, acsi: v,
                              acsi_number: v ? p.acsi_number : '',
                              acsi_starting_date: v ? p.acsi_starting_date : '',
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
                              value={acsiDraft.acsi_number}
                              onChange={e => setAcsiDraft(p => ({ ...p, acsi_number: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>{t('Data Iscrizione', 'Starting Date')}</Label>
                            <Input
                              type="date"
                              value={acsiDraft.acsi_starting_date}
                              onChange={e => setAcsiDraft(p => ({ ...p, acsi_starting_date: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>{t('Data Scadenza', 'Expiry Date')}</Label>
                            <Input type="date" value={profile.acsi_expiration_date ?? ''} disabled readOnly />
                          </div>
                        </div>
                      )}
                      <EditActions section="acsi" />
                    </div>
                  ) : (
                    <div>
                      <FieldRow label={t('Tesserato ACSI', 'ACSI Member')} value={profile.acsi ? t('Sì', 'Yes') : 'No'} />
                      {profile.acsi && (
                        <>
                          <FieldRow label={t('Numero Tessera', 'Membership Number')} value={profile.acsi_number} />
                          <FieldRow label={t('Data Iscrizione', 'Starting Date')} value={formatDate(profile.acsi_starting_date)} />
                          <FieldRow label={t('Scadenza', 'Expiry Date')} value={formatDate(profile.acsi_expiration_date)} />
                        </>
                      )}
                      <EditButton section="acsi" />
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
                          {consentsDraft.privacy_consent === false && (
                            <p className="text-xs text-red-500 mt-1">
                              {t('Disattivare disattiverà l\'account di questo utente', 'Disabling will deactivate this user\'s account')}
                            </p>
                          )}
                        </div>
                        <Switch
                          checked={consentsDraft.privacy_consent}
                          onCheckedChange={v => setConsentsDraft(p => ({ ...p, privacy_consent: v }))}
                        />
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <p className="text-sm font-medium">{t('Marketing', 'Marketing')}</p>
                        <Switch
                          checked={consentsDraft.marketing_consent}
                          onCheckedChange={v => setConsentsDraft(p => ({ ...p, marketing_consent: v }))}
                        />
                      </div>
                      <EditActions section="consents" />
                    </div>
                  ) : (
                    <div>
                      <FieldRow label={t('Consenso privacy', 'Privacy consent')} value={profile.privacy_consent ? t('Sì', 'Yes') : 'No'} />
                      <FieldRow label={t('Consenso marketing', 'Marketing consent')} value={profile.marketing_consent ? t('Sì', 'Yes') : 'No'} />
                      <EditButton section="consents" />
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1">{t('Altro', 'Other')}</h4>
              <FieldRow label={t('Ruolo', 'Role')} value={profile.role} />
              <FieldRow label={t('Iscritto il', 'Joined')} value={formatDate(profile.date_joined)} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
