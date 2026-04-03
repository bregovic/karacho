'use client';
import { useState } from 'react';
import { updateSongAudio } from '@/app/admin/actions';

export default function AudioUploader({ songId }: { songId: string }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'audio/mpeg' })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Přímý upload do R2 přes PUT
      const uploadRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'audio/mpeg' }
      });

      if (!uploadRes.ok) throw new Error('Nepodařilo se odeslat data do R2.');

      // Uložení finálního linku z R2 do databáze
      await updateSongAudio(songId, data.finalUrl);

    } catch (err) {
      console.error(err);
      alert('Nahrávání selhalo. Zkontrolujte připojení.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <label style={{ cursor: uploading ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', opacity: uploading ? 0.5 : 1 }}>
      {uploading ? (
         <span style={{ color: 'var(--color-gold)' }}>Nahrávám obří soubor...</span>
      ) : (
         <>
           <span style={{ fontSize: '16px' }}>🎵</span> Nahrát MP3 do Cloudu
           <input type="file" accept="audio/*" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
         </>
      )}
    </label>
  );
}
