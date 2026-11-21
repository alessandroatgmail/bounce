import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import type { Communication } from '../hooks/useCommunications';

export function CommunicationConsentDialog({
  open,
  onOpenChange,
  communications,
  language,
  onConfirm,
  confirming,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communications: Communication[];
  language: string;
  onConfirm: () => void;
  confirming: boolean;
  t: (key: string) => string;
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  // Reset the checklist every time a fresh set of communications is shown,
  // so a stale "all checked" state from a previous open can't slip through.
  useEffect(() => {
    if (open) setChecked({});
  }, [open, communications]);

  const title = (c: Communication) => (language === 'it' ? c.title_it : c.title_en) || c.title;
  const desc = (c: Communication) => (language === 'it' ? c.desc_it : c.desc_en) || c.desc;
  const allChecked = communications.length > 0 && communications.every(c => checked[c.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('festival.consent.title')}</DialogTitle>
          <DialogDescription>{t('festival.consent.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {communications.map(c => (
            <label key={c.id} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
              <Checkbox
                className="mt-0.5"
                checked={!!checked[c.id]}
                onCheckedChange={value => setChecked(prev => ({ ...prev, [c.id]: value === true }))}
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-[#2b2b2b]">{title(c)}</span>
                <span className="block text-sm text-gray-600 whitespace-pre-wrap">{desc(c)}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!allChecked || confirming}
            onClick={onConfirm}
            className="bg-[#2b2b2b] hover:bg-[#e67e22] text-white disabled:opacity-50"
          >
            {t('common.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
