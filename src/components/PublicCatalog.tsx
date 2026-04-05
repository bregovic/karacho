'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function PublicCatalog({ initialSongs, isAdmin }: { initialSongs: any[], isAdmin: boolean }) {
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('POPULAR');
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

  const sortedSongs = [...filteredSongs].sort((a, b) => {
    if (sortBy === 'POPULAR') return (b.playCount || 0) - (a.playCount || 0);
    if (sortBy === 'NAME') return a.title.localeCompare(b.title);
    if (sortBy === 'NEWEST') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0;
  });

  const hasSongs = sortedSongs.length > 0;

  const [queueSize, setQueueSize] = useState(0);

  // Funkce pro přidání do fronty
  const addToQueue = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const q = JSON.parse(localStorage.getItem('karacho_queue') || '[]');
    q.push(id);
    localStorage.setItem('karacho_queue', JSON.stringify(q));
    setQueueSize(q.length);
    alert('✅ Přidáno do fronty!');
  };

  const selectStyle = { 
    padding: '12px 16px', borderRadius: '12px', 
    border: '1px solid rgba(255,255,255,0.12)', 
    background: '#1a1a1a', 
    color: '#fff', fontSize: '14px',
    outline: 'none',
    cursor: 'pointer'
  };

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
        
        {/* Indikátor fronty */}
        <div style={{ 
           position: 'fixed', top: '1.5rem', left: '1.5rem', zIndex: 100, 
           background: 'var(--color-gold)', color: 'black', padding: '6px 12px', 
           borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', 
           boxShadow: '0 0 20px rgba(0,0,0,0.5)', display: queueSize > 0 ? 'flex' : 'none',
           alignItems: 'center', gap: '8px'
        }}>
           <span>📜 VE FRONTĚ: {queueSize}</span>
           <button onClick={(e) => { e.stopPropagation(); localStorage.setItem('karacho_queue', '[]'); setQueueSize(0); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>

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
          maxWidth: '850px',
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
              flex: 2, 
              minWidth: '220px',
              fontSize: '15px',
              backdropFilter: 'blur(8px)',
              outline: 'none',
            }} 
          />

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
            <option value="POPULAR">🏆 TOP HRANÉ</option>
            <option value="NAME">🔤 PODLE ABECEDY</option>
            <option value="NEWEST">🆕 NEJNOVĚJŠÍ</option>
          </select>

          {allGenres.length > 0 && (
            <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">VŠECHNY ŽÁNRY</option>
              {allGenres.map(g => <option key={g as string} value={g as string}>{g as string}</option>)}
            </select>
          )}

          {allTags.length > 0 && (
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">VŠECHNY ŠTÍTKY</option>
              {allTags.map(t => <option key={t as string} value={t as string}>#{t as string}</option>)}
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
            {sortedSongs.map((song) => (
              <div key={song.id} className="glass-panel song-card" style={{ 
                padding: '1.5rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem',
                position: 'relative'
              }}>
                {/* ŽLUTÉ PLUS PRO FRONTU */}
                {(song.videoUrl || song.timingData || song.jsonUrl) && (
                  <button 
                    onClick={(e) => addToQueue(song.id, e)}
                    style={{ 
                      position: 'absolute', top: '-10px', right: '-10px', width: '36px', height: '36px', 
                      borderRadius: '50%', background: 'var(--color-gold)', border: 'none', 
                      color: 'black', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer', 
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 2, display: 'flex', 
                      alignItems: 'center', justifyContent: 'center' 
                    }}
                    title="Přidat do fronty"
                  >+</button>
                )}
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
