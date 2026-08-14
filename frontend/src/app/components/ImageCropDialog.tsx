import { useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { useLanguage } from '../contexts/LanguageContext';
import { getCroppedImageBlob } from '../../lib/cropImage';

interface ImageCropDialogProps {
  imageSrc: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  saving?: boolean;
}

export function ImageCropDialog({ imageSrc, open, onCancel, onConfirm, saving = false }: ImageCropDialogProps) {
  const { language } = useLanguage();
  const lang = language === 'it' ? 'it' : 'en';
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixelsValue: Area) => {
    setCroppedAreaPixels(croppedAreaPixelsValue);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
    onConfirm(blob);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lang === 'it' ? 'Modifica foto profilo' : 'Edit profile photo'}</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-72 bg-gray-900 rounded-md overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 shrink-0">{lang === 'it' ? 'Zoom' : 'Zoom'}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full accent-[#e67e22]"
          />
        </div>
        <p className="text-xs text-gray-400">
          {lang === 'it'
            ? 'Trascina per spostare, usa il cursore per ingrandire o rimpicciolire.'
            : 'Drag to move, use the slider to zoom in or out.'}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {lang === 'it' ? 'Annulla' : 'Cancel'}
          </Button>
          <Button
            type="button"
            className="bg-[#e67e22] hover:bg-[#d4b896]"
            onClick={handleConfirm}
            disabled={saving || !croppedAreaPixels}
          >
            {saving
              ? (lang === 'it' ? 'Salvataggio…' : 'Saving…')
              : (lang === 'it' ? 'Salva' : 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
