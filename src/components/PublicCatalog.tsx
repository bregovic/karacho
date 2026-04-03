'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function PublicCatalog({ initialSongs, isAdmin }: { initialSongs: any[], isAdmin: boolean }) {
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const allGenres = Array.from(new Set(initialSongs.map(s => s.genre).filter(Boolean)));
  const allTags = Array.from(new Set(initialSongs.flatMap(s => s.tags || []).filter(Boolean)));

  const filteredSongs = initialSongs.filter((song) => {
    // Search
    const q = search.toLowerCase();
    if (q && !song.title.toLowerCase().includes(q) && !(song.artist || '').toLowerCase().includes(q)) return false;

    // Genre
    if (genreFilter !== 'ALL' && song.genre !== genreFilter) return false;

    // Tags
    if (tagFilter !== 'ALL' && !(song.tags || []).includes(tagFilter)) return false;

    return true;
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Veřejný katalog písní */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
         <h1 style={{ fontSize: '3rem', color: 'var(--text-primary)' }}>Vyberte si <span style={{ color: 'var(--color-teal)' }}>Karacho.</span></h1>
         <p style={{ color: 'var(--text-secondary)' }}>Katalog hotových karaoke skladeb připravených k přehrání.</p>
      </div>

      {/* Filtrační ovládací prvky */}
      <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <input 
             type="text" placeholder="Hledat interpreta nebo název..." 
             value={search} onChange={e => setSearch(e.target.value)}
             style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: '#fff', flex: 1, minWidth: '250px' }}
          />

          {allGenres.length > 0 && (
             <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: '#fff' }}>
                <option value="ALL">Všechny žánry</option>
                {allGenres.map(g => <option key={g as string} value={g as string}>{g as string}</option>)}
             </select>
          )}

          {allTags.length > 0 && (
             <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#111', color: '#fff' }}>
                <option value="ALL">Všechny štítky</option>
                {allTags.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
             </select>
          )}
      </div>

      {filteredSongs.length === 0 ? (
         <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem' }}>
            {isAdmin && initialSongs.length === 0 ? "Katalog je zatím prázdný. Běžte do administrace přidat první píseň." : "Žádné skladby neodpovídají hledání."}
         </div>
      ) : (
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
           {filteredSongs.map((song) => (
              <div key={song.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'transform 0.2s', cursor: 'pointer' }}>
                <h3 style={{ fontSize: '1.4rem' }}>
                  {song.artist ? <span style={{ opacity: 0.7, fontSize: '1.1rem', display: 'block' }}>{song.artist}</span> : null}
                  {song.title}
                </h3>
                
                {/* Zobrazení štítků a žánru u písně pro lidi */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                   {song.genre && <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px' }}>{song.genre}</span>}
                   {Array.isArray(song.tags) && song.tags.map((t: string) => (
                      <span key={t} style={{ fontSize: '11px', background: 'rgba(0,180,255,0.1)', color: '#00e5ff', padding: '2px 8px', borderRadius: '12px' }}>#{t}</span>
                   ))}
                </div>

                <div style={{ flex: 1 }}></div>

                {song.videoUrl ? (
                   <Link href={`/player?songId=${song.id}`} style={{ textDecoration: 'none' }}>
                     <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                       ▶ Přehrát Karaoke
                     </button>
                   </Link>
                ) : (
                   <button className="btn-secondary" disabled style={{ width: '100%', opacity: 0.5 }}>
                     Připravuje se...
                   </button>
                )}

                {isAdmin && (
                  <Link href="/admin" style={{ textDecoration: 'none', textAlign: 'center', fontSize: '12px', color: 'var(--color-gold)', marginTop: '8px', display: 'block' }}>
                    ⚙️ Upravit v Administraci
                  </Link>
                )}
              </div>
           ))}
         </div>
      )}
    </div>
  );
}
