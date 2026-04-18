'use client';
import { useState } from 'react';
import Link from 'next/link';
import AudioUploader from '@/components/AudioUploader';
import BulkUploader from '@/components/BulkUploader';
import SongEditModal from '@/components/SongEditModal';
import { createSong, deleteSong, updateSong, removeSongResource, bulkRemoveBackground, bulkUpdateState, fetchLyricsAction, bulkFetchMissingLyrics, checkDuplicateSong } from '@/app/admin/actions';
import { autoAlignSong } from '@/app/admin/auto-align';
import { useTranslation } from '@/lib/translations';

import AdminTeam from '@/components/AdminTeam';

export default function AdminCatalog({ 
  initialSongs,
  adminEmails = []
}: { 
  initialSongs: any[],
  adminEmails?: any[]
}) {
  const t = useTranslation('cs');
  const [activeTab, setActiveTab] = useState<'SONGS' | 'TEAM' | 'TECH'>('SONGS');
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  // ... rest of state
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
    if (q && 
        !song.title.toLowerCase().includes(q) && 
        !(song.artist || '').toLowerCase().includes(q) &&
        !(song.tags || []).some((t: string) => t.toLowerCase().includes(q))
    ) return false;

    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const clearSelection = () => setSelectedIds([]);
  const selectAllFiltered = () => setSelectedIds(Array.from(new Set([...selectedIds, ...filteredSongs.map(s => s.id)])));

  return (
    <div style={{ padding: 'clamp(0.75rem, 3vw, 2.5rem)', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', overflowX: 'hidden', width: '100%' }}>
          {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('SONGS')}
          style={{ 
            padding: '12px 14px', 
            borderRadius: '14px', 
            border: 'none', 
            background: activeTab === 'SONGS' ? 'var(--color-teal)' : 'rgba(255,255,255,0.05)', 
            color: activeTab === 'SONGS' ? 'black' : 'white',
            fontWeight: 800,
            cursor: 'pointer',
            flex: '1 1 140px',
            fontSize: '12px',
            whiteSpace: 'nowrap'
          }}
        >
          🎵 KATALOG
        </button>
        <button 
          onClick={() => setActiveTab('TEAM')}
          style={{ 
            padding: '12px 14px', 
            borderRadius: '14px', 
            border: 'none', 
            background: activeTab === 'TEAM' ? 'var(--color-teal)' : 'rgba(255,255,255,0.05)', 
            color: activeTab === 'TEAM' ? 'black' : 'white',
            fontWeight: 800,
            cursor: 'pointer',
            flex: '1 1 140px',
            fontSize: '12px',
            whiteSpace: 'nowrap'
          }}
        >
          👥 TÝM
        </button>
        <Link href="/admin/tech" style={{ textDecoration: 'none', flex: '1 1 140px' }}>
          <button 
            style={{ 
              width: '100%',
              padding: '12px 14px', 
              borderRadius: '14px', 
              border: '1px solid rgba(255,215,0,0.2)', 
              background: 'rgba(255,215,0,0.1)', 
              color: 'var(--color-gold)',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            ⚙️ TECH
          </button>
        </Link>
      </div>

      {activeTab === 'TEAM' ? (
        <AdminTeam adminEmails={adminEmails} />
      ) : (
        <>
          {/* KOMPAKTNÍ FILTRAČNÍ PULT */}
          <div className="admin-filters" style={{ 
            display: 'flex', gap: '0.75rem', marginBottom: '2rem', 
            background: 'rgba(255,255,255,0.03)', padding: '0.8rem', 
            borderRadius: '24px', flexWrap: 'wrap', alignItems: 'center', 
            border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <input 
              type="text" 
              placeholder={t('search_placeholder')}
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ padding: '12px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.4)', color: '#fff', flex: '2 1 280px', fontSize: '14px', outline: 'none' }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: '1 1 150px', padding: '12px', borderRadius: '14px', background: '#111', color: '#fff', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="ALL">🔍 VŠECHNY STAVY</option>
                <option value="MISSING_LYRICS">✍️ TEXT</option>
                <option value="MISSING_AUDIO">🎵 AUDIO</option>
                <option value="MISSING_INSTR">🎻 INSTR.</option>
                <option value="MISSING_TIMING">⏱️ STUDIO</option>
                <option value="REVIEW">🚦 KONTROLA</option>
                <option value="ACTIVE">🟢 LIVE</option>
            </select>
            <div style={{ display: 'flex', gap: '8px', flex: '1 1 200px' }}>
                <button 
                  className={showForm ? "btn-secondary" : "btn-primary"} 
                  onClick={() => setShowForm(!showForm)}
                  style={{ padding: '12px', fontWeight: 900, borderRadius: '14px', fontSize: '11px', flex: 1 }}
                >
                  {showForm ? 'ZAVŘÍT' : `➕ PŘIDAT HUDBU`}
                </button>
            </div>
          </div>
 
      {/* FORMULÁŘ PRO NOVOU PÍSEŇ */}
      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '2.5rem', padding: '2.5rem', borderRadius: '32px', border: '1px solid var(--color-teal)', animation: 'slideDown 0.3s ease-out' }}>
          <h2 style={{ color: 'var(--color-gold)', marginBottom: '1.5rem', fontSize: '24px' }}>🎵 Přidat novou skladbu</h2>
          <form onSubmit={async (e) => { 
            e.preventDefault();
            const fd = new FormData(e.target as HTMLFormElement);
            const title = fd.get('title') as string;
            const artist = fd.get('artist') as string;
            
            const dup = await checkDuplicateSong(title, artist);
            if (dup) {
              if (!confirm(`⚠️ Píseň "${dup.title}" od "${dup.artist || '?'}" už v katalogu existuje (ID: ${dup.id}, Stav: ${dup.state}). Chcete ji i přesto vytvořit znovu?`)) {
                return;
              }
            }
            
            await createSong(fd); 
            setShowForm(false); 
          }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
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
              <input name="genre" list="genre-list" placeholder="Např. Pop, Rock..." style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              <datalist id="genre-list">
                {allGenres.map(g => <option key={g as string} value={g as string} />)}
              </datalist>
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
            const canPlay = !!song.videoUrl || hasJson;

            return (
              <div key={song.id} className="glass-panel song-card-admin" style={{ padding: 'min(1.5rem, 4vw)', display: 'flex', flexDirection: 'column', gap: '1.2rem', borderRadius: '28px', transition: 'all 0.3s', boxSizing: 'border-box', overflow: 'hidden' }}>
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

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                    <Link href={`/designer?songId=${song.id}`} style={{ flex: 1 }}>
                      <button className="btn-primary" style={{ width: '100%', padding: '12px', background: 'var(--color-teal)', fontWeight: 900, borderRadius: '14px', fontSize: '13px' }} disabled={!hasAudio}>🛠️ STUDIO</button>
                    </Link>
                    <Link href={`/player/${song.id}`} style={{ flex: 1 }}>
                      <button className="btn-primary" style={{ width: '100%', padding: '12px', background: 'linear-gradient(45deg, #FFD700, #FFA500)', color: '#000', fontWeight: 900, borderRadius: '14px', fontSize: '13px' }} disabled={!hasJson}>▶ PŘEHRÁT</button>
                    </Link>
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
          onRefresh={() => {}} // In Next.js with Server Actions, revalidatePath handles this, or we can add a local reload
        />
      )}
        </>
      )}
    </div>
  );
}
