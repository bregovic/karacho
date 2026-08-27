'use client';
import { useState } from 'react';
import { updateSongAudio, updateSongInstrumental, updateSongJson, updateSongBackground, smazNahranySoubor } from '@/app/admin/actions';
import { useToast } from '@/context/ToastContext';

interface AudioUploaderProps {
  songId: string;
  onUploaded?: (url: string) => void;
  type?: 'audio' | 'instrumental' | 'json' | 'background';
}

export default function AudioUploader({ songId, onUploaded, type = 'audio' }: AudioUploaderProps) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          // Uložení finálního linku do správného pole v DB. Soubor v R2 už
          // leží — když zápis selže, musí se zase odstranit, jinak tam
          // zůstane viset bez písně.
          try {
            if (type === 'instrumental') {
              await updateSongInstrumental(songId, data.finalUrl, data.hash);
            } else if (type === 'json') {
              await updateSongJson(songId, data.finalUrl);
            } else if (type === 'background') {
              await updateSongBackground(songId, data.finalUrl);
            } else {
              await updateSongAudio(songId, data.finalUrl, data.hash, data.size);
            }
          } catch (e: any) {
            await smazNahranySoubor(data.finalUrl).catch(() => {});
            showToast(`Uložení selhalo: ${e.message || 'neznámá chyba'}`, 'error');
            setUploading(false);
            setProgress(0);
            return;
          }

          if (onUploaded) onUploaded(data.finalUrl);
          setUploading(false);
          setProgress(0);
          showToast('Uloženo! 💾', 'success');
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            showToast(`Chyba serveru: ${errData.error || 'Neznámá chyba'}`, 'error');
          } catch {
            showToast('Chyba při komunikaci se serverem.', 'error');
          }
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        showToast('Nahrávání selhalo.', 'error');
        setUploading(false);
      };

      xhr.send(formData);

    } catch (err: any) {
      console.error('--- Client Upload Error ---', err);
      showToast(`Nahrávání selhalo: ${err.message || 'Neznámá chyba'}`, 'error');
      setUploading(false);
    }
  };

  const getLabelInfo = () => {
    if (type === 'instrumental') return { icon: '🎻', text: 'Nahrát Instr.' };
    const icon = type === 'json' ? '📄' : (type === 'background' ? '🖼️' : '🎵');
    const text = type === 'json' ? 'Nahrát JSON' : (type === 'background' ? 'Nahrát Obrázek' : 'Nahrát MP3');
    return { icon, text };
  };

  const { icon, text } = getLabelInfo();

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ 
        cursor: uploading ? 'not-allowed' : 'pointer', 
        background: 'rgba(255,255,255,0.05)', 
        padding: '8px 16px', 
        borderRadius: '8px', 
        border: '1px solid rgba(255,255,255,0.1)', 
        fontSize: '13px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '8px', 
        color: 'white',
        opacity: uploading ? 0.7 : 1,
        transition: 'all 0.2s ease',
        boxShadow: uploading ? 'none' : '0 2px 4px rgba(0,0,0,0.2)'
      }}>
        {uploading ? (
           <span style={{ color: 'var(--color-gold)', fontWeight: 'bold' }}>
             {progress}%
           </span>
        ) : (
           <>
             <span style={{ fontSize: '18px' }}>{icon}</span> {text}
             <input 
               type="file" 
               accept={
                 type === 'background' ? 'image/png, image/jpeg, image/webp' : 
                 type === 'json' ? '.json' : 
                 'audio/mpeg, audio/wav, audio/x-m4a, audio/*'
               } 
               onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (!file) return;

                 // Kontrola velikosti (limit 50 MB)
                 const MAX_SIZE = 50 * 1024 * 1024;
                 if (file.size > MAX_SIZE) {
                   showToast("❌ CHYBA: Soubor je moc velký! (max 50 MB)", "error");
                   e.target.value = '';
                   return;
                 }

                 // Klient-side check přípony pro jistotu
                 const ext = file.name.split('.').pop()?.toLowerCase();
                 if (type === 'background' && !['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
                   showToast("❌ CHYBA: Sem patří obrázek (JPG, PNG, WEBP)!", "error");
                   e.target.value = '';
                   return;
                 }
                 if (type === 'json') {
                   if (!file.name.endsWith('.json')) {
                     showToast("❌ CHYBA: Sem patří pouze JSON soubor!", "error");
                     e.target.value = '';
                     return;
                   }
                 }

                 uploadFile(file);
               }} 
               style={{ display: 'none' }} 
               disabled={uploading} 
             />
           </>
        )}
      </label>
      
      {uploading && (
        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${progress}%`, 
            height: '100%', 
            background: 'var(--color-gold)', 
            transition: 'width 0.3s ease',
            boxShadow: '0 0 10px var(--color-gold)'
          }} />
        </div>
      )}
    </div>
  );
}
