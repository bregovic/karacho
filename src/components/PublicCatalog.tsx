'use client';

import { useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { updateSessionState, advanceSessionQueue, addToSessionQueue } from '@/app/actions/session-actions';

interface Song {
  id: string;
  title: string;
  artist: string | null;
  genre: string | null;
  tags: string[];
  playCount: number;
  createdAt: string | Date;
  videoUrl?: string | null;
  timingData?: any | null;
  jsonUrl?: string | null;
}

export default function PublicCatalog({ initialSongs, isAdmin }: { initialSongs: Song[]; isAdmin: boolean }) {
  const { joinCode, sessionData, refreshSession } = useSession();
  
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('POPULAR');
  const [showToast, setShowToast] = useState(false);
  const [queueSize, setQueueSize] = useState(0);

  const allGenres = Array.from(new Set(initialSongs.map(s => s.genre).filter(Boolean)));
  const allTags = Array.from(new Set(initialSongs.flatMap(s => s.tags || []).filter(Boolean)));

  const filteredSongs = initialSongs.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(search.toLowerCase()) || 
                         (song.artist?.toLowerCase() || '').includes(search.toLowerCase());
    const matchesGenre = genreFilter === 'ALL' || song.genre === genreFilter;
    const matchesTag = tagFilter === 'ALL' || (song.tags && song.tags.includes(tagFilter));
    return matchesSearch && matchesGenre && matchesTag;
  });

  const sortedSongs = [...filteredSongs].sort((a, b) => {
    if (sortBy === 'POPULAR') return (b.playCount || 0) - (a.playCount || 0);
    if (sortBy === 'TITLE_ASC') return a.title.localeCompare(b.title, 'cs');
    if (sortBy === 'ARTIST_ASC') return (a.artist || '').localeCompare(b.artist || '', 'cs');
    if (sortBy === 'NEWEST') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0;
  });

  const hasSongs = sortedSongs.length > 0;

  // Funkce pro přidání do fronty
  const handleAddToQueue = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (joinCode) {
      // Odeslat do společné relace
      await addToSessionQueue(joinCode, id);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      refreshSession();
    } else {
      // Lokální fronta fallback
      const q = JSON.parse(localStorage.getItem('karacho_queue') || '[]');
      q.push(id);
      localStorage.setItem('karacho_queue', JSON.stringify(q));
      setQueueSize(q.length);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  };

  // Dálkové ovládání TV
  const remoteControl = async (action: 'PLAY' | 'PAUSE' | 'NEXT') => {
    if (!joinCode) return;
    if (action === 'NEXT') {
      await advanceSessionQueue(joinCode);
    } else {
      await updateSessionState(joinCode, { status: action === 'PLAY' ? 'PLAYING' : 'PAUSED' });
    }
    refreshSession();
  };

  const selectStyle = { 
    padding: '12px 16px', borderRadius: '12px', 
    border: '1px solid rgba(255,255,255,0.12)', 
    background: '#1a1a1a', 
    color: '#fff', fontSize: '14px',
    outline: 'none', cursor: 'pointer'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', paddingBottom: joinCode ? '100px' : '0' }}>
      
      {/* === HERO SEKCE === */}
      <section style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: 'clamp(2rem, 8vw, 5rem) 1rem clamp(1rem, 4vw, 3rem)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,180,216,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="hero-logo-wrap" style={{ position: 'relative', zIndex: 1, marginBottom: 'clamp(1.5rem, 4vw, 3rem)' }}>
          <img src="/logo.png" alt="Karacho" className="hero-logo-img" />
        </div>

        <div className="hero-controls" style={{ 
          display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center',
          width: '100%', maxWidth: '900px', position: 'relative', zIndex: 1,
        }}>
          <input 
            type="text" placeholder="🔍  Hledat interpreta nebo název..." 
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ 
              padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', 
              background: 'rgba(255,255,255,0.05)', color: '#fff', flex: 2, minWidth: '220px',
              fontSize: '15px', backdropFilter: 'blur(8px)', outline: 'none'
            }} 
          />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
            <option value="POPULAR">🏆 TOP HRANÉ</option>
            <option value="TITLE_ASC">🎵 PÍSEŇ (A-Z)</option>
            <option value="ARTIST_ASC">🎤 INTERPRET (A-Z)</option>
            <option value="NEWEST">🆕 NEJNOVĚJŠÍ</option>
          </select>
          {allGenres.length > 0 && (
            <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">VŠECHNY ŽÁNRY</option>
              {allGenres.map(g => <option key={g as string} value={g as string}>{g as string}</option>)}
            </select>
          )}
        </div>
      </section>

      {/* === KATALOG === */}
      <section style={{ 
        flex: 1, padding: '0 clamp(1rem, 4vw, 2.5rem) clamp(2rem, 6vw, 4rem)',
        maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box'
      }}>
        {!hasSongs ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '4rem 1rem' }}>
            Nic nenalezeno.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
            {sortedSongs.map((song) => (
              <div key={song.id} className="glass-panel" style={{ 
                padding: '1.5rem', borderRadius: '24px', position: 'relative',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)'
              }}>
                {/* DECENTNÍ PLUS */}
                <button 
                  onClick={(e) => handleAddToQueue(song.id, e)}
                  style={{ 
                    position: 'absolute', top: '12px', right: '12px', width: '28px', height: '28px', 
                    borderRadius: '50%', background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.2)', 
                    color: 'var(--color-gold)', cursor: 'pointer', zIndex: 2, display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', fontSize: '18px'
                  }}
                  className="plus-btn"
                >+</button>

                <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>{song.title}</h3>
                    <p style={{ opacity: 0.5, fontSize: '14px', margin: 0 }}>{song.artist || 'Neznámý interpret'}</p>
                </div>
                
                <a href={`/player/${song.id}`} style={{ textDecoration: 'none' }}>
                    <button className="btn-primary" style={{ width: '100%', padding: '10px' }}>▶ PŘEHRÁT</button>
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 📱 DÁLKOVÉ OVLÁDÁNÍ (Zobrazí se jen když je joinCode) */}
      {joinCode && sessionData && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          width: '90%', maxWidth: '400px', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
          padding: '12px 24px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 5000,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase' }}>Ovladač relace {joinCode}</span>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-gold)' }}>
              {sessionData.status === 'PLAYING' ? '⏺️ PRÁVĚ HRAJE' : '⏸️ POZASTAVENO'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
             {sessionData.status === 'PLAYING' ? (
                <button onClick={() => remoteControl('PAUSE')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', fontSize: '18px' }}>⏸️</button>
             ) : (
                <button onClick={() => remoteControl('PLAY')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-gold)', border: 'none', cursor: 'pointer', fontSize: '18px' }}>▶️</button>
             )}
             <button onClick={() => remoteControl('NEXT')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>⏭️</button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {showToast && (
        <div style={{
          position: 'fixed', bottom: joinCode ? '110px' : '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,180,216,0.9)', color: 'white', padding: '10px 20px', borderRadius: '20px',
          zIndex: 6000, fontWeight: 600, animation: 'slideUp 0.3s'
        }}>
          ✅ Skladba zařazena do fronty
        </div>
      )}

      <style jsx>{`
        .plus-btn:hover { background: rgba(255,215,0,0.3) !important; transform: scale(1.1); }
        .hero-logo-img { height: 60px; filter: drop-shadow(0 0 20px rgba(0,180,216,0.3)); }
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}
