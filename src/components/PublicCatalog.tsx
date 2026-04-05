'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { updateSessionState, advanceSessionQueue, addToSessionQueue, removeFromSessionQueue } from '@/app/actions/session-actions';

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
  const router = useRouter();

  // Definice dat pro frontu a rohové ovládání
  const currentSong = sessionData?.currentSong;
  const queueItems = sessionData?.queue || [];
  
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('POPULAR');
  const [showToast, setShowToast] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [joinId, setJoinId] = useState('');
  const [showQueueMgr, setShowQueueMgr] = useState(false);

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
      alert("Zadejte platný 5-místný kód!");
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
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      refreshSession();
    } else {
      const q = JSON.parse(localStorage.getItem('karacho_queue') || '[]');
      q.push(id);
      localStorage.setItem('karacho_queue', JSON.stringify(q));
      setQueueSize(q.length);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
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

        {/* JOIN BY ID BOX */}
        {!joinCode && (
          <form onSubmit={handleJoinById} style={{ 
            position: 'relative', zIndex: 5, marginBottom: '2.5rem', 
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
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '5rem 1rem', fontSize: '18px' }}>
            Nic nenalezeno. Zkuste hledat jinak.
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

      {/* 🚀 INDIKÁTOR V PRAVÉM HORNÍM ROHU - Pouze pokud se něco děje */}
      {joinCode && sessionData && (currentSong || queueItems.length > 0) && (
        <div 
          onClick={() => setShowQueueMgr(true)}
          style={{
            position: 'fixed', top: '130px', right: 'clamp(1rem, 4vw, 3rem)',
            width: '320px', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(30px)',
            padding: '16px 20px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 5000, cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', flexDirection: 'column', gap: '10px'
          }}
          className="corner-panel-float"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
               <span style={{ fontSize: '10px', opacity: 0.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Právě hraje 🔥</span>
               <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                 {currentSong?.title || 'Ticho v baru'}
               </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
               <button onClick={(e) => { e.stopPropagation(); remoteControl(sessionData.status === 'PLAYING' ? 'PAUSE' : 'PLAY'); }} style={{ width: '40px', height: '40px', borderRadius: '50%', background: sessionData.status === 'PLAYING' ? '#fff' : 'var(--color-gold)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                  {sessionData.status === 'PLAYING' ? '⏸️' : '▶️'}
               </button>
            </div>
          </div>
          
          {queueItems.length > 0 && (
             <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                <span style={{ fontSize: '9px', opacity: 0.4, textTransform: 'uppercase', fontWeight: 800 }}>Následuje...</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                   <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                      {queueItems[0].song?.title}
                   </span>
                   <button onClick={(e) => { e.stopPropagation(); remoteControl('NEXT'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '18px' }}>⏭️</button>
                </div>
             </div>
          )}
        </div>
      )}

      {/* 🎭 KOMPLEXNÍ SPRÁCE FRONTY (Queue Manager Modal) */}
      {showQueueMgr && joinCode && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100000, 
          background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(15px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setShowQueueMgr(false)}>
          
          <div style={{
            width: '100%', maxWidth: '600px', maxHeight: '85vh', background: '#111', 
            borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', animation: 'slideUpModal 0.4s ease-out'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>Správa fronty</h2>
              <button 
                onClick={() => setShowQueueMgr(false)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '10px 18px', borderRadius: '14px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Zavřít</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2.5rem 3rem' }}>
               <div style={{ marginBottom: '2.5rem' }}>
                  <span style={{ fontSize: '11px', opacity: 0.5, fontWeight: 900, textTransform: 'uppercase' }}>Právě hosté slyší:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', background: 'rgba(255,215,0,0.05)', padding: '1.5rem', borderRadius: '24px', border: '1px solid rgba(255,215,0,0.1)' }}>
                     <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🎤</div>
                     <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 900, fontSize: '18px', color: 'var(--color-gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSong?.title || 'Ticho'}</div>
                        <div style={{ fontSize: '14px', opacity: 0.6 }}>{currentSong?.artist || 'Neznámý interpret'}</div>
                     </div>
                  </div>
               </div>

               <div>
                  <span style={{ fontSize: '11px', opacity: 0.5, fontWeight: 900, textTransform: 'uppercase' }}>Seznam skladeb v pořadí:</span>
                  <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                     {queueItems.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.4 }}>Fronta je prázdná, doplňte další hity!</div>
                     ) : (
                        queueItems.map((item: any, idx: number) => (
                           <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem 1.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>{idx + 1}</div>
                              <div style={{ flex: 1, overflow: 'hidden' }}>
                                 <div style={{ fontWeight: 800, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.song?.title}</div>
                                 <div style={{ fontSize: '13px', opacity: 0.5 }}>{item.song?.artist}</div>
                              </div>
                              <button 
                                onClick={(e) => handleRemoveFromQueue(item.id, e)}
                                style={{ background: 'none', border: 'none', color: '#ff4b2b', fontSize: '18px', cursor: 'pointer', padding: '10px' }}>✕</button>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {showToast && (
        <div style={{
          position: 'fixed', bottom: '3rem', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,180,216,1)', color: 'white', padding: '12px 28px', borderRadius: '24px',
          zIndex: 6000, fontWeight: 900, animation: 'slideUp 0.3s', boxShadow: '0 0 20px rgba(0,180,216,0.3)'
        }}>
          ✅ SKLADBA JE VE FRONTĚ
        </div>
      )}

      <style jsx>{`
        .corner-panel-float:hover { transform: scale(1.02); border-color: rgba(255,215,0,0.3) !important; background: rgba(0,0,0,0.95) !important; }
        .glass-panel:hover { transform: translateY(-8px); border-color: rgba(255,215,0,0.3) !important; background: rgba(255,255,255,0.06) !important; }
        .plus-btn:hover { background: rgba(255,215,0,0.4) !important; transform: scale(1.15); }
        .hero-logo-img { height: 320px; filter: drop-shadow(0 0 80px rgba(255,215,0,0.35)) drop-shadow(0 0 30px rgba(0,0,0,1)); }
        @keyframes slideUp { from { transform: translate(-50%, 30px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes slideUpModal { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
