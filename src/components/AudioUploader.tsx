'use client';
import { useState } from 'react';
import { updateSongAudio, updateSongInstrumental, updateSongJson } from '@/app/admin/actions';

export default function AudioUploader({ songId, type = 'audio' }: { songId: string, type?: 'audio' | 'instrumental' | 'json' }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          // Uložení finálního linku do správného pole v DB
          if (type === 'instrumental') {
            await updateSongInstrumental(songId, data.finalUrl);
          } else if (type === 'json') {
            await updateSongJson(songId, data.finalUrl);
          } else {
            await updateSongAudio(songId, data.finalUrl);
          }
          setUploading(false);
          setProgress(100);
          alert('Uloženo! 💾');
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            alert(`Chyba serveru: ${errData.error || 'Neznámá chyba'}`);
          } catch {
            alert('Chyba při komunikaci se serverem.');
          }
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        alert('Nahrávání selhalo.');
        setUploading(false);
      };

      xhr.send(formData);

    } catch (err: any) {
      console.error('--- Client Upload Error ---', err);
      alert(`Nahrávání selhalo: ${err.message || 'Neznámá chyba'}`);
      setUploading(false);
    }
  };

  const getLabelInfo = () => {
    if (type === 'instrumental') return { icon: '🎻', text: 'Nahrát Instr.' };
    if (type === 'json') return { icon: '📄', text: 'Nahrát JSON' };
    return { icon: '🎵', text: 'Nahrát MP3' };
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
             <input type="file" accept={type === 'json' ? '.json' : 'audio/*'} onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
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
