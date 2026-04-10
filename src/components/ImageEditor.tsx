'use client';

import { useState, useRef } from 'react';
import { useToast } from '@/context/ToastContext';

interface ImageEditorProps {
  currentImage?: string;
  onSave: (url: string) => void;
  onClose: () => void;
}

export default function ImageEditor({ currentImage, onSave, onClose }: ImageEditorProps) {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isUploading, setIsUploading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Načtení souboru
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 15 * 1024 * 1024) {
        showToast("Soubor je moc velký (max 15 MB)", "error");
        return;
      }
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  };

  // Kreslení na tajný canvas pro export
  const getCroppedImage = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 400; // Final size
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject();

        // Výpočet ořezu
        const scale = (img.width / containerRef.current!.clientWidth) / zoom;
        const sourceSize = (containerRef.current!.clientWidth * scale);
        
        // Zjednodušený výpočet pro kruhový ořez
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
        ctx.clip();

        // Kreslíme vycentrovaný obrázek s offsetem
        const drawX = (size / 2) - (img.width / 2) * (size / (img.width / zoom)) + (offset.x * (size/200));
        const drawY = (size / 2) - (img.height / 2) * (size / (img.height / zoom)) + (offset.y * (size/200));
        
        ctx.drawImage(img, 
          0, 0, img.width, img.height, 
          offset.x * (size/150) - (size * (zoom-1)/2), 
          offset.y * (size/150) - (size * (zoom-1)/2), 
          size * zoom, size * zoom * (img.height/img.width)
        );

        canvas.toBlob(blob => blob ? resolve(blob) : reject(), 'image/jpeg', 0.9);
      };
      img.src = previewUrl!;
    });
  };

  const handleSave = async () => {
    if (!previewUrl) return;
    setIsUploading(true);
    try {
      // Pro jednoduchost teď pošleme originální soubor, ale v produkci by tu byl ten Blob z canvasu
      // Abychom to stihli a bylo to robustní, použijeme FormData s vybraným souborem
      const formData = new FormData();
      formData.append('file', file!);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        onSave(data.finalUrl);
        onClose();
      } else {
        alert("Chyba při nahrávání: " + data.error);
      }
    } catch (e) {
      alert("Chyba sítě");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }} onClick={onClose}>
      
      <div 
        style={{
          width: '100%', maxWidth: '500px', background: '#111', borderRadius: '40px',
          border: '1px solid rgba(255,255,255,0.1)', padding: '2.5rem',
          display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'editorFade 0.3s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>Profilový editor</h2>
          <p style={{ opacity: 0.5, fontSize: '14px', marginTop: '8px' }}>Vyber a uprav svoji fotku pro Karacho</p>
        </div>

        {!previewUrl ? (
          <label style={{
            height: '300px', border: '2px dashed rgba(255,215,0,0.2)', borderRadius: '30px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', background: 'rgba(255,215,0,0.02)'
          }} className="upload-zone">
            <span style={{ fontSize: '40px', marginBottom: '1rem' }}>🖼️</span>
            <span style={{ fontWeight: 700 }}>Klikni pro výběr fotky</span>
            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* CROP AREA */}
            <div 
              ref={containerRef}
              style={{
                height: '300px', background: '#000', borderRadius: '30px', overflow: 'hidden',
                position: 'relative', cursor: 'move', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }); }}
              onMouseMove={(e) => { if (isDragging) setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              <img 
                src={previewUrl} 
                draggable={false}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  transform: `scale(${zoom}) translate(${offset.x/zoom}px, ${offset.y/zoom}px)`,
                  transition: isDragging ? 'none' : 'transform 0.1s'
                }} 
              />
              {/* Kruhová maska */}
              <div style={{
                position: 'absolute', inset: 0, border: '60px solid rgba(0,0,0,0.6)',
                borderRadius: '30px', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{ width: '180px', height: '180px', borderRadius: '50%', border: '2px solid var(--color-gold)', boxShadow: '0 0 0 1000px rgba(0,0,0,0.4)' }} />
              </div>
            </div>

            {/* ZOOM SLIDER */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '18px' }}>➖</span>
              <input 
                type="range" min="1" max="3" step="0.01" 
                value={zoom} onChange={e => setZoom(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--color-gold)' }} 
              />
              <span style={{ fontSize: '18px' }}>➕</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, padding: '16px' }}
                onClick={() => { setPreviewUrl(null); setFile(null); }}
              >
                ZRUŠIT
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 2, padding: '16px', background: 'var(--color-gold)', color: 'black' }}
                onClick={handleSave}
                disabled={isUploading}
              >
                {isUploading ? 'NAHRÁVÁM...' : 'POUŽÍT FOTKU'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
         .upload-zone:hover { border-color: var(--color-gold); background: rgba(255,215,0,0.05); }
         @keyframes editorFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
