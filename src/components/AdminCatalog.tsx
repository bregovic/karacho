'use client';
import { useState } from 'react';
import Link from 'next/link';
import AudioUploader from '@/components/AudioUploader';
import { createSong, deleteSong } from '@/app/admin/actions';

export default function AdminCatalog({ initialSongs }: { initialSongs: any[] }) {
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const allGenres = Array.from(new Set(initialSongs.map(s => s.genre).filter(Boolean)));

  const filteredSongs = initialSongs.filter(song => {
    const hasAudio = !!song.audioUrl;
    const hasJson = !!song.jsonUrl;
    const hasVideo = !!song.videoUrl;

    // Filter by Status
    if (statusFilter === 'MISSING_AUDIO' && hasAudio) return false;
    if (statusFilter === 'MISSING_TIMING' && (!hasAudio || hasJson)) return false;
    if (statusFilter === 'MISSING_RENDER' && (!hasJson || hasVideo)) return false;
    if (statusFilter === 'DONE' && !hasVideo) return false;

    // Filter by Genre
    if (genreFilter !== 'ALL' && song.genre !== genreFilter) return false;

    // Search by Title/Artist
    const q = search.toLowerCase();
    if (q && !song.title.toLowerCase().includes(q) && !(song.artist || '').toLowerCase().includes(q)) return false;

    return true;
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
           <h1 style={{ color: 'var(--color-gold)', margin: 0, marginBottom: '0.5rem' }}>Administrace & Písně</h1>
           <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Kompletní řízení životního cyklu karaoke.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Zavřít panel' : '➕ Přidat novou píseň'}
        </button>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Nová píseň</h2>
          <form action={async (data) => { await createSong(data); setShowForm(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
               <input name="title" placeholder="Název" required style={{ flex: 2, padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} />
               <input name="artist" placeholder="Interpret" style={{ flex: 2, padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
               <input name="genre" placeholder="Žánr (např. Pop, 80s)" style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} />
               <input name="tags" placeholder="Štítky čárkou (např. Duet, Pomalé)" style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} />
            </div>
            <textarea name="lyrics" placeholder="Surový text písně k budoucímu naklíčování..." style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', minHeight: '120px' }} />
            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>Uložit do katalogu</button>
          </form>
        </div>
      )}

      {/* FILTRAČNÍ PANEL */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', flexWrap: 'wrap' }}>
        <input 
           type="text" placeholder="Hledat podle názvu..." 
           value={search} onChange={e => setSearch(e.target.value)}
           style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: '#fff', flex: 1, minWidth: '200px' }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: '#fff' }}>
            <option value="ALL">Všechny stavy cyklu</option>
            <option value="MISSING_AUDIO">1. Čeká na Audio (MP3)</option>
            <option value="MISSING_TIMING">2. Čeká na zklíčování ve Studiu</option>
            <option value="MISSING_RENDER">3. Čeká na Video Render</option>
            <option value="DONE">Hotové (Publikované)</option>
        </select>
        <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: '#fff' }}>
            <option value="ALL">Všechny žánry</option>
            {allGenres.map(g => <option key={g as string} value={g as string}>{g as string}</option>)}
        </select>
      </div>

      {filteredSongs.length === 0 ? (
         <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Žádné písně neodpovídají filtrům.</p>
      ) : (
         <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredSongs.map((song) => {
            const hasAudio = !!song.audioUrl;
            const hasJson = !!song.jsonUrl;
            const hasVideo = !!song.videoUrl;

            return (
              <div key={song.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.5rem', margin: 0 }}>
                      {song.artist ? <span style={{ opacity: 0.6, fontSize: '1.1rem', marginRight: '8px' }}>{song.artist} - </span> : ''}
                      <span style={{ color: 'var(--color-teal)' }}>{song.title}</span>
                      {song.genre && <span style={{ marginLeft: '12px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px' }}>{song.genre}</span>}
                  </h3>
                  <button onClick={async () => { if(confirm('Opravdu smazat?')) await deleteSong(song.id); }} style={{ background: 'transparent', border: '1px solid rgba(255,0,0,0.5)', color: '#ff4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                    Smazat
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '1rem' }}>
                        <h4 style={{ color: hasAudio ? 'var(--color-teal)' : 'var(--text-secondary)', marginBottom: '8px' }}>1. Audio stopa</h4>
                        {hasAudio ? <div style={{ color: '#0f0', fontSize: '13px' }}>✓ Uloženo: {song.audioUrl?.split('/').pop()}</div> : <AudioUploader songId={song.id} />}
                    </div>

                    <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '1rem', opacity: hasAudio ? 1 : 0.4 }}>
                        <h4 style={{ color: hasJson ? 'var(--color-teal)' : 'var(--text-secondary)', marginBottom: '8px' }}>2. Časování (Studio)</h4>
                        {hasJson ? (
                           <div style={{ color: '#0f0', fontSize: '13px' }}>✓ Zklíčováno ({song.jsonUrl?.split('/').pop()})</div>
                        ) : (
                           <div>
                              <Link href={`/designer?songId=${song.id}`}>
                                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={!hasAudio}>Otevřít ve Studiu</button>
                              </Link>
                           </div>
                        )}
                    </div>

                    <div style={{ flex: 1, opacity: hasJson ? 1 : 0.4 }}>
                        <h4 style={{ color: hasVideo ? 'var(--color-teal)' : 'var(--text-secondary)', marginBottom: '8px' }}>3. Video Export</h4>
                        {hasVideo ? (
                          <div style={{ color: '#0f0', fontSize: '13px' }}>✓ Publikováno</div>
                        ) : (
                          <div>
                            <Link href={`/renderer?songId=${song.id}`}>
                               <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={!hasJson}>Odeslat do Renderovny</button>
                            </Link>
                          </div>
                        )}
                    </div>
                </div>
              </div>
            );
          })}
         </div>
      )}
    </div>
  );
}
