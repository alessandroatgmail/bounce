import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useEmailTemplates, EmailTemplate, EmailTemplatePayload } from '../hooks/useEmailTemplates';
import { RichHtmlEditor } from './RichHtmlEditor';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';

const EMPTY: EmailTemplatePayload = {
  name: '',
  description: '',
  subject: '',
  content: '',
  html_content: '',
  language: '',
};

interface FormProps {
  initial?: EmailTemplatePayload;
  onSubmit: (data: EmailTemplatePayload) => Promise<void>;
  onCancel: () => void;
}

function TemplateForm({ initial = EMPTY, onSubmit, onCancel }: FormProps) {
  const { language } = useLanguage();
  const [form, setForm] = useState<EmailTemplatePayload>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof EmailTemplatePayload>(field: K, value: EmailTemplatePayload[K]) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch {
      setError(language === 'it' ? 'Salvataggio fallito.' : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* metadata row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>{language === 'it' ? 'Nome' : 'Name'} *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>{language === 'it' ? 'Oggetto' : 'Subject'} *</Label>
          <Input value={form.subject} onChange={e => set('subject', e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>{language === 'it' ? 'Lingua' : 'Language'}</Label>
          <Input
            value={form.language ?? ''}
            onChange={e => set('language', e.target.value)}
            placeholder="it / en / (blank = default)"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>{language === 'it' ? 'Descrizione' : 'Description'}</Label>
        <Input value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
      </div>

      {/* plain-text fallback */}
      <div className="space-y-1">
        <Label>{language === 'it' ? 'Testo semplice (fallback)' : 'Plain text (fallback)'}</Label>
        <textarea
          className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
          value={form.content ?? ''}
          onChange={e => set('content', e.target.value)}
          placeholder="Plain-text version for email clients that don't support HTML"
        />
      </div>

      {/* HTML editor */}
      <div className="space-y-1">
        <Label>{language === 'it' ? 'Contenuto HTML' : 'HTML content'}</Label>
        <RichHtmlEditor
          value={form.html_content ?? ''}
          onChange={val => set('html_content', val)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          {language === 'it' ? 'Annulla' : 'Cancel'}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
          {language === 'it' ? 'Salva' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export function EmailTemplatesPanel() {
  const { accessToken } = useAuth();
  const { language } = useLanguage();
  const { templates, count, page, setPage, totalPages, loading, error, create, update, remove } =
    useEmailTemplates(accessToken ?? '');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmailTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toPayload = (t: EmailTemplate): EmailTemplatePayload => ({
    name: t.name,
    description: t.description,
    subject: t.subject,
    content: t.content,
    html_content: t.html_content,
    language: t.language,
    default_template: t.default_template,
  });

  const handleCreate = async (data: EmailTemplatePayload) => {
    await create(data);
    setCreateOpen(false);
  };

  const handleEdit = async (data: EmailTemplatePayload) => {
    if (!editTarget) return;
    await update(editTarget.id, data);
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{language === 'it' ? 'Template Email' : 'Email Templates'}</CardTitle>
            <CardDescription>
              {language === 'it' ? `${count} template totali` : `${count} templates total`}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-2" />
            {language === 'it' ? 'Nuovo' : 'New'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {!loading && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'it' ? 'Nome' : 'Name'}</TableHead>
                  <TableHead>{language === 'it' ? 'Oggetto' : 'Subject'}</TableHead>
                  <TableHead>{language === 'it' ? 'Lingua' : 'Language'}</TableHead>
                  <TableHead>{language === 'it' ? 'Aggiornato' : 'Updated'}</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-sm">{t.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{t.subject}</TableCell>
                    <TableCell>
                      {t.language ? (
                        <Badge variant="outline">{t.language}</Badge>
                      ) : (
                        <Badge variant="secondary">default</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.last_updated).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditTarget(t)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(t)}>
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {language === 'it' ? 'Nessun template.' : 'No templates.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {language === 'it' ? `Pagina ${page} di ${totalPages}` : `Page ${page} of ${totalPages}`}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === 'it' ? 'Nuovo Template' : 'New Template'}</DialogTitle>
            <DialogDescription>
              {language === 'it' ? 'Crea un nuovo template email.' : 'Create a new email template.'}
            </DialogDescription>
          </DialogHeader>
          <TemplateForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === 'it' ? 'Modifica Template' : 'Edit Template'}</DialogTitle>
            <DialogDescription>{editTarget?.name}</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <TemplateForm
              initial={toPayload(editTarget)}
              onSubmit={handleEdit}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'it' ? 'Elimina template?' : 'Delete template?'}</DialogTitle>
            <DialogDescription>
              {language === 'it'
                ? `Stai per eliminare "${deleteTarget?.name}". Questa operazione è irreversibile.`
                : `You are about to delete "${deleteTarget?.name}". This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {language === 'it' ? 'Annulla' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {language === 'it' ? 'Elimina' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
