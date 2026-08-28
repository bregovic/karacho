import { useState, useRef } from 'react';
import { createSong, updateSongInstrumental, findSongForInstrumentalAction, smazNahranySoubor } from '@/app/admin/actions';

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

  /**
   * Rozdělí název souboru na interpreta a píseň.
   *
   * Přednost má pomlčka obklopená mezerami — dělení na první pomlčce bez
   * ohledu na okolí rozřízlo „Blink-182 - All the Small Things" na
   * interpreta „Blink" a píseň „182 - All the Small Things", a takový
   * záznam se pak nespároval s ničím.
   */
  const rozdelNazev = (rawName: string): { artist: string; title: string } => {
    const oddelovac = / [-–—] /.exec(rawName);
    if (oddelovac) {
      return {
        artist: rawName.slice(0, oddelovac.index).trim(),
        title: rawName.slice(oddelovac.index + oddelovac[0].length).trim(),
      };
    }
    const pomlcka = rawName.indexOf('-');
    if (pomlcka > 0) {
      return {
        artist: rawName.slice(0, pomlcka).trim(),
        title: rawName.slice(pomlcka + 1).trim(),
      };
    }
    return { artist: 'Neznámý', title: rawName.trim() };
  };

  /** Zahodí soubor, který se sice nahrál do R2, ale nemá k čemu patřit. */
  const uklid = async (fileUrl?: string) => {
    if (!fileUrl) return;
    try {
      await smazNahranySoubor(fileUrl);
    } catch {
      // Úklid je pojistka, ne hlavní tok — když selže i on, chytne to
      // pozdější úklid osiřelých souborů v sekci Tech.
    }
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

    let prirazenoKPrani = 0;

    for (const file of pendingFiles) {
      try {
        const rawName = file.name.replace(/\.[^/.]+$/, "");
        const { artist, title } = rozdelNazev(rawName);

        addLog(`Zpracovávám: ${artist} - ${title}...`);

        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        const uploadData = await res.json().catch(() => ({}));

        // 409 = server poznal podle otisku souboru, že tuhle stopu už máme.
        // Není to chyba importu, je to přeskočení — a hlavně se tím do R2
        // nedostane druhá kopie téhož souboru.
        if (res.status === 409) {
          addLog(`⏭️ Přeskočeno (duplicita): ${uploadData.error || file.name}`, 'info');
          continue;
        }
        if (!res.ok) throw new Error(`Chyba uploadu: ${uploadData.error || res.statusText}`);

        const fileUrl = uploadData.finalUrl;

        if (mode === 'ORIGINAL') {
          const songData = new FormData();
          songData.append('title', title);
          songData.append('artist', artist === 'Neznámý' ? '' : artist);
          songData.append('audioUrl', fileUrl);
          if (uploadData.hash) songData.append('audioHash', uploadData.hash);
          if (uploadData.size) songData.append('audioSize', String(uploadData.size));
          songData.append('importName', rawName); // Posíláme surový název souboru

          // Soubor v R2 už leží. Když se píseň nezaloží, musí se uklidit —
          // jinak tam zůstane viset a nepatří nikomu.
          let newSong: any;
          try {
            newSong = await createSong(songData);
          } catch (e: any) {
            await uklid(fileUrl);
            addLog(`❌ Chyba: ${e.message}`, 'error');
            continue;
          }
          if ('error' in newSong) {
            await uklid(fileUrl);
            addLog(`❌ Chyba: ${newSong.error}`, 'error');
          } else {
            const casti = [
              newSong.doplneno === 'REQUESTED' ? '🙋 doplněno k PŘÁNÍ' :
                newSong.doplneno ? '🔗 doplněno k čekající písni' : null,
              // Ať je vidět, že se přání trefilo jen přibližně a název se
              // opravil — kdyby to sedlo na cizí píseň, pozná se to tady.
              newSong.prejmenovanoZ ? `přepsán název z „${newSong.prejmenovanoZ}"` : null,
              newSong.textNalezen ? 'text stažen' : 'text se nenašel',
              newSong.casovaniNalezeno ? '⏱️ ČASOVÁNÍ NALEZENO' : null,
            ].filter(Boolean).join(' · ');
            if (newSong.doplneno) prirazenoKPrani++;
            addLog(`✅ "${newSong.title}" — ${casti}`, newSong.doplneno || newSong.casovaniNalezeno || newSong.textNalezen ? 'success' : 'info');
          }
        } else {
          // Režim INSTRUMENTAL - hledáme na serveru podle názvu i surového jména
          const existing = await findSongForInstrumentalAction(title, artist, rawName);

          if (existing) {
            await updateSongInstrumental(existing.id, fileUrl, uploadData.hash);
            addLog(`✅ Instrumentálka přiřazena k "${existing.title}".`, 'success');
          } else {
            await uklid(fileUrl);
            addLog(`❌ Shoda pro "${artist} - ${title}" nenalezena — soubor uklizen.`, 'error');
          }
        }

      } catch (err: any) {
        addLog(`🔥 Chyba u ${file.name}: ${err.message}`, 'error');
      }
    }

    setUploading(false);
    setPendingFiles([]);
    if (prirazenoKPrani > 0) {
      addLog(`🙋 Doplněno k čekajícím písním: ${prirazenoKPrani}× (nezaložil se druhý záznam).`, 'success');
    }
    addLog(`✨ Hromadný import dokončen.`, 'info');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
