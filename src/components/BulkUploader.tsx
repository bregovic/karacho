'use client';
import { useState, useRef } from 'react';
import { createSong, updateSongInstrumental } from '@/app/admin/actions';

export default function BulkUploader({ initialSongs }: { initialSongs: any[] }) {
  const [uploading, setUploading] = useState(false);
  const [log, setLog] = useState<{msg: string, status: 'info'|'success'|'error'}[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'ORIGINAL' | 'INSTRUMENTAL'>('ORIGINAL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string, status: 'info'|'success'|'error' = 'info') => {
    setLog(prev => [{ msg, status }, ...prev].slice(0, 50));
  };

  const processFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    addLog(`🚀 Startuji hromadný import ${files.length} souborů...`, 'info');

    for (const file of files) {
      try {
        const rawName = file.name.replace(/\.[^/.]+$/, ""); // Odstraní příponu
        let artist = "Neznámý";
        let title = rawName;

        if (rawName.includes('-')) {
          const parts = rawName.split('-');
          artist = parts[0].trim();
          title = parts.slice(1).join('-').trim();
        }

        addLog(`Zpracovávám: ${artist} - ${title}...`);

        // 1. Nahrání souboru na R2 přes stávající API
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) throw new Error(`Chyba uploadu: ${res.statusText}`);
        const uploadData = await res.json();
        const fileUrl = uploadData.finalUrl;

        if (mode === 'ORIGINAL') {
          // 2a. Vytvoření nové písně s audioUrl
          const songData = new FormData();
          songData.append('title', title);
          songData.append('artist', artist);
          songData.append('audioUrl', fileUrl);
          
          await createSong(songData);
          addLog(`✅ Píseň "${title}" vytvořena a MP3 přiřazena.`, 'success');
        } else {
          // 2b. Režim INSTRUMENTAL - hledáme shodu
          const existing = initialSongs.find(s => 
            s.title.toLowerCase().trim() === title.toLowerCase().trim() && 
            (s.artist || '').toLowerCase().trim() === artist.toLowerCase().trim()
          );

          if (existing) {
            await updateSongInstrumental(existing.id, fileUrl);
            addLog(`✅ Instrumentálka přiřazena k "${existing.title}".`, 'success');
          } else {
            addLog(`❌ Shoda pro "${artist} - ${title}" nenalezena.`, 'error');
          }
        }

      } catch (err: any) {
        addLog(`🔥 Chyba u ${file.name}: ${err.message}`, 'error');
      }
    }

    setUploading(false);
    addLog(`✨ Hromadný import dokončen.`, 'info');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className="btn-secondary"
        style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '12px', opacity: 0.8 }}
      >
        📦 Hromadný Import
      </button>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => !uploading && setShowModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '2rem', border: '1px solid var(--color-teal)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ color: 'var(--color-gold)', margin: 0 }}>📦 Hromadný Import MP3</h2>
              <button onClick={() => setShowModal(false)} disabled={uploading} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => setMode('ORIGINAL')}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: mode === 'ORIGINAL' ? 'var(--color-teal)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
              >
                1. Nahrát Originály (Nové písně)
              </button>
              <button 
                onClick={() => setMode('INSTRUMENTAL')}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: mode === 'INSTRUMENTAL' ? 'var(--color-teal)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
              >
                2. Nahrát Instrumentálky
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Formát souboru: <code style={{ color: 'var(--color-gold)' }}>Interpret - Název písně.mp3</code><br/>
              * Režim 1 automaticky založí píseň, pokud neexistuje.<br/>
              * Režim 2 hledá píseň podle přesného názvu a interpreta a přidá k ní instr. stopu.
            </p>

            <input 
              type="file" 
              multiple 
              accept="audio/mpeg, audio/mp3" 
              ref={fileInputRef}
              onChange={processFiles}
              disabled={uploading}
              style={{ width: '100%', padding: '20px', border: '2px dashed rgba(0,255,200,0.2)', borderRadius: '15px', background: 'rgba(0,0,0,0.2)', color: '#fff', cursor: 'pointer' }}
            />

            {log.length > 0 && (
              <div style={{ marginTop: '1.5rem', maxHeight: '250px', overflowY: 'auto', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '10px', fontSize: '12px', fontFamily: 'monospace' }}>
                {log.map((l, i) => (
                  <div key={i} style={{ color: l.status === 'success' ? '#4ade80' : l.status === 'error' ? '#f87171' : '#fff', marginBottom: '4px' }}>
                    {l.msg}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
               <button onClick={() => setShowModal(false)} disabled={uploading} className="btn-secondary" style={{ padding: '10px 25px', borderRadius: '10px' }}> ZAVŘÍT </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
