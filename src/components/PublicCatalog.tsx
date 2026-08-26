'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/context/SessionContext';
import { prepniOblibenou, getOblibeneIds } from '@/app/actions/user-actions';
import { obsahuje } from '@/lib/hledani';
import HlaseniChyby from '@/components/HlaseniChyby';
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
  timingData?: any | null;
  jsonUrl?: string | null;
}

// Pozor na název: tenhle prop NIKDY neznamenal „je admin", `page.tsx` do něj
// posílá `!!session?.user`, tedy „je přihlášený". Než se přejmenoval, vypadala
// oblíbená srdíčka jako funkce jen pro správce a málem se tak i opravila.
export default function PublicCatalog({ initialSongs, prihlasen }: { initialSongs: Song[]; prihlasen: boolean }) {
  const { joinCode, sessionData, localMode, refreshSession, createOrJoin } = useSession();
  const { showToast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const songIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    initialSongs.forEach((song, index) => {
      map.set(song.id, index);
    });
    return map;
  }, [initialSongs]);

  // Definice dat pro frontu
  const currentSong = sessionData?.currentSong;
  const queueItems = sessionData?.queue || [];
  
  /** Id oblíbených písní. Přepnutí se projeví hned, server se dotáhne pozadu. */
  const [oblibene, setOblibene] = useState<string[]>([]);
  /** Píseň, kterou zrovna někdo hlásí (null = dialog zavřený). */
  const [hlaseni, setHlaseni] = useState<{ id: string; nazev: string } | null>(null);

  useEffect(() => {
    if (!prihlasen) return;
    getOblibeneIds().then(setOblibene).catch(() => {});
  }, [prihlasen]);

  const prepniSrdce = (songId: string) => {
    if (!prihlasen) {
      showToast('Oblíbené se ukládají k účtu — přihlas se a zůstanou ti napořád. 🤍', 'info');
      return;
    }
    setOblibene(p => p.includes(songId) ? p.filter(x => x !== songId) : [...p, songId]);
    prepniOblibenou(songId).catch(() => {
      // Server odmítl — vrátíme zobrazení zpět, ať nelže.
      setOblibene(p => p.includes(songId) ? p.filter(x => x !== songId) : [...p, songId]);
    });
  };

  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('RANDOM');
  const [queueSize, setQueueSize] = useState(0);
  const [joinId, setJoinId] = useState('');
  const [displayCount, setDisplayCount] = useState(60);

  useEffect(() => {
    setDisplayCount(60);
  }, [search, genreFilter, tagFilter, sortBy]);

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
    const matchesSearch = obsahuje(song.title, search) ||
                         obsahuje(song.artist, search) ||
                         (song.tags || []).some(t => obsahuje(t, search));
    const matchesGenre = genreFilter === 'ALL' || song.genre === genreFilter;
    const matchesTag = tagFilter === 'ALL' || (song.tags && song.tags.includes(tagFilter));
    const hasRealChords = !!(song as any).chords && (song as any).chords.includes('[');
    const matchesLocalMode = localMode !== 'CHORDS' || hasRealChords;
    return matchesSearch && matchesGenre && matchesTag && matchesLocalMode;
  });

  const sortedSongs = [...filteredSongs].sort((a, b) => {
    const titleA = (a.title || '').trim();
    const titleB = (b.title || '').trim();

    if (sortBy === 'RANDOM') {
      const idxA = songIndexMap.get(a.id) ?? 0;
      const idxB = songIndexMap.get(b.id) ?? 0;
      return idxA - idxB;
    }
    if (sortBy === 'POPULAR') {
      const diff = (b.playCount || 0) - (a.playCount || 0);
      if (diff !== 0) return diff;
      return titleA.localeCompare(titleB, 'cs', { sensitivity: 'base' });
    }
    if (sortBy === 'TITLE_ASC') {
      return titleA.localeCompare(titleB, 'cs', { sensitivity: 'base' });
    }
    if (sortBy === 'ARTIST_ASC') {
      const artA = (a.artist || '').trim() || titleA;
      const artB = (b.artist || '').trim() || titleB;
      return artA.localeCompare(artB, 'cs', { sensitivity: 'base' });
    }
    if (sortBy === 'NEWEST') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  const visibleSongs = sortedSongs.slice(0, displayCount);
  const hasSongs = visibleSongs.length > 0;

  const handleAddToQueue = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    let currentCode = joinCode;
    
    // AUTO-CREATE SESSION: Pokud nejsme v relaci, založíme ji za letu
    if (!currentCode) {
      try {
        currentCode = await createOrJoin();
        // Malá prodleva aby se context stihl chytit není nutná díky local loadu v createOrJoin
      } catch (err) {
        showToast("Nepodařilo se založit show. Zkuste to prosím z menu.", "error");
        return;
      }
    }
    
    if (currentCode) {
      const res = await addToSessionQueue(currentCode, id);
      if (res && res.position > 0) {
        showToast(`SKLADBA JE VE FRONTĚ ✅ (Pořadí: ${res.position}. v pořadí)`, "success");
      } else {
        showToast("SKLADBA JE DALŠÍ NA ŘADĚ! 🎤", "success");
      }
      refreshSession();
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

      {hlaseni && (
        <HlaseniChyby
          songId={hlaseni.id}
          nazev={hlaseni.nazev}
          onClose={() => setHlaseni(null)}
          onHotovo={(z) => showToast(z, 'success')}
        />
      )}

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

        <div className="hero-logo-wrap" style={{ position: 'relative', zIndex: 1, marginBottom: 'clamp(2.5rem, 8vw, 6rem)' }}>
          <img src="/logo.png" alt="Karacho" className="hero-logo-img" />
        </div>

        <div className="hero-controls" style={{ 
          display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center',
          width: '100%', maxWidth: '1100px', position: 'relative', zIndex: 10,
          background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '24px',
          backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
        }}>
          <input 
            type="text" placeholder="🔍  Hledat písně, autory nebo štítky..." 
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ 
              padding: '14px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', 
              background: 'rgba(255,255,255,0.04)', color: '#fff', flex: '2 1 300px',
              fontSize: '16px', outline: 'none', transition: 'all 0.2s',
            }} 
          />
          <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)} style={{ ...selectStyle, flex: '1 1 150px' }}>
            <option value="ALL">🎭 VŠECHNY ŽÁNRY</option>
            {allGenres.map(g => (
              <option key={g} value={g as string}>{String(g).toUpperCase()}</option>
            ))}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...selectStyle, flex: '1 1 150px' }}>
            <option value="RANDOM">🎲 NÁHODNĚ</option>
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
            {visibleSongs.map((song) => (
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

                {/* Srdíčko vidí každý. Nepřihlášenému se místo tichého
                    nefungování řekne, proč to nejde — ukládá se k účtu. */}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); prepniSrdce(song.id); }}
                  title={!prihlasen
                    ? 'Přihlas se, ať si můžeš písničky ukládat'
                    : (oblibene.includes(song.id) ? 'Odebrat z oblíbených' : 'Přidat do oblíbených')}
                  style={{
                    position: 'absolute', top: '14px', right: '58px', background: 'none', border: 'none',
                    fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '4px', zIndex: 2,
                    filter: oblibene.includes(song.id) ? 'none' : 'grayscale(1)',
                    opacity: oblibene.includes(song.id) ? 1 : 0.45,
                  }}
                >
                  {oblibene.includes(song.id) ? '❤️' : '🤍'}
                </button>

                {/* Nahlásit smí i nepřihlášený host — server hlášení jen
                    zapíše a píseň z katalogu nestáhne, to udělá až správce. */}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHlaseni({ id: song.id, nazev: `${song.artist || 'Neznámý interpret'} – ${song.title}` }); }}
                  title="Nahlásit špatný text nebo špatnou píseň"
                  style={{
                    position: 'absolute', bottom: '14px', right: '15px', background: 'none', border: 'none',
                    fontSize: '15px', cursor: 'pointer', lineHeight: 1, padding: '6px', zIndex: 2,
                    opacity: 0.3, transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.3'; }}
                >
                  ⚠️
                </button>

                <div style={{ marginBottom: '2rem', paddingRight: '40px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{song.title}</h3>
                    <p style={{ opacity: 0.6, fontSize: '15px', margin: 0, fontWeight: 600 }}>{song.artist || 'Neznámý interpret'}</p>
                </div>
                
                <Link 
                  href={`/player/${song.id}`} 
                  className="btn-primary" 
                  style={{ 
                    display: 'block', textDecoration: 'none', textAlign: 'center',
                    width: '100%', padding: '12px', fontSize: '16px', fontWeight: 900,
                    boxSizing: 'border-box'
                  }}
                >
                  ▶ PŘEHRÁT
                </Link>
              </div>
            ))}
          </div>
        )}

        {hasSongs && displayCount < sortedSongs.length && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <button 
              className="btn-secondary" 
              onClick={() => setDisplayCount(prev => prev + 60)} 
              style={{ padding: '15px 40px', borderRadius: '50px', fontSize: '14px', fontWeight: 800, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}
            >
              🔽 NAČÍST DALŠÍCH ({sortedSongs.length - displayCount})
            </button>
          </div>
        )}
      </section>      {/* === FLOATING QUEUE BAR (DÁLKOVÉ OVLÁDÁNÍ) === */}
      {(mounted && joinCode) && (
        <div className="floating-queue-bar" style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          width: 'min(92vw, 550px)', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(25px)',
          borderRadius: '24px', padding: '12px 16px', zIndex: 1000,
          border: '1px solid rgba(255,215,0,0.2)', boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Aktuální info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', flex: 1 }}>
            <span style={{ fontSize: '10px', color: 'var(--color-gold)', fontWeight: 800, textTransform: 'uppercase', opacity: 0.8 }}>PRÁVĚ HRAJE 🔥</span>
            <span style={{ fontSize: '14px', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentSong?.title || "Čekání na zpěváka..."}
            </span>
          </div>

          {/* Ovládání */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px' }}>
            <button 
              onClick={() => {
                const url = `${window.location.origin}/join/${joinCode}`;
                navigator.clipboard.writeText(url);
                showToast("Link zkopírován! 🔗", "success");
              }}
              style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="Sdílet link s kamarády"
            >
              🔗
            </button>
            <a 
              href={`/player/${currentSong?.id}?mode=watch&code=${joinCode}`}
              style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
              title="Sledovat bez zvuku (Mirror)"
            >
              📺
            </a>
            <button 
              onClick={() => remoteControl('NEXT')}
              style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              ⏭️
            </button>
            <button 
              onClick={() => remoteControl(sessionData?.status === 'PLAYING' ? 'PAUSE' : 'PLAY')}
              style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--color-gold)', border: 'none', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 900, boxShadow: '0 0 20px rgba(255,215,0,0.3)' }}
            >
              {sessionData?.status === 'PLAYING' ? '⏸' : '▶'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .glass-panel:hover { transform: translateY(-8px); border-color: rgba(255,215,0,0.3) !important; background: rgba(255,255,255,0.06) !important; }
        .plus-btn:hover { background: rgba(255,215,0,0.4) !important; transform: scale(1.15); }
        .hero-logo-img { height: 320px; filter: drop-shadow(0 0 80px rgba(255,215,0,0.35)) drop-shadow(0 0 30px rgba(0,0,0,1)); transition: all 0.3s; }
        @media (max-width: 600px) {
          .hero-logo-img { height: 180px; }
          .hero-logo-wrap { margin-bottom: 2rem !important; }
        }
        @media (min-width: 851px) {
          .floating-queue-bar { display: none !important; }
        }
        @keyframes slideUp { from { transform: translate(-50%, 30px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}
