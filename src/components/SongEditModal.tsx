'use client';
import { useState } from 'react';
import { updateSong, updateSongAnimation, updateSongBackground, importLyricsFromUrl, researchSongDataAction, manuallyCleanLyricsAction, mergeDuetAction, createHelperTrackAction } from '@/app/admin/actions';
import BackgroundGalleryModal from './BackgroundGalleryModal';
import AudioUploader from './AudioUploader';

interface SongEditModalProps {
  song: any;
  onClose: () => void;
  onRefresh: () => void;
  onRemoveBackground: (url: string) => Promise<void>;
  allGenres?: string[];
  allBackgrounds?: string[];
  allSongs?: any[];
}

export default function SongEditModal({ 
  song, 
  onClose, 
  onRefresh, 
  onRemoveBackground,
  allGenres = [],
  allBackgrounds = [],
  allSongs = []
}: SongEditModalProps) {
  const [formData, setFormData] = useState(song);
  const [isSaving, setIsSaving] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [activeTextView, setActiveTextView] = useState<'lyrics' | 'chords'>('lyrics');
  const [blacklist, setBlacklist] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');

  /**
   * Posílá se JEN to, co se právě změnilo — ne celý `formData`.
   *
   * `formData` je snímek písně z chvíle, kdy se detail otevřel. Server ale
   * mezitím píseň mění sám: po nahrání obou stop ji posune na kontrolu
   * a u časování z LRC vybere verzi podle délky nahrávky. Odesláním celého
   * snímku se všechny tyhle změny přepsaly zpátky na staré hodnoty —
   * Alanis „Ironic" tak měla obě stopy a pořád visela v „čeká na zvuk".
   */
  const autoSave = async (updatedFields: any) => {
    try {
      const r: any = await updateSong(song.id, updatedFields);
      // Změna názvu nebo interpreta může narazit na píseň, která už
      // v katalogu pod tím jménem je. Server vrátí srozumitelnou zprávu.
      if (r && r.ok === false) { setImportStatus(`⚠️ ${r.error}`); return; }
      setImportStatus('✅ Změny automaticky uloženy');
      setTimeout(() => setImportStatus(null), 2000);
      // Přehled za oknem musí ukázat novou hodnotu — jinak se člověk vrátí
      // z detailu a vidí na kartě pořád tu starou.
      onRefresh();
    } catch (e) {
      setImportStatus('❌ Chyba auto-save');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Výslovný výčet polí formuláře. Odkazy na soubory, stav ani časování
      // se odtud neposílají — ty patří uploaderům a serveru, formulář o nich
      // má jen zastaralou představu.
      const r: any = await updateSong(song.id, {
        title: formData.title,
        artist: formData.artist,
        genre: formData.genre,
        tags: formData.tags,
        lyrics: formData.lyrics,
        chords: formData.chords,
        startTime: formData.startTime,
      });
      if (r && r.ok === false) {
        setImportStatus(`⚠️ ${r.error}`);
        return; // okno zůstává otevřené, ať se dá název opravit
      }
      onRefresh();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleResearch = async () => {
    setResearching(true);
    setImportStatus('⌛ Zjišťuji...');
    const res = await researchSongDataAction(song.id, formData.title, formData.artist);
    if (res.success && res.updated) {
      setFormData({ 
        ...formData, 
        ...res.updated,
        tags: res.updated.tags || formData.tags 
      });
      setImportStatus('✨ Data automaticky doplněna a uložena!');
      setTimeout(() => setImportStatus(null), 4000);
    } else {
      setImportStatus(`❌ ${res.error || 'Informace nenalezeny'}`);
    }
    setResearching(false);
  };

  const handleImportLyrics = async () => {
    if (!importUrl) return;
    setImportStatus('⌛ Stahuji...');
    const res = await importLyricsFromUrl(song.id, importUrl);
    if (res.success) {
      setFormData({ ...formData, lyrics: res.lyrics, chords: res.chords || formData.chords });
      setImportStatus('✅ Text úspěšně stažen a uložen!');
      setTimeout(() => setImportStatus(null), 3000);
    } else {
      setImportStatus(`❌ ${res.error}`);
    }
  };

  const handleCleanLyrics = async (customBlacklist: string[] = []) => {
    setImportStatus('⌛ Čistím...');
    
    // Čistíme vždy z aktuální hodnoty v okruhu AKORDY (zdroj pravdy)
    const sourceContent = formData.chords || formData.lyrics || '';
    
    const res = await manuallyCleanLyricsAction(song.id, sourceContent, customBlacklist);
    if (res.success && res.lyrics) {
      setFormData({ 
        ...formData, 
        lyrics: res.lyrics, 
        chords: res.chords || formData.chords 
      });
      setImportStatus('✅ Text vyčištěn a synchronizován!');
      setTimeout(() => setImportStatus(null), 3000);
    } else {
      setImportStatus(`❌ ${res.error}`);
    }
  };

  const handleMergeDuet = async () => {
    if (!mergeSourceId) return;
    
    setImportStatus('⌛ Slučuji JSONy...');
    try {
      const res = await mergeDuetAction(song.id, mergeSourceId);
      if (res.success) {
        setImportStatus('✅ Hlasy úspěšně sloučeny do duetu!');
        setTimeout(() => setImportStatus(null), 4000);
        onRefresh();
      } else {
        setImportStatus(`❌ Chyba: ${res.error}`);
      }
    } catch(err: any) {
      setImportStatus('❌ Chyba sítě.');
    }
  };

  const handleCreateHelper = async () => {
    setImportStatus('⌛ Vytvářím pomocnou stopu...');
    try {
      const res = await createHelperTrackAction(song.id);
      if (res.success) {
        setImportStatus(`✅ Nyní zavřete okno. V katalogu nahoře najdete stín [HLAS 2]. Vložte do něj text a běžte do jeho Studia!`);
        if (res.helperId) setMergeSourceId(res.helperId);
        setTimeout(() => setImportStatus(null), 10000);
        onRefresh();
      } else {
        setImportStatus(`❌ Chyba: ${res.error}`);
      }
    } catch(err: any) {
      setImportStatus('❌ Chyba sítě.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(15px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
      <div className="glass-panel" style={{ 
        width: '100%', 
        maxWidth: '850px', 
        padding: '0', 
        maxHeight: '95vh', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        {/* FIXED HEADER */}
        <div style={{ padding: '1.5rem 2rem 1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: 'var(--color-gold)' }}>✏️ EDITACE PÍSNĚ</h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>

        {importStatus && (
           <div style={{ 
              marginBottom: '1rem', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
              background: importStatus.includes('✅') || importStatus.includes('✨') ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
              color: importStatus.includes('✅') || importStatus.includes('✨') ? '#4ade80' : '#f87171',
              border: '1px solid currentColor', textAlign: 'center'
           }}>
             {importStatus}
           </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>ZÁKLADNÍ ÚDAJE</label>
              <button 
                onClick={handleResearch} 
                disabled={researching}
                className="btn-secondary" 
                style={{ padding: '4px 12px', fontSize: '10px', borderRadius: '8px', border: '1px solid var(--color-teal)', color: 'var(--color-teal)' }}
              >
                {researching ? "⌛ HLEDÁM..." : "🔍 RESEARCH DATA"}
              </button>
            </div>
            
            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em', marginTop: '0.5rem' }}>NÁZEV PÍSNĚ</label>
            <input className="input-field" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} onBlur={(e) => autoSave({ title: e.target.value })} />

            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>INTERPRET / AUTOR</label>
            <input className="input-field" value={formData.artist || ''} onChange={e => setFormData({ ...formData, artist: e.target.value })} onBlur={(e) => autoSave({ artist: e.target.value })} />

            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>ŽÁNR</label>
            <input className="input-field" value={formData.genre || ''} list="genres-list" onChange={e => setFormData({ ...formData, genre: e.target.value })} onBlur={(e) => autoSave({ genre: e.target.value })} />
            <datalist id="genres-list">
              {allGenres.map(g => <option key={g} value={g} />)}
            </datalist>

            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>ŠTÍTKY</label>
            <input className="input-field" value={(formData.tags || []).join(', ')} onChange={e => setFormData({ ...formData, tags: e.target.value.split(',').map((s: string) => s.trim()) })} onBlur={(e) => autoSave({ tags: e.target.value.split(',').map((s: string) => s.trim()) })} />
            
            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>ČAS ZAČÁTKU (S)</label>
            <input 
              type="number" 
              step="0.1" 
              className="input-field" 
              value={formData.startTime || 0} 
              onChange={e => setFormData({ ...formData, startTime: parseFloat(e.target.value) || 0 })} 
              onBlur={(e) => autoSave({ startTime: parseFloat(e.target.value) || 0 })} 
            />

            <div style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <label style={{ fontSize: '11px', color: 'var(--color-teal)', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'block' }}>NAHRÁVKY (MP3/WAV)</label>
               <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  {/* Uploader si URL uloží sám (`updateSongAudio`), tady se
                      jen dorovná zobrazení a obnoví přehled. Volat k tomu
                      ještě `autoSave` znamenalo poslat starý snímek písně
                      a přepsat tím, co server mezitím nastavil. */}
                  <AudioUploader songId={song.id} type="audio" onUploaded={(url) => { setFormData({ ...formData, audioUrl: url }); onRefresh(); }} />
                  <AudioUploader songId={song.id} type="instrumental" onUploaded={(url) => { setFormData({ ...formData, instrumentalUrl: url }); onRefresh(); }} />
               </div>
               <div style={{ fontSize: '10px', color: formData.audioUrl ? '#4ade80' : '#888', marginTop: '10px', textAlign: 'center', fontWeight: formData.audioUrl ? 800 : 400 }}>
                 {(formData.audioUrl || formData.instrumentalUrl) ? '✅ Audio je nahrané na serveru' : 'Zatím nebylo nahráno žádné audio'}
               </div>
            </div>

            {/* DUET MERGE SECTION */}
            <div style={{ marginTop: '0.5rem', background: 'rgba(0,210,255,0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(0,210,255,0.2)' }}>
               <label style={{ fontSize: '11px', color: '#00d2ff', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'block' }}>POKROČILÉ: DVOJHLASÝ DUET</label>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                 <button type="button" onClick={handleCreateHelper} className="btn-secondary" style={{ width: '100%', padding: '10px', fontSize: '11px', fontWeight: 800, border: '1px dashed #00d2ff' }}>
                    1️⃣ Vytvořit pomocnou stopu ([HLAS 2] i se sdíleným audiem)
                 </button>
                  <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'stretch' }}>
                    <select 
                       value={mergeSourceId} 
                       onChange={e => setMergeSourceId(e.target.value)}
                       style={{ 
                         flex: 1, 
                         minWidth: 0, 
                         padding: '10px', 
                         borderRadius: '8px', 
                         background: 'rgba(0,0,0,0.5)', 
                         color: 'white', 
                         border: '1px solid rgba(0,210,255,0.3)', 
                         fontSize: '11px', 
                         outline: 'none',
                         cursor: 'pointer'
                       }}
                    >
                       <option value="">-- Vyber připravený stín [HLAS 2] k připojení --</option>
                       
                       {/* 1. CHYTRÉ SHODY - Stejný interpret + [HLAS 2] tag */}
                       {(() => {
                          const isHlas2Match = (t: string) => /\[HLAS 2\]|\(HLAS 2\)|HLAS 2/i.test(t);
                          const smartMatches = allSongs.filter(s => 
                            s.id !== song.id && 
                            isHlas2Match(s.title) && 
                            (s.artist?.toLowerCase() === song.artist?.toLowerCase())
                          );
                          if (smartMatches.length === 0) return null;
                          return (
                            <>
                               <option disabled>✨ DOPORUČENÉ SHODY (Stejný interpret) ✨</option>
                               {smartMatches.map(s => (
                                  <option key={s.id} value={s.id}>{s.artist || '?'} - {s.title}</option>
                               ))}
                               <option disabled>──────────</option>
                            </>
                          );
                       })()}

                       {/* 2. OSTATNÍ STÍNY [HLAS 2] */}
                       {(() => {
                          const isHlas2Match = (t: string) => /\[HLAS 2\]|\(HLAS 2\)|HLAS 2/i.test(t);
                          const smartMatchesIds = allSongs
                            .filter(s => s.id !== song.id && isHlas2Match(s.title) && s.artist?.toLowerCase() === song.artist?.toLowerCase())
                            .map(m => m.id);
                          
                          const others = allSongs.filter(s => 
                            s.id !== song.id && 
                            isHlas2Match(s.title) && 
                            !smartMatchesIds.includes(s.id)
                          );
                          if (others.length === 0) return null;
                          return others.map(s => (
                             <option key={s.id} value={s.id}>{s.artist || '?'} - {s.title}</option>
                          ));
                       })()}

                       <option disabled>🎨 OSTATNÍ SKLADBY V KATALOGU 🎨</option>
                       {allSongs.filter(s => s.id !== song.id && !(/\[HLAS 2\]|\(HLAS 2\)|HLAS 2/i.test(s.title))).map(s => (
                          <option key={s.id} value={s.id}>{s.artist || '?'} - {s.title}</option>
                       ))}
                    </select>
                    <button 
                      type="button" 
                      onClick={handleMergeDuet} 
                      disabled={!mergeSourceId} 
                      className="btn-secondary" 
                      style={{ 
                        padding: '10px 14px', 
                        fontSize: '11px', 
                        fontWeight: 800, 
                        opacity: !mergeSourceId ? 0.3 : 1,
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                       2️⃣ PŘILEPIT
                    </button>
                  </div>
               </div>
               <div style={{ fontSize: '10px', color: '#888', marginTop: '10px', textAlign: 'center' }}>
                 Nehledáš už žádné složité ID. Prostě rozbal roletku a nalep ten správný [HLAS 2] z katalogu přímo na tenhle originál.
               </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>STYL ANIMACE</label>
            <select className="input-field" value={formData.animationStyle} onChange={async (e) => {
              const val = e.target.value;
              setFormData({ ...formData, animationStyle: val });
              await updateSongAnimation(song.id, val);
            }}>
              <option value="karaoke-classic">Klasický (spodní linka)</option>
              <option value="karaoke-modern">Moderní (středový)</option>
              <option value="karaoke-cinema">Cinema (velký text)</option>
            </select>

            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>POZADÍ</label>
            <div 
              style={{ 
                height: '40px', 
                borderRadius: '12px', 
                background: formData.backgroundUrl ? `url(${formData.backgroundUrl}) center/cover` : 'linear-gradient(45deg, #111, #222)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '10px', 
                fontWeight: 800, 
                color: '#fff', 
                textShadow: '0 2px 4px rgba(0,0,0,0.8)' 
              }}
              onClick={() => setShowGallery(true)}
            >
              {!formData.backgroundUrl && "➕ VYBRAT POZADÍ Z GALERIE"}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setActiveTextView('lyrics')}
                  style={{ padding: '6px 14px', fontSize: '10px', borderRadius: '8px', border: 'none', background: activeTextView === 'lyrics' ? 'var(--color-teal)' : 'transparent', color: activeTextView === 'lyrics' ? 'black' : 'white', fontWeight: 800, cursor: 'pointer' }}
                >
                  TEXT 🎤
                </button>
                <button 
                  type="button" 
                  onClick={() => setActiveTextView('chords')}
                  style={{ padding: '6px 14px', fontSize: '10px', borderRadius: '8px', border: 'none', background: activeTextView === 'chords' ? '#ff4b2b' : 'transparent', color: activeTextView === 'chords' ? 'white' : '#888', fontWeight: 800, cursor: 'pointer' }}
                >
                  AKORDY 🎸
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  placeholder="Blacklist (intro, sólo...)" 
                  value={blacklist} 
                  onChange={e => setBlacklist(e.target.value)}
                  style={{ padding: '6px 12px', fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-gold)', borderRadius: '8px', width: '130px' }}
                />
                <button 
                  type="button" 
                  onClick={() => handleCleanLyrics(blacklist.split(/[\s,]+/).filter(x => x))} 
                  className="btn-secondary" 
                  style={{ padding: '4px 12px', fontSize: '10px', borderRadius: '8px', border: '1px solid var(--color-gold)', color: 'var(--color-gold)' }}
                  title="Odstraní akordy a slova z blacklistu"
                >
                  🧹 VYČISTIT TEXT
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                placeholder="URL (karaoketexty, supermusic...)" 
                value={importUrl} 
                onChange={e => setImportUrl(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '11px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', width: '220px' }}
              />
              <button type="button" onClick={handleImportLyrics} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px' }}>🔗 IMPORT</button>
            </div>

            <textarea 
              className="input-field" 
              style={{ 
                height: '240px', 
                fontFamily: 'monospace', 
                fontSize: '13px', 
                lineHeight: '1.6',
                color: 'white',
                border: activeTextView === 'chords' ? '1px solid rgba(255,75,43,0.3)' : '1px solid rgba(255,255,255,0.1)',
                background: activeTextView === 'chords' ? 'rgba(255,75,43,0.1)' : 'rgba(0,0,0,0.5)'
              }} 
              value={(activeTextView === 'lyrics' ? formData.lyrics : formData.chords) || ''} 
              onChange={e => {
                const val = e.target.value;
                if (activeTextView === 'lyrics') setFormData({ ...formData, lyrics: val });
                else setFormData({ ...formData, chords: val });
              }}
              onBlur={(e) => {
                if (activeTextView === 'lyrics') autoSave({ lyrics: e.target.value });
                else autoSave({ chords: e.target.value });
              }}
            />
          </div>
        </div>

        </div>

        {/* FIXED STICKY FOOTER */}
        <div style={{ 
          padding: '1.5rem 2rem', 
          display: 'flex', 
          gap: '1rem', 
          justifyContent: 'flex-end', 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          background: 'rgba(20,20,20,0.8)', 
          backdropFilter: 'blur(10px)',
          zIndex: 10
        }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '12px 25px', borderRadius: '14px', fontSize: '13px', fontWeight: 800 }}>ZAVŘÍT</button>
          <button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="btn-primary" 
            style={{ 
              padding: '12px 35px', 
              background: 'var(--color-gold)', 
              color: '#000', 
              borderRadius: '14px', 
              fontWeight: 900,
              fontSize: '13px',
              boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)'
            }}
          >
            {isSaving ? "UKLÁDÁM..." : "💾 ULOŽIT VŠE"}
          </button>
        </div>
      </div>

      {showGallery && (
        <BackgroundGalleryModal 
          isOpen={showGallery}
          allBackgrounds={allBackgrounds}
          onSelect={async (url) => {
            setFormData({ ...formData, backgroundUrl: url });
            await updateSongBackground(song.id, url);
            setShowGallery(false);
          }}
          onClose={() => setShowGallery(false)}
          onRemove={(url) => onRemoveBackground(url)}
        />
      )}
    </div>
  );
}
