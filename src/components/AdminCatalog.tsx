'use client';
import { useState } from 'react';
import Link from 'next/link';
import AudioUploader from '@/components/AudioUploader';
import BulkUploader from '@/components/BulkUploader';
import SongEditModal from '@/components/SongEditModal';
import { createSong, deleteSong, updateSong, removeSongResource, bulkRemoveBackground, bulkUpdateState, fetchLyricsAction, bulkFetchMissingLyrics } from '@/app/admin/actions';
import { autoAlignSong } from '@/app/admin/auto-align';
import { useTranslation } from '@/lib/translations';

export default function AdminCatalog({ initialSongs }: { initialSongs: any[] }) {
  const t = useTranslation('cs');
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editingSong, setEditingSong] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pomůcka pro určení stavu workflow
  const getWorkflowStep = (s: any) => {
    const hasLyrics = !!s.lyrics && s.lyrics.trim().length > 0;
    const hasAudio = !!s.audioUrl;
    const hasInstr = !!s.instrumentalUrl;
    const hasTiming = !!s.jsonUrl || !!s.timingData;
    const isActive = s.state === 'ACTIVE';

    if (!hasLyrics) return 'MISSING_LYRICS';
    if (!hasAudio) return 'MISSING_AUDIO';
    if (!hasInstr) return 'MISSING_INSTR';
    if (!hasTiming) return 'MISSING_TIMING';
    if (!isActive) return 'REVIEW';
    return 'ACTIVE';
  };

  const allGenres = Array.from(new Set(initialSongs.map(s => s.genre).filter(Boolean)));
  const allTags = Array.from(new Set(initialSongs.flatMap(s => s.tags || []).filter(Boolean)));
  const systemBackgrounds = [
    '/backgrounds/disco.png',
    '/backgrounds/rock.png',
    '/backgrounds/retro_80s.png',
    '/backgrounds/jazz.png',
    '/backgrounds/pop.png',
    '/backgrounds/country.png',
    '/backgrounds/hiphop.png',
    '/backgrounds/jungle.png',
    '/backgrounds/rocknroll.png',
    '/backgrounds/opera.png',
    '/backgrounds/hightech.png',
    '/backgrounds/matrix.png',
    '/backgrounds/tekkno.png',
    '/backgrounds/funk.png'
  ];

  const allBackgrounds = Array.from(new Set([
    ...systemBackgrounds,
    ...initialSongs.map(s => s.backgroundUrl).filter(Boolean)
  ]));

  const filteredSongs = initialSongs.filter(song => {
    const step = getWorkflowStep(song);
    
    if (statusFilter !== 'ALL' && step !== statusFilter) return false;
    if (genreFilter !== 'ALL' && song.genre !== genreFilter) return false;
    if (tagFilter !== 'ALL' && !(song.tags || []).includes(tagFilter)) return false;

    const q = search.toLowerCase();
    if (q && !song.title.toLowerCase().includes(search.toLowerCase()) && !(song.artist || '').toLowerCase().includes(search.toLowerCase())) return false;

    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const clearSelection = () => setSelectedIds([]);
  const selectAllFiltered = () => setSelectedIds(Array.from(new Set([...selectedIds, ...filteredSongs.map(s => s.id)])));

  return (
    <div style={{ padding: 'clamp(1rem, 4vw, 2.5rem)', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* FILTRAČNÍ PANEL S TLAČÍTKEM + NOVÁ PÍSEŇ */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', background: 'rgba(255,255,255,0.04)', padding: '1.2rem', borderRadius: '24px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
        <input 
           type="text" 
           placeholder={t('search_placeholder')}
           value={search} onChange={e => setSearch(e.target.value)}
           style={{ padding: '14px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.4)', color: '#fff', flex: 1, minWidth: '220px', fontSize: '15px' }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '14px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: '#fff', fontWeight: 600 }}>
            <option value="ALL">🔍 VŠECHNY STAVY</option>
            <option value="MISSING_LYRICS">✍️ CHYBÍ TEXT</option>
            <option value="MISSING_AUDIO">🎵 CHYBÍ HUDBA</option>
            <option value="MISSING_INSTR">🎻 CHYBÍ INSTRUM.</option>
            <option value="MISSING_TIMING">⏱️ CHYBÍ ČASOVÁNÍ</option>
            <option value="REVIEW">🚦 KONTROLA</option>
            <option value="ACTIVE">🟢 PUBLIKOVÁNO</option>
        </select>
        <button onClick={selectAllFiltered} className="btn-secondary" style={{ padding: '10px' }}>Vybrat vše</button>
        <button onClick={async () => { if(confirm('Zkusit automaticky najít texty pro všechny písně, kde chybí?')) await bulkFetchMissingLyrics(); }} className="btn-primary" style={{ padding: '14px 20px', background: 'var(--color-teal)', color: 'white', borderRadius: '16px', fontWeight: 700 }}>⚡ AUTOMATICKY DOPLNIT TEXTY</button>
        <button 
          className={showForm ? "btn-secondary" : "btn-primary"} 
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '14px 28px', fontWeight: 900, borderRadius: '16px', letterSpacing: '0.05em' }}
        >
          {showForm ? 'ZAVŘÍT' : `➕ PŘIDAT HUDBU`}
        </button>
        <BulkUploader initialSongs={initialSongs} />
      </div>
 
      {/* FORMULÁŘ PRO NOVOU PÍSEŇ */}
      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '2.5rem', padding: '2.5rem', borderRadius: '32px', border: '1px solid var(--color-teal)', animation: 'slideDown 0.3s ease-out' }}>
          <h2 style={{ color: 'var(--color-gold)', marginBottom: '1.5rem', fontSize: '24px' }}>🎵 Přidat novou skladbu</h2>
          <form action={async (fd) => { await createSong(fd); setShowForm(false); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase' }}>Název skladby *</label>
              <input name="title" required placeholder="Např. Zvonky štěstí" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase' }}>Interpret</label>
              <input name="artist" placeholder="Např. Karel Gott" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase' }}>Žánr</label>
              <input name="genre" placeholder="Např. Pop, Rock..." style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase' }}>Štítky (oddělené čárkou)</label>
              <input name="tags" placeholder="cz, 80s, duo..." style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase' }}>Text písně (Základní lyrics)</label>
              <textarea name="lyrics" rows={6} placeholder="Zkopírujte sem text písně..." style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary" style={{ padding: '16px 40px', background: 'var(--color-teal)', borderRadius: '16px', fontWeight: 900 }}>💾 ULOŽIT PÍSEŇ</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} style={{ padding: '16px 40px', borderRadius: '16px', fontWeight: 900 }}>ZRUŠIT</button>
            </div>
          </form>
          <style jsx>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* SEZNAM PÍSNÍ */}
      {filteredSongs.length === 0 ? (
         <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '5rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '30px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎵</div>
            <p>Žádné písně neodpovídají zvoleným filtrům.</p>
         </div>
      ) : (
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))', gap: '2rem' }}>
          {filteredSongs.map((song) => {
            const hasAudio = !!song.audioUrl;
            const hasJson = !!song.jsonUrl || !!song.timingData;
            const hasLyrics = !!song.lyrics && song.lyrics.trim().length > 0;
            const canPlay = !!song.videoUrl || hasJson;

            return (
              <div key={song.id} className="glass-panel song-card-admin" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRadius: '32px', transition: 'all 0.3s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(song.id)} 
                        onChange={() => toggleSelect(song.id)}
                        style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--color-teal)' }} 
                      />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                          {song.artist && <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{song.artist}</span>}
                          <h3 style={{ fontSize: '20px', fontWeight: 900, margin: '4px 0', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</h3>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                             {song.genre && <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '10px', fontWeight: 700 }}>{song.genre}</span>}
                             {song.state === 'ACTIVE' && <span style={{ fontSize: '10px', background: 'rgba(0,177,64,0.15)', color: '#4ade80', padding: '4px 10px', borderRadius: '10px', fontWeight: 900 }}>LIVE ✅</span>}
                          </div>
                      </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={async () => { if(confirm('Načíst text z API?')) await fetchLyricsAction(song.id); }} style={{ background: 'rgba(0,177,64,0.1)', border: 'none', color: '#00B140', width: '38px', height: '38px', borderRadius: '12px', cursor: 'pointer' }} title="Načíst text">✍️</button>
                      <button onClick={() => setEditingSong(song)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '38px', height: '38px', borderRadius: '12px', cursor: 'pointer' }} title="Upravit detail">⚙️</button>
                      <button onClick={() => { if(confirm('Smazat?')) deleteSong(song.id); }} style={{ background: 'rgba(255,75,43,0.1)', border: 'none', color: '#ff4b2b', width: '38px', height: '38px', borderRadius: '12px', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>

                {/* STATUS & UPLOADERS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <span style={{ fontSize: '10px', fontWeight: 800, color: hasAudio ? 'var(--color-teal)' : '#666', textAlign: 'center', textTransform: 'uppercase' }}>1. Audio {hasAudio && '✅'}</span>
                       <AudioUploader songId={song.id} type="audio" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <span style={{ fontSize: '10px', fontWeight: 800, color: !!song.instrumentalUrl ? 'var(--color-teal)' : '#666', textAlign: 'center', textTransform: 'uppercase' }}>2. Instr. {!!song.instrumentalUrl && '✅'}</span>
                       <AudioUploader songId={song.id} type="instrumental" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <span style={{ fontSize: '10px', fontWeight: 800, color: hasJson ? 'var(--color-teal)' : '#666', textAlign: 'center', textTransform: 'uppercase' }}>3. Studio {hasJson && '✅'}</span>
                       <AudioUploader songId={song.id} type="json" />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                    <Link href={`/designer?songId=${song.id}`} style={{ flex: 1.2 }}>
                      <button className="btn-primary" style={{ width: '100%', padding: '14px', background: 'var(--color-teal)', fontWeight: 900, borderRadius: '16px' }} disabled={!hasAudio}>🛠️ STUDIO</button>
                    </Link>
                    <Link href={`/player/${song.id}`} style={{ flex: 1 }}>
                      <button className="btn-primary" style={{ width: '100%', padding: '14px', background: 'linear-gradient(45deg, #FFD700, #FFA500)', color: '#000', fontWeight: 900, borderRadius: '16px' }} disabled={!hasJson}>▶ PŘEHRÁT</button>
                    </Link>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {canPlay && (
                    <Link href={`/player/${song.id}`} title="Zpívat" style={{ flex: 1 }}>
                      <button className="btn-primary" style={{ width: '100%', padding: '10px' }}>🎤 Zpívat</button>
                    </Link>
                  )}
                  {hasJson && (
                    <Link href={`/designer?songId=${song.id}`} style={{ flex: canPlay ? 0 : 1 }}>
                       <button className="btn-secondary" style={{ width: '100%', padding: '10px' }} title="Upravit časování">⚙️ Studio</button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
         </div>
      )}

      {/* STICKY BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)',
          padding: '1rem 2rem', borderRadius: '24px', border: '2px solid var(--color-teal)',
          display: 'flex', alignItems: 'center', gap: '2rem', zIndex: 1000,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'slideIn 0.3s ease-out'
        }}>
           <div style={{ color: 'white', fontWeight: 800 }}>
             Vybráno: <span style={{ color: 'var(--color-teal)' }}>{selectedIds.length}</span> písní
           </div>
           <div style={{ display: 'flex', gap: '10px' }}>
             <button onClick={async () => { if(confirm('Zveřejnit vybrané písně?')) { await bulkUpdateState(selectedIds, 'ACTIVE'); clearSelection(); } }} className="btn-primary" style={{ padding: '10px 20px', background: 'var(--color-teal)', borderRadius: '14px' }}>🚀 PUBLIKOVAT VYBRANÉ</button>
             <button onClick={clearSelection} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 10px' }}>Zrušit</button>
           </div>
        </div>
      )}
      {editingSong && (
        <SongEditModal 
          song={editingSong} 
          onClose={() => setEditingSong(null)} 
          allGenres={allGenres as string[]} 
          allBackgrounds={allBackgrounds as string[]}
          onRemoveBackground={bulkRemoveBackground}
        />
      )}
    </div>
  );
}
