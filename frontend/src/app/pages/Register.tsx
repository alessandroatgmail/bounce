import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { CitySearch, type CityResult } from '../components/CitySearch';
import { apiUrl } from '../../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

// Maps backend field names to frontend field names for error display
const backendToFrontend: Record<string, string> = {
  first_name: 'name',
  last_name: 'surname',
  address: 'street',
  postal_code: 'postcode',
  place_of_birth: 'placeOfBirth',
  date_of_birth: 'dateOfBirth',
  ci: 'fiscalCode',
  acsi_number: 'acsiNumber',
  acsi_starting_date: 'acsiStartingDate',
  privacy_consent: 'termsAccepted',
  marketing_consent: 'marketingConsent',
};

export function Register() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    street: '',
    postcode: '',
    city: '',
    cityName: '',
    country: '',
    countryName: '',
    placeOfBirth: '',
    placeOfBirthName: '',
    dateOfBirth: '',
    fiscalCode: '',
    acsiNumber: '',
    acsiStartingDate: '',
    isAcsiMember: false,
    termsAccepted: false,
    marketingConsent: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAcsiMemberChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isAcsiMember: checked,
      acsiNumber: checked ? prev.acsiNumber : '',
      acsiStartingDate: checked ? prev.acsiStartingDate : '',
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = language === 'it' ? 'Nome richiesto' : 'Name required';
    }
    if (!formData.surname.trim()) {
      newErrors.surname = language === 'it' ? 'Cognome richiesto' : 'Surname required';
    }
    if (!formData.email.trim()) {
      newErrors.email = language === 'it' ? 'Email richiesta' : 'Email required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = language === 'it' ? 'Email non valida' : 'Invalid email';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = language === 'it' ? 'Telefono richiesto' : 'Phone required';
    }
    if (!formData.password) {
      newErrors.password = language === 'it' ? 'Password richiesta' : 'Password required';
    } else if (formData.password.length < 8) {
      newErrors.password = language === 'it' ? 'La password deve essere di almeno 8 caratteri' : 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = language === 'it' ? 'Le password non corrispondono' : 'Passwords do not match';
    }
    if (!formData.street.trim()) {
      newErrors.street = language === 'it' ? 'Indirizzo richiesto' : 'Street address required';
    }
    if (!formData.postcode.trim()) {
      newErrors.postcode = language === 'it' ? 'CAP richiesto' : 'Postcode required';
    }
    if (!formData.city.trim()) {
      newErrors.city = language === 'it' ? 'Città richiesta' : 'City required';
    }
    if (!formData.placeOfBirth.trim()) {
      newErrors.placeOfBirth = language === 'it' ? 'Luogo di nascita richiesto' : 'Place of birth required';
    }
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = language === 'it' ? 'Data di nascita richiesta' : 'Date of birth required';
    }
    if (!formData.fiscalCode.trim()) {
      newErrors.fiscalCode = language === 'it' ? 'Codice fiscale/N.I. richiesto' : 'Fiscal code/N.I. required';
    }
    if (formData.isAcsiMember) {
      if (!formData.acsiNumber.trim()) {
        newErrors.acsiNumber = language === 'it' ? 'Numero ACSI richiesto' : 'ACSI number required';
      }
      if (!formData.acsiStartingDate) {
        newErrors.acsiStartingDate = language === 'it' ? 'Data iscrizione ACSI richiesta' : 'ACSI starting date required';
      }
    }
    if (!formData.termsAccepted) {
      newErrors.termsAccepted = language === 'it' ? 'Devi accettare i termini e condizioni' : 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    const payload = {
      email: formData.email,
      password: formData.password,
      password2: formData.confirmPassword,
      first_name: formData.name,
      last_name: formData.surname,
      phone: formData.phone,
      date_of_birth: formData.dateOfBirth,
      place_of_birth: Number(formData.placeOfBirth),
      ci: formData.fiscalCode,
      address: formData.street,
      city: Number(formData.city),
      postal_code: formData.postcode,
      country: Number(formData.country),
      acsi: formData.isAcsiMember,
      acsi_number: formData.acsiNumber ? Number(formData.acsiNumber) : undefined,
      acsi_starting_date: formData.acsiStartingDate || undefined,
      privacy_consent: formData.termsAccepted,
      marketing_consent: formData.marketingConsent,
    };

    try {
      const response = await fetch(apiUrl('/api/auth/register/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      const data = await response.json();
      const newErrors: Record<string, string> = {};

      // Map backend field names back to frontend field names
      for (const [backendKey, messages] of Object.entries(data as Record<string, unknown>)) {
        const frontendKey = backendToFrontend[backendKey] ?? backendKey;
        const message = Array.isArray(messages) ? messages[0] : String(messages);
        newErrors[frontendKey] = message;
      }

      setErrors(newErrors);
    } catch {
      setErrors({ form: language === 'it' ? 'Errore di rete. Riprova.' : 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f5f0e8] to-[#e8dcc8] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle2 className="size-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-[#2b2b2b] mb-2">
                {language === 'it' ? 'Registrazione Inviata!' : 'Registration Submitted!'}
              </h2>
              <p className="text-gray-600">
                {language === 'it'
                  ? 'La tua richiesta è stata ricevuta. Il tuo account è in attesa di approvazione. Riceverai una email di conferma una volta attivato.'
                  : 'Your request has been received. Your account is pending admin approval. You will receive a confirmation email once it is activated.'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {language === 'it' ? 'Reindirizzamento al login...' : 'Redirecting to login...'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f0e8] to-[#e8dcc8] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-[#2b2b2b]">
              {language === 'it' ? 'Registrazione' : 'Registration'}
            </CardTitle>
            <CardDescription>
              {language === 'it' 
                ? 'Compila il modulo per creare il tuo account' 
                : 'Fill out the form to create your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-[#2b2b2b] mb-4">
                  {language === 'it' ? 'Informazioni Personali' : 'Personal Information'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">
                      {language === 'it' ? 'Nome' : 'Name'} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={errors.name ? 'border-red-500' : ''}
                    />
                    {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <Label htmlFor="surname">
                      {language === 'it' ? 'Cognome' : 'Surname'} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="surname"
                      name="surname"
                      value={formData.surname}
                      onChange={handleChange}
                      className={errors.surname ? 'border-red-500' : ''}
                    />
                    {errors.surname && <p className="text-sm text-red-500 mt-1">{errors.surname}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="placeOfBirth">
                      {language === 'it' ? 'Luogo di Nascita' : 'Place of Birth'} <span className="text-red-500">*</span>
                    </Label>
                    <CitySearch
                      value={formData.placeOfBirth ? Number(formData.placeOfBirth) : null}
                      displayValue={formData.placeOfBirthName}
                      onSelect={(city: CityResult) =>
                        setFormData(prev => ({
                          ...prev,
                          placeOfBirth: String(city.id),
                          placeOfBirthName: city.name,
                        }))
                      }
                      placeholder={language === 'it' ? 'Cerca città...' : 'Search city...'}
                      error={!!errors.placeOfBirth}
                    />
                    {errors.placeOfBirth && <p className="text-sm text-red-500 mt-1">{errors.placeOfBirth}</p>}
                  </div>
                  <div>
                    <Label htmlFor="dateOfBirth">
                      {language === 'it' ? 'Data di Nascita' : 'Date of Birth'} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      className={errors.dateOfBirth ? 'border-red-500' : ''}
                    />
                    {errors.dateOfBirth && <p className="text-sm text-red-500 mt-1">{errors.dateOfBirth}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="fiscalCode">
                      {language === 'it' ? 'Codice Fiscale / N.I. Number' : 'Fiscal Code / N.I. Number'} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="fiscalCode"
                      name="fiscalCode"
                      value={formData.fiscalCode}
                      onChange={handleChange}
                      placeholder={language === 'it' ? 'es. RSSMRA85M01H501U' : 'e.g. RSSMRA85M01H501U'}
                      className={errors.fiscalCode ? 'border-red-500' : ''}
                    />
                    {errors.fiscalCode && <p className="text-sm text-red-500 mt-1">{errors.fiscalCode}</p>}
                  </div>
                  <div>
                    <Label htmlFor="phone">
                      {language === 'it' ? 'Telefono' : 'Phone'} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+39 333 1234567"
                      className={errors.phone ? 'border-red-500' : ''}
                    />
                    {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Address */}
              <div>
                <h3 className="text-lg font-semibold text-[#2b2b2b] mb-4">
                  {language === 'it' ? 'Indirizzo' : 'Address'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="street">
                      {language === 'it' ? 'Via' : 'Street'} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="street"
                      name="street"
                      value={formData.street}
                      onChange={handleChange}
                      placeholder={language === 'it' ? 'es. Via Roma 123' : 'e.g. Via Roma 123'}
                      className={errors.street ? 'border-red-500' : ''}
                    />
                    {errors.street && <p className="text-sm text-red-500 mt-1">{errors.street}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="postcode">
                        {language === 'it' ? 'CAP' : 'Postcode'} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="postcode"
                        name="postcode"
                        value={formData.postcode}
                        onChange={handleChange}
                        placeholder="00100"
                        className={errors.postcode ? 'border-red-500' : ''}
                      />
                      {errors.postcode && <p className="text-sm text-red-500 mt-1">{errors.postcode}</p>}
                    </div>
                    <div>
                      <Label htmlFor="city">
                        {language === 'it' ? 'Città' : 'City'} <span className="text-red-500">*</span>
                      </Label>
                      <CitySearch
                        value={formData.city ? Number(formData.city) : null}
                        displayValue={formData.cityName}
                        onSelect={(city: CityResult) =>
                          setFormData(prev => ({
                            ...prev,
                            city: String(city.id),
                            cityName: city.name,
                            country: String(city.country_id),
                            countryName: city.country_name,
                          }))
                        }
                        placeholder={language === 'it' ? 'Cerca città...' : 'Search city...'}
                        error={!!errors.city}
                      />
                      {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city}</p>}
                    </div>
                    <div>
                      <Label htmlFor="country">
                        {language === 'it' ? 'Paese' : 'Country'}
                      </Label>
                      <Input
                        id="country"
                        name="country"
                        value={formData.countryName}
                        readOnly
                        placeholder={language === 'it' ? 'Auto-compilato dalla città' : 'Auto-filled from city'}
                        className="bg-muted cursor-not-allowed"
                      />
                      {errors.country && <p className="text-sm text-red-500 mt-1">{errors.country}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Account Details */}
              <div>
                <h3 className="text-lg font-semibold text-[#2b2b2b] mb-4">
                  {language === 'it' ? 'Dettagli Account' : 'Account Details'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">
                      Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="email@example.com"
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="password">
                        Password <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        className={errors.password ? 'border-red-500' : ''}
                      />
                      {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">
                        {language === 'it' ? 'Conferma Password' : 'Confirm Password'} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={errors.confirmPassword ? 'border-red-500' : ''}
                      />
                      {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ACSI Membership */}
              <div>
                <h3 className="text-lg font-semibold text-[#2b2b2b] mb-4">
                  {language === 'it' ? 'Tesseramento ACSI' : 'ACSI Membership'}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isAcsiMember"
                      checked={formData.isAcsiMember}
                      onCheckedChange={handleAcsiMemberChange}
                    />
                    <Label htmlFor="isAcsiMember" className="text-sm font-normal cursor-pointer">
                      {language === 'it' ? 'Sono già un tesserato ACSI' : 'I am already an ACSI member'}
                    </Label>
                  </div>

                  {formData.isAcsiMember ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="acsiNumber">
                          {language === 'it' ? 'Numero Tessera ACSI' : 'ACSI Membership Number'} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="acsiNumber"
                          name="acsiNumber"
                          value={formData.acsiNumber}
                          onChange={handleChange}
                          placeholder="123456"
                          className={errors.acsiNumber ? 'border-red-500' : ''}
                        />
                        {errors.acsiNumber && <p className="text-sm text-red-500 mt-1">{errors.acsiNumber}</p>}
                      </div>
                      <div>
                        <Label htmlFor="acsiStartingDate">
                          {language === 'it' ? 'Data Iscrizione Tessera' : 'Membership Starting Date'} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="acsiStartingDate"
                          name="acsiStartingDate"
                          type="date"
                          value={formData.acsiStartingDate}
                          onChange={handleChange}
                          className={errors.acsiStartingDate ? 'border-red-500' : ''}
                        />
                        {errors.acsiStartingDate && <p className="text-sm text-red-500 mt-1">{errors.acsiStartingDate}</p>}
                      </div>
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="size-4" />
                      <AlertDescription>
                        {language === 'it' 
                          ? 'Ti verrà richiesto di richiedere il tesseramento ACSI dopo un mese o prima di partecipare a una lezione/evento.' 
                          : 'You will be required to request ACSI membership after one month or before joining an actual class/event.'}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              <Separator />

              {/* Terms and Conditions */}
              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="termsAccepted"
                    name="termsAccepted"
                    checked={formData.termsAccepted}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, termsAccepted: checked as boolean }))}
                    className={errors.termsAccepted ? 'border-red-500' : ''}
                  />
                  <Label htmlFor="termsAccepted" className="text-sm font-normal cursor-pointer">
                    {language === 'it' ? (
                      <>
                        Accetto i{' '}
                        <a href="#" className="text-[#e67e22] hover:underline">
                          termini e condizioni
                        </a>{' '}
                        e la{' '}
                        <a href="#" className="text-[#e67e22] hover:underline">
                          privacy policy
                        </a>
                        <span className="text-red-500 ml-1">*</span>
                      </>
                    ) : (
                      <>
                        I accept the{' '}
                        <a href="#" className="text-[#e67e22] hover:underline">
                          terms and conditions
                        </a>{' '}
                        and{' '}
                        <a href="#" className="text-[#e67e22] hover:underline">
                          privacy policy
                        </a>
                        <span className="text-red-500 ml-1">*</span>
                      </>
                    )}
                  </Label>
                </div>
                {errors.termsAccepted && <p className="text-sm text-red-500">{errors.termsAccepted}</p>}

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="marketingConsent"
                    name="marketingConsent"
                    checked={formData.marketingConsent}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, marketingConsent: checked as boolean }))}
                  />
                  <Label htmlFor="marketingConsent" className="text-sm font-normal cursor-pointer">
                    {language === 'it' 
                      ? 'Acconsento a ricevere comunicazioni di marketing e newsletter' 
                      : 'I consent to receive marketing communications and newsletters'}
                  </Label>
                </div>
              </div>

              {errors.form && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{errors.form}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#e67e22] hover:bg-[#d4b896] text-white py-6 text-lg disabled:opacity-50"
              >
                {loading
                  ? (language === 'it' ? 'Registrazione in corso...' : 'Registering...')
                  : (language === 'it' ? 'Registrati' : 'Register')}
              </Button>

              <p className="text-center text-sm text-gray-600">
                {language === 'it' ? 'Hai già un account?' : 'Already have an account?'}{' '}
                <Link to="/login" className="text-[#e67e22] hover:underline font-semibold">
                  {language === 'it' ? 'Accedi' : 'Login'}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
