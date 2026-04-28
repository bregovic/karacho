import { useState, useRef } from 'react';
import { createSong, updateSongInstrumental, findSongForInstrumentalAction } from '@/app/admin/actions';

export default function BulkUploader({ initialSongs }: { initialSongs: any[] }) {
  // const [localSongs, setLocalSongs] = useState<any[]>(initialSongs); // Už nepotřebujeme lokální seznam
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [log, setLog] = useState<{msg: string, status: 'info'|'success'|'error'}[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'ORIGINAL' | 'INSTRUMENTAL'>('ORIGINAL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string, status: 'info'|'success'|'error' = 'info') => {
    setLog(prev => [{ msg, status }, ...prev].slice(0, 100));
  };

  const normalizeName = (str: string) => {
    if (!str) return '';
    let s = str.toLowerCase();
    // Odstranění prefixů - jen první číslo s podtržítkem nebo tečkou (např. 1_ nebo 01.)
    s = s.replace(/^[0-9]+[\._\s-]/, '');
    // YouTube Junk & Suffixes
    s = s.replace(/[\(\[]\s*[^\]\)]*(official|video|lyrics?|audio|hd|4k|hq|remastered|live|feat\.|ft\.|karaoke|instrumental|vhs|retro|píseň|pieseň|wmv|mp4|avi|mpg|mpeg)[^\]\)]*\s*[\)\]]/gi, '');
    s = s.replace(/[-–—|]\s*(official|video|lyrics?|audio|hd|4k|hq|remastered|live|karaoke|instrumental|wmv|mp4|avi|mpg|mpeg)$/gi, '');
    // Čištění konců
    s = s.replace(/[\s-_]*\(?instrumental\)?[\s-_]*/gi, '');
    s = s.replace(/[\s-_]*instr[\s-_]*/gi, '');
    s = s.replace(/\.[a-z0-9]{3,4}$/i, '');
    return s.replace(/\s{2,}/g, ' ').trim();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(files);
  };

  const handleStartImport = async () => {
    if (pendingFiles.length === 0) return;
    
    setUploading(true);
    setLog([]); 
    addLog(`🚀 Startuji hromadný import ${pendingFiles.length} souborů (${mode === 'ORIGINAL' ? 'Originály' : 'Instrumentálky'})...`, 'info');

    for (const file of pendingFiles) {
      try {
        const rawName = file.name.replace(/\.[^/.]+$/, ""); 
        
        let artist = "Neznámý";
        let title = rawName;

        if (rawName.includes('-')) {
          const parts = rawName.split('-');
          artist = parts[0].trim();
          title = parts.slice(1).join('-').trim();
        }

        addLog(`Zpracovávám: ${artist} - ${title}...`);

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
          const songData = new FormData();
          songData.append('title', title);
          songData.append('artist', artist === 'Neznámý' ? '' : artist);
          songData.append('audioUrl', fileUrl);
          
          const newSong = await createSong(songData);
          addLog(`✅ Píseň "${title}" vytvořena. Text se stahuje na pozadí.`, 'success');
        } else {
          // Režim INSTRUMENTAL - hledáme na serveru v reálném čase
          const existing = await findSongForInstrumentalAction(title, artist);

          if (existing) {
            await updateSongInstrumental(existing.id, fileUrl);
            addLog(`✅ Instrumentálka přiřazena k "${existing.title}".`, 'success');
          } else {
            addLog(`❌ Shoda pro "${artist} - ${title}" nenalezena v databázi.`, 'error');
          }
        }

      } catch (err: any) {
        addLog(`🔥 Chyba u ${file.name}: ${err.message}`, 'error');
      }
    }

    setUploading(false);
    setPendingFiles([]);
    addLog(`✨ Hromadný import dokončen.`, 'info');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  };

  return (
    <>
      <button 
        onClick={() => { setShowModal(true); setPendingFiles([]); setLog([]); }}
        className="btn-secondary"
        style={{ padding: '10px 20px', borderRadius: '14px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        📦 Hromadný Import
      </button>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => !uploading && setShowModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '700px', padding: '2.5rem', border: '1px solid rgba(0,255,200,0.2)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
              <h2 style={{ color: 'var(--color-gold)', margin: 0, fontSize: '24px', fontWeight: 900 }}>📦 Hromadný Import</h2>
              <button onClick={() => setShowModal(false)} disabled={uploading} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => setMode('ORIGINAL')}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: mode === 'ORIGINAL' ? 'var(--color-teal)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                1. ORIGINÁLY
              </button>
              <button 
                onClick={() => setMode('INSTRUMENTAL')}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: mode === 'INSTRUMENTAL' ? 'var(--color-teal)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                2. INSTRUMENTÁLKY
              </button>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '15px', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.05)' }}>
               <input 
                type="file" 
                multiple 
                accept="audio/mpeg, audio/mp3" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                disabled={uploading}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <p style={{ fontSize: '11px', color: '#666', marginTop: '10px', marginBottom: 0 }}>
                Podporované formáty: <code style={{ color: '#aaa' }}>Interpret - Název.mp3</code>, automaticky čistíme prefixy (1_07...)
              </p>
            </div>

            {pendingFiles.length > 0 && !uploading && (
              <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <button 
                  onClick={handleStartImport}
                  className="btn-primary"
                  style={{ background: 'var(--color-teal)', padding: '15px 40px', fontSize: '16px', borderRadius: '15px', width: '100%', boxShadow: '0 10px 30px rgba(0,255,200,0.2)' }}
                >
                  🚀 SPUSTIT IMPORT ({pendingFiles.length} souborů)
                </button>
              </div>
            )}

            {uploading && (
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                 <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--color-teal)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px' }} />
                 <div style={{ fontSize: '14px', fontWeight: 700 }}>Probíhá import...</div>
                 <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
              </div>
            )}

            {log.length > 0 && (
              <div style={{ marginTop: '1.5rem', maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.5)', padding: '1.2rem', borderRadius: '15px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid rgba(255,255,255,0.05)' }}>
                {log.map((l, i) => (
                  <div key={i} style={{ color: l.status === 'success' ? '#4ade80' : l.status === 'error' ? '#f87171' : '#ccc', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                    <span style={{ opacity: 0.5 }}>[{new Date().toLocaleTimeString()}]</span> {l.msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
