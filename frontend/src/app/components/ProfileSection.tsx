import { useRef, useState } from 'react';
import { FileText, User, Mail, Shield, Camera } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiUrl } from '../../lib/api';
import { mockDocuments } from '../data/mockData';

export function ProfileSection() {
  const { user, accessToken, updateUser } = useAuth();
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

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

  return (
    <div className="max-w-3xl mx-auto">
      <Tabs defaultValue="profile">
        <TabsList className="bg-[#2b2b2b] mb-6">
          <TabsTrigger value="profile" className="data-[state=active]:bg-[#e67e22] data-[state=active]:text-white text-gray-300">
            {language === 'it' ? 'Profilo' : 'Profile'}
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-[#e67e22] data-[state=active]:text-white text-gray-300">
            {language === 'it' ? 'Documenti' : 'Documents'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Avatar + name + QR */}
              <div className="flex items-start gap-4">
                {/* Profile image with upload */}
                <div className="relative shrink-0">
                  <Avatar className="size-20">
                    {user.profile_image && <AvatarImage src={user.profile_image} alt={user.name} className="object-cover" />}
                    <AvatarFallback className="bg-[#e67e22] text-white text-2xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 bg-[#e67e22] text-white rounded-full p-1 shadow hover:bg-[#d4b896] transition-colors disabled:opacity-50"
                    title={language === 'it' ? 'Cambia foto' : 'Change photo'}
                  >
                    <Camera className="size-3.5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-[#2b2b2b]">{user.name}</h2>
                  <Badge variant="outline" className="mt-1 border-[#e67e22] text-[#e67e22]">
                    {user.role === 'admin'
                      ? (language === 'it' ? 'Amministratore' : 'Administrator')
                      : (language === 'it' ? 'Studente' : 'Student')}
                  </Badge>
                </div>

              </div>

              {/* Info rows */}
              <div className="divide-y">
                <div className="flex items-center gap-3 py-3">
                  <User className="size-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      {language === 'it' ? 'Nome' : 'Name'}
                    </p>
                    <p className="text-sm font-medium text-[#2b2b2b]">{user.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 py-3">
                  <Mail className="size-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                    <p className="text-sm font-medium text-[#2b2b2b]">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 py-3">
                  <Shield className="size-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      {language === 'it' ? 'Ruolo' : 'Role'}
                    </p>
                    <p className="text-sm font-medium text-[#2b2b2b] capitalize">{user.role}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-[#2b2b2b] mb-4">
                {language === 'it' ? 'Documenti' : 'Documents'}
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'it' ? 'Nome' : 'Name'}</TableHead>
                    <TableHead>{language === 'it' ? 'Data' : 'Date'}</TableHead>
                    <TableHead>{language === 'it' ? 'Tipo' : 'Type'}</TableHead>
                    <TableHead>{language === 'it' ? 'Azioni' : 'Actions'}</TableHead>
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
                            {language === 'it' ? 'Visualizza' : 'View'}
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
