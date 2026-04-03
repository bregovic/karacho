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
    const q = search.toLowerCase();
    if (q && !song.title.toLowerCase().includes(q) && !(song.artist || '').toLowerCase().includes(q)) return false;
    if (genreFilter !== 'ALL' && song.genre !== genreFilter) return false;
    if (tagFilter !== 'ALL' && !(song.tags || []).includes(tagFilter)) return false;
    return true;
  });

  const hasSongs = filteredSongs.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      
      {/* === HERO SEKCE === */}
      <section style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'clamp(2rem, 8vw, 5rem) 1rem clamp(1rem, 4vw, 3rem)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Glow background blob */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,180,216,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Animované logo */}
        <div className="hero-logo-wrap" style={{ position: 'relative', zIndex: 1, marginBottom: 'clamp(1.5rem, 4vw, 3rem)' }}>
          <div className="hero-logo-ring-2"></div>
          <div className="hero-logo-ring"></div>
          <img 
            src="/logo.png" 
            alt="Karacho" 
            className="hero-logo-img"
          />
        </div>

        {/* Filtrační panel */}
        <div className="hero-controls" style={{ 
          display: 'flex', 
          gap: '0.75rem', 
          flexWrap: 'wrap', 
          justifyContent: 'center',
          width: '100%',
          maxWidth: '640px',
          position: 'relative',
          zIndex: 1,
        }}>
          <input 
            type="text" 
            placeholder="🔍  Hledat interpreta nebo název..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ 
              padding: '12px 16px', 
              borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.12)', 
              background: 'rgba(255,255,255,0.05)', 
              color: '#fff', 
              flex: 1, 
              minWidth: '220px',
              fontSize: '15px',
              backdropFilter: 'blur(8px)',
              outline: 'none',
            }} 
          />

          {allGenres.length > 0 && (
            <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)} style={{ 
              padding: '12px 16px', borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.12)', 
              background: 'rgba(255,255,255,0.05)', 
              color: '#fff', fontSize: '14px',
            }}>
              <option value="ALL">Všechny žánry</option>
              {allGenres.map(g => <option key={g as string} value={g as string}>{g as string}</option>)}
            </select>
          )}

          {allTags.length > 0 && (
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={{ 
              padding: '12px 16px', borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.12)', 
              background: 'rgba(255,255,255,0.05)', 
              color: '#fff', fontSize: '14px',
            }}>
              <option value="ALL">Všechny štítky</option>
              {allTags.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
            </select>
          )}
        </div>
      </section>

      {/* === KATALOG === */}
      <section style={{ 
        flex: 1,
        padding: '0 clamp(1rem, 4vw, 2.5rem) clamp(2rem, 6vw, 4rem)',
        maxWidth: '1400px', 
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>
        {!hasSongs ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem 1rem', opacity: 0.7 }}>
            {isAdmin && initialSongs.length === 0 
              ? "Katalog je prázdný — přidejte první píseň v Administraci." 
              : search 
                ? `Nic nenalezeno pro „${search}".`
                : "Žádné skladby odpovídající výběru."}
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', 
            gap: 'clamp(1rem, 2vw, 1.5rem)',
          }}>
            {filteredSongs.map((song) => (
              <div key={song.id} className="glass-panel song-card" style={{ 
                padding: '1.5rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem',
              }}>
                <div>
                  {song.artist && (
                    <span style={{ opacity: 0.6, fontSize: '0.85rem', display: 'block', marginBottom: '2px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {song.artist}
                    </span>
                  )}
                  <h3 style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)', lineHeight: 1.2 }}>
                    {song.title}
                  </h3>
                </div>
                
                {/* Štítky */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {song.genre && (
                    <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: '20px', color: 'var(--text-secondary)' }}>
                      {song.genre}
                    </span>
                  )}
                  {Array.isArray(song.tags) && song.tags.map((t: string) => (
                    <span key={t} style={{ fontSize: '11px', background: 'rgba(0,180,216,0.15)', color: 'var(--color-teal)', padding: '3px 10px', borderRadius: '20px' }}>
                      #{t}
                    </span>
                  ))}
                </div>

                <div style={{ flex: 1 }} />

                {song.videoUrl || song.timingData || song.jsonUrl ? (
                  <Link href={`/player/${song.id}`} style={{ textDecoration: 'none' }}>
                    <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                      ▶ Přehrát Karaoke
                    </button>
                  </Link>
                ) : (
                  <button className="btn-secondary" disabled style={{ width: '100%', opacity: 0.4, cursor: 'default' }}>
                    ⏳ Připravuje se...
                  </button>
                )}

                {isAdmin && (
                  <Link href={`/admin`} style={{ textDecoration: 'none', textAlign: 'center', fontSize: '12px', color: 'var(--color-gold)', marginTop: '4px', display: 'block' }}>
                    ⚙️ Upravit v Administraci
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
