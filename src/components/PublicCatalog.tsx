'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { updateSessionState, advanceSessionQueue, addToSessionQueue, removeFromSessionQueue } from '@/app/actions/session-actions';
import { requestSong, checkDuplicateSong } from '@/app/admin/actions';

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
  const { joinCode, sessionData, refreshSession, createOrJoin } = useSession();
  const { showToast } = useToast();
  const router = useRouter();

  // Definice dat pro frontu
  const currentSong = sessionData?.currentSong;
  const queueItems = sessionData?.queue || [];
  
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('POPULAR');
  const [queueSize, setQueueSize] = useState(0);
  const [joinId, setJoinId] = useState('');

  const handleRemoveFromQueue = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!joinCode) return;
    await removeFromSessionQueue(joinCode, id);
    refreshSession();
  };

  const handleJoinById = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinId.length === 5) {
      window.location.href = `/join/${joinId}`;
    } else {
      showToast("Zadejte platný 5-místný kód!", "warning");
    }
  };

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

  const handleAddToQueue = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (joinCode) {
      await addToSessionQueue(joinCode, id);
      showToast("SKLADBA JE VE FRONTĚ ✅");
      refreshSession();
    } else {
      const q = JSON.parse(localStorage.getItem('karacho_queue') || '[]');
      q.push(id);
      localStorage.setItem('karacho_queue', JSON.stringify(q));
      setQueueSize(q.length);
      showToast("SKLADBA JE VE FRONTĚ ✅");
    }
  };

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
    padding: '14px 20px', borderRadius: '14px', 
    border: '1px solid rgba(255,255,255,0.15)', 
    background: '#1a1a1a', 
    color: '#fff', fontSize: '15px', fontWeight: 600,
    outline: 'none', cursor: 'pointer', transition: 'all 0.2s'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', paddingBottom: joinCode ? '110px' : '0' }}>
      
      {/* === HERO SEKCE === */}
      <section style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: 'clamp(3rem, 10vw, 6rem) 1rem clamp(2rem, 5vw, 4rem)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 60% 60% at 50% 40%, rgba(255,215,0,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="hero-logo-wrap" style={{ position: 'relative', zIndex: 1, marginBottom: 'clamp(2rem, 6vw, 4rem)' }}>
          <img src="/logo.png" alt="Karacho" className="hero-logo-img" />
        </div>

        {/* JOIN BY ID BOX / CREATE BOX */}
        {!joinCode && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
            <form onSubmit={handleJoinById} style={{ 
              position: 'relative', zIndex: 5, 
              display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.05)', 
              padding: '10px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)', boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
            }}>
              <input 
                type="text" placeholder="Zadej kód (5 čísel)" maxLength={5}
                value={joinId} onChange={e => setJoinId(e.target.value)}
                style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', background: 'rgba(0,0,0,0.3)', color: 'var(--color-gold)', width: '150px', fontSize: '16px', fontWeight: 900, textAlign: 'center', letterSpacing: '0.1em', outline: 'none' }}
              />
              <button type="submit" style={{ padding: '12px 24px', borderRadius: '12px', background: 'var(--color-gold)', color: '#000', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '14px' }}>PŘIPOJIT SE</button>
            </form>

            <span style={{ fontSize: '12px', opacity: 0.4, fontWeight: 700 }}>NEBO</span>

            <button 
              onClick={() => createOrJoin()}
              style={{
                 background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                 color: '#fff', padding: '10px 20px', borderRadius: '14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                 transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              🚀 ZALOŽIT NOVOU VLASTNÍ SHOW
            </button>
          </div>
        )}

        <div className="hero-controls" style={{ 
          display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center',
          width: '100%', maxWidth: '1000px', position: 'relative', zIndex: 1,
        }}>
          <input 
            type="text" placeholder="🔍  Hledat interpreta nebo název..." 
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ 
              padding: '14px 20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.15)', 
              background: 'rgba(255,255,255,0.07)', color: '#fff', flex: 2, minWidth: '280px',
              fontSize: '16px', backdropFilter: 'blur(12px)', outline: 'none', transition: 'all 0.2s'
            }} 
          />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
            <option value="POPULAR">🏆 TOP HRANÉ</option>
            <option value="TITLE_ASC">🎵 PÍSEŇ (A-Z)</option>
            <option value="ARTIST_ASC">🎤 INTERPRET (A-Z)</option>
            <option value="NEWEST">🆕 NEJNOVĚJŠÍ</option>
          </select>
        </div>
      </section>

      {/* === KATALOG === */}
      <section style={{ 
        flex: 1, padding: '0 clamp(1.5rem, 5vw, 4rem) clamp(3rem, 7vw, 5rem)',
        maxWidth: '1500px', width: '100%', margin: '0 auto', boxSizing: 'border-box'
      }}>
        {!hasSongs ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
            <span style={{ fontSize: '20px' }}>🔍 Nic jsme nenašli pro "{search}"</span>
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-request-song-modal', { detail: { title: search } }));
              }}
              style={{ padding: '16px 32px', borderRadius: '50px', background: 'var(--color-gold)', color: '#000', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '15px' }}
            >
              ŽÁDOST O ZAŘAZENÍ
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '2rem' }}>
            {sortedSongs.map((song) => (
              <div key={song.id} className="glass-panel" style={{ 
                padding: '2rem', borderRadius: '28px', position: 'relative',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                transition: 'all 0.3s ease'
              }}>
                <button 
                  onClick={(e) => handleAddToQueue(song.id, e)}
                  style={{ 
                    position: 'absolute', top: '15px', right: '15px', width: '36px', height: '36px', 
                    borderRadius: '50%', background: 'rgba(255,215,0,0.2)', border: '1px solid rgba(255,215,0,0.3)', 
                    color: 'var(--color-gold)', cursor: 'pointer', zIndex: 2, display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 900
                  }}
                  className="plus-btn"
                >+</button>

                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{song.title}</h3>
                    <p style={{ opacity: 0.6, fontSize: '15px', margin: 0, fontWeight: 600 }}>{song.artist || 'Neznámý interpret'}</p>
                </div>
                
                <a href={`/player/${song.id}`} style={{ textDecoration: 'none' }}>
                    <button className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: 900 }}>▶ PŘEHRÁT</button>
                </a>
              </div>
            ))}
          </div>
        )}
      </section>


      <style jsx>{`
        .glass-panel:hover { transform: translateY(-8px); border-color: rgba(255,215,0,0.3) !important; background: rgba(255,255,255,0.06) !important; }
        .plus-btn:hover { background: rgba(255,215,0,0.4) !important; transform: scale(1.15); }
        .hero-logo-img { height: 320px; filter: drop-shadow(0 0 80px rgba(255,215,0,0.35)) drop-shadow(0 0 30px rgba(0,0,0,1)); transition: all 0.3s; }
        @media (max-width: 600px) {
          .hero-logo-img { height: 180px; }
          .hero-logo-wrap { margin-bottom: 2rem !important; }
        }
        @keyframes slideUp { from { transform: translate(-50%, 30px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}
