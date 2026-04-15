import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function Register() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    password: '',
    confirmPassword: '',
    street: '',
    postcode: '',
    city: '',
    country: '',
    placeOfBirth: '',
    dateOfBirth: '',
    fiscalCode: '',
    acsiNumber: '',
    isAcsiMember: true,
    termsAccepted: false,
    marketingConsent: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

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
      acsiNumber: checked ? prev.acsiNumber : ''
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Required fields
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
    if (!formData.password) {
      newErrors.password = language === 'it' ? 'Password richiesta' : 'Password required';
    } else if (formData.password.length < 6) {
      newErrors.password = language === 'it' ? 'Password deve essere almeno 6 caratteri' : 'Password must be at least 6 characters';
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
    if (!formData.country.trim()) {
      newErrors.country = language === 'it' ? 'Paese richiesto' : 'Country required';
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
    if (formData.isAcsiMember && !formData.acsiNumber.trim()) {
      newErrors.acsiNumber = language === 'it' ? 'Numero ACSI richiesto' : 'ACSI number required';
    }
    if (!formData.termsAccepted) {
      newErrors.termsAccepted = language === 'it' ? 'Devi accettare i termini e condizioni' : 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Simulate registration
      console.log('Registration data:', formData);
      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
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
                {language === 'it' ? 'Registrazione Completata!' : 'Registration Complete!'}
              </h2>
              <p className="text-gray-600">
                {language === 'it' 
                  ? 'Il tuo account è stato creato con successo. Verrai reindirizzato alla pagina di login...' 
                  : 'Your account has been created successfully. You will be redirected to the login page...'}
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
                    <Input
                      id="placeOfBirth"
                      name="placeOfBirth"
                      value={formData.placeOfBirth}
                      onChange={handleChange}
                      className={errors.placeOfBirth ? 'border-red-500' : ''}
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

                <div className="mt-4">
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
                      <Input
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="Roma"
                        className={errors.city ? 'border-red-500' : ''}
                      />
                      {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city}</p>}
                    </div>
                    <div>
                      <Label htmlFor="country">
                        {language === 'it' ? 'Paese' : 'Country'} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="country"
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        placeholder="Italia"
                        className={errors.country ? 'border-red-500' : ''}
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
                    <div>
                      <Label htmlFor="acsiNumber">
                        {language === 'it' ? 'Numero Tessera ACSI' : 'ACSI Membership Number'} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="acsiNumber"
                        name="acsiNumber"
                        value={formData.acsiNumber}
                        onChange={handleChange}
                        placeholder="ACSI123456"
                        className={errors.acsiNumber ? 'border-red-500' : ''}
                      />
                      {errors.acsiNumber && <p className="text-sm text-red-500 mt-1">{errors.acsiNumber}</p>}
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

              <Button
                type="submit"
                className="w-full bg-[#e67e22] hover:bg-[#d4b896] text-white py-6 text-lg"
              >
                {language === 'it' ? 'Registrati' : 'Register'}
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
