'use client';
import { useState } from 'react';
import Link from 'next/link';
import AudioUploader from '@/components/AudioUploader';
import SongEditModal from '@/components/SongEditModal';
import { createSong, deleteSong, updateSong, removeSongResource } from '@/app/admin/actions';
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

  const allGenres = Array.from(new Set(initialSongs.map(s => s.genre).filter(Boolean)));
  const allTags = Array.from(new Set(initialSongs.flatMap(s => s.tags || []).filter(Boolean)));
  const allBackgrounds = Array.from(new Set(initialSongs.map(s => s.backgroundUrl).filter(Boolean)));

  const filteredSongs = initialSongs.filter(song => {
    const hasAudio = !!song.audioUrl;
    const hasJson = !!song.jsonUrl || !!song.timingData;
    const hasLyrics = !!song.lyrics && song.lyrics.trim().length > 0;
    const isPublic = song.state === 'ACTIVE';

    if (statusFilter === 'PUBLISHED' && !isPublic) return false;
    if (statusFilter === 'DRAFTS' && isPublic) return false;
    if (statusFilter === 'MISSING_LYRICS' && hasLyrics) return false;
    if (statusFilter === 'MISSING_AUDIO' && hasAudio) return false;
    if (statusFilter === 'MISSING_TIMING' && hasJson) return false;
    if (statusFilter === 'READY_TO_PUBLISH' && (!hasAudio || !hasJson || !hasLyrics || isPublic)) return false;

    if (genreFilter !== 'ALL' && song.genre !== genreFilter) return false;
    if (tagFilter !== 'ALL' && !(song.tags || []).includes(tagFilter)) return false;

    const q = search.toLowerCase();
    if (q && !song.title.toLowerCase().includes(search.toLowerCase()) && !(song.artist || '').toLowerCase().includes(search.toLowerCase())) return false;

    return true;
  });

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
            <option value="PUBLISHED">🟢 PUBLIKOVÁNO</option>
            <option value="DRAFTS">⏳ ROZPRACOVÁNO</option>
            <option value="READY_TO_PUBLISH">🌟 PŘIPRAVENO</option>
        </select>
        <button 
          className={showForm ? "btn-secondary" : "btn-primary"} 
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '14px 28px', fontWeight: 900, borderRadius: '16px', letterSpacing: '0.05em' }}
        >
          {showForm ? 'ZAVŘÍT' : `➕ PŘIDAT HUDBU`}
        </button>
      </div>

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
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                      {song.artist && <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{song.artist}</span>}
                      <h3 style={{ fontSize: '20px', fontWeight: 900, margin: '4px 0', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</h3>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                         {song.genre && <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '10px', fontWeight: 700 }}>{song.genre}</span>}
                         {song.state === 'ACTIVE' && <span style={{ fontSize: '10px', background: 'rgba(0,177,64,0.15)', color: '#4ade80', padding: '4px 10px', borderRadius: '10px', fontWeight: 900 }}>LIVE ✅</span>}
                      </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setEditingSong(song)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '38px', height: '38px', borderRadius: '12px', cursor: 'pointer' }} title="Upravit detail">⚙️</button>
                      <button onClick={() => { if(confirm('Smazat?')) deleteSong(song.id); }} style={{ background: 'rgba(255,75,43,0.1)', border: 'none', color: '#ff4b2b', width: '38px', height: '38px', borderRadius: '12px', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>

                {/* STATUS SUMMARY */}
                <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '18px', justifyContent: 'space-around' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: hasAudio ? 1 : 0.3 }}>
                       <span style={{ fontSize: '18px' }}>🔉</span>
                       <span style={{ fontSize: '10px', fontWeight: 800, marginTop: '4px' }}>AUDIO</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: hasLyrics ? 1 : 0.3 }}>
                       <span style={{ fontSize: '18px' }}>📝</span>
                       <span style={{ fontSize: '10px', fontWeight: 800, marginTop: '4px' }}>TEXT</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: hasJson ? 1 : 0.3 }}>
                       <span style={{ fontSize: '18px' }}>⚙️</span>
                       <span style={{ fontSize: '10px', fontWeight: 800, marginTop: '4px' }}>STUDIO</span>
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
              </div>
� Spustit Render</button>
                             </Link>
                          )}
                        </div>
                      </div>
                    </div>
                </div>

                {/* PLAY BUTTON JEN ADMINI KONTROLA */}
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
      {editingSong && (
        <SongEditModal 
          song={editingSong} 
          onClose={() => setEditingSong(null)} 
          allGenres={allGenres as string[]} 
          allBackgrounds={allBackgrounds as string[]}
        />
      )}
    </div>
  );
}
