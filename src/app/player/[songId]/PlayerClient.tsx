'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { incrementPlayCount } from '@/app/admin/actions';
import { useSession } from '@/context/SessionContext';
import { getSessionStatus, updateSessionState, advanceSessionQueue } from '@/app/actions/session-actions';

interface PlayerBlock {
  lw: string[];
  bs: number;
  be: number;
  w: { t: number; i: number }[];
}

interface TimingData {
  blocks: PlayerBlock[];
  dur: number;
}

export default function PlayerClient({ song }: { song: any }) {
  const { joinCode } = useSession();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInstrumental, setIsInstrumental] = useState(!!song.instrumentalUrl);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [renderTick, setRenderTick] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  const prevLineEl = useRef<HTMLDivElement>(null);
  const curLineEl = useRef<HTMLDivElement>(null);
  const nextLineEl = useRef<HTMLDivElement>(null);
  const pbarEl = useRef<HTMLDivElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const countEl = useRef<HTMLDivElement>(null);
  const countBarEl = useRef<HTMLDivElement>(null);

  const lastBlock = useRef<number>(-1);
  const lastColored = useRef<number>(-1);

  const data: TimingData = (song.timingData as any) || { blocks: [], dur: 0 };
  const blocks = data.blocks || [];
  const dur = data.dur || 0;

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {}
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {});
    }
  };

  useEffect(() => {
    // 📺 LOGIKA POUZE PRO REFRESH PŘI ZMĚNĚ SONGU (Dálkové přepnutí)
    if (!joinCode) return;
    const interval = setInterval(async () => {
      const s = await getSessionStatus(joinCode);
      if (s && s.currentSongId && s.currentSongId !== song.id) {
         window.location.href = `/player/${s.currentSongId}`;
      }
    }, 4000); // Pro přepnutí songu stačí delší interval
    return () => clearInterval(interval);
  }, [joinCode, song.id]);

  useEffect(() => {
    const isWatchMode = window.location.search.includes('mode=watch');

    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.muted = isWatchMode; // Tichý režim pro hosty
    const initialSrc = (!!song.instrumentalUrl) ? song.instrumentalUrl : song.audioUrl;
    a.src = initialSrc;
    a.preload = "auto";
    a.onplay = () => { 
      setIsPlaying(true); 
      requestWakeLock(); 
      if (joinCode && !isWatchMode) updateSessionState(joinCode, { status: 'PLAYING', currentSongId: song.id });
    };
    a.onpause = () => { 
      setIsPlaying(false); 
      releaseWakeLock(); 
      if (joinCode && !isWatchMode) updateSessionState(joinCode, { status: 'PAUSED' });
    };
    a.onplaying = () => {
      incrementPlayCount(song.id);
      startTick();
      if (!isWatchMode) toggleFullScreen();
    };
    a.onended = async () => { 
      setIsPlaying(false); 
      lastBlock.current = -1; 
      releaseWakeLock(); 
      
      if (isWatchMode) return; // Slave neposouvá frontu

      if (joinCode) {
        const next = await advanceSessionQueue(joinCode);
        if (next && next.currentSongId) {
          window.location.href = `/player/${next.currentSongId}`;
          return;
        }
      }
      window.location.href = '/'; 
    };
    audioRef.current = a;

    // 📱 SYNCHRONIZACE (Master hlásí stav, Slave a Remote následují)
    const syncInterval = setInterval(async () => {
       if (!joinCode || !audioRef.current) return;
       
       if (!isWatchMode) {
          // 📺 JSEM MASTER (TELEVIZE) -> Hlášení času a kontrola dálkového ovládání
          const s = await getSessionStatus(joinCode);
          if (s) {
            // Kontrola, zda nás někdo dálkově nepozastavil/nepustil
            if (s.status === 'PAUSED' && !audioRef.current.paused) {
               audioRef.current.pause();
            } else if (s.status === 'PLAYING' && audioRef.current.paused && userInteracted) {
               audioRef.current.play().catch(() => {});
            }
            // Hlášení aktuálního času do DB pro ostatní
            if (!audioRef.current.paused) {
               updateSessionState(joinCode, { currentTime: audioRef.current.currentTime, status: 'PLAYING' });
            }
          }
       } else {
          // 📱 JSEM SLAVE (MOBIL / WATCH MODE) -> Dorovnání stavu podle TV
          const s = await getSessionStatus(joinCode);
          if (s) {
             // Synchronizace času (pokud jsme mimo o víc než 1.5s)
             const diff = Math.abs(audioRef.current.currentTime - (s.currentTime || 0));
             if (diff > 1.5) {
                audioRef.current.currentTime = s.currentTime || 0;
                if (videoElRef.current) videoElRef.current.currentTime = s.currentTime || 0;
             }
             // Synchronizace stavu (Play/Pause)
             if (s.status === 'PLAYING' && audioRef.current.paused) {
                audioRef.current.play().catch(() => {});
             } else if (s.status === 'PAUSED' && !audioRef.current.paused) {
                audioRef.current.pause();
             }
          }
       }
    }, isWatchMode ? 1500 : 2000); // Slave se doptává častěji

    const playAttempt = a.play();
    if (playAttempt !== undefined) {
      playAttempt.catch(e => console.log("Autoplay blocked"));
    }

    return () => {
      clearInterval(syncInterval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) audioRef.current.pause();
      releaseWakeLock();
    };
  }, [song.audioUrl, song.instrumentalUrl, joinCode]);

  const toggleTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || !song.instrumentalUrl) return;
    const t = audioRef.current.currentTime;
    const paused = audioRef.current.paused;
    const nextMode = !isInstrumental;
    audioRef.current.src = nextMode ? song.instrumentalUrl : song.audioUrl;
    audioRef.current.currentTime = t;
    if (videoElRef.current) videoElRef.current.currentTime = t;
    if (!paused) {
      audioRef.current.play();
      if (videoElRef.current) videoElRef.current.play();
      startTick();
    }
    setIsInstrumental(nextMode);
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioRef.current) return;
    
    // Zapneme full screen při prvním kliku (nebo kdykoliv spustíme play)
    toggleFullScreen();

    if (audioRef.current.paused) {
      audioRef.current.play();
      if (videoElRef.current) videoElRef.current.play();
      startTick();
    } else {
      audioRef.current.pause();
      if (videoElRef.current) videoElRef.current.pause();
    }
  };

  const startTick = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  const getState = (t: number) => {
    const ci = blocks.findIndex(b => t >= b.bs && t < b.be);
    if (ci < 0) return null;
    const cb = blocks[ci];
    let nc = 0;
    for (const w of cb.w) {
      if (t >= w.t) nc = w.i + 1;
    }
    return {
      cb, nc, ci,
      prev: ci > 0 ? blocks[ci - 1] : null,
      next: ci < blocks.length - 1 ? blocks[ci + 1] : null
    };
  };

  const tick = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    const d = audioRef.current.duration || dur || 1;
    // visualTime - synchronizace s obrazovkou (předstih 0.5s pro plynulé karaoke)
    const visualTime = t + 0.5;

    if (pbarEl.current) pbarEl.current.style.width = `${(t / d) * 100}%`;
    if (videoElRef.current) {
        const diffInput = Math.abs(videoElRef.current.currentTime - t);
        if (diffInput > 0.5) videoElRef.current.currentTime = t;
    }
    if (timeEl.current) {
        const fmt = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
        timeEl.current.textContent = `${fmt(t)} / ${fmt(d)}`;
    }

    const state = getState(visualTime);
    renderState(state, visualTime);

    if (countEl.current && countBarEl.current) {
        // Hledáme čas nejbližšího slova, které má přijít
        let nextWordTime = -1;
        for (const b of blocks) {
            for (const w of b.w) {
                if (w.t > t) {
                    nextWordTime = w.t;
                    break;
                }
            }
            if (nextWordTime !== -1) break;
        }

        const diff = nextWordTime !== -1 ? (nextWordTime - t) : -1;
        const visualDiff = nextWordTime !== -1 ? (nextWordTime - visualTime) : -1;
        
        // Zobrazíme pokud do zpěvu zbývá 0.0 - 6 sekund reálného času
        // ALE zmizíme jakmile visualTime (ten s předstihem) dosáhne slova (visualDiff <= 0)
        if (diff > 0 && visualDiff > 0 && diff < 6.0) {
            const prevBlock = blocks.slice(0).reverse().find(b => b.be <= t);
            const isVeryFirstWord = !prevBlock; // Odpočet chceme JEN na úplném začátku

            if (isVeryFirstWord) {
                countEl.current.style.display = 'flex';
                countEl.current.style.opacity = '1';
                const valEl = countEl.current.querySelector('.cnt-v');
                if (valEl) {
                  const rounded = Math.ceil(diff);
                  valEl.textContent = rounded > 0 ? `${rounded}` : '';
                }
                const progress = (Math.max(0, diff - 0.1) / 5) * 100;
                countBarEl.current.style.width = `${Math.min(100, progress)}%`;
            } else {
                countEl.current.style.display = 'none';
            }
        } else {
            countEl.current.style.display = 'none';
        }
    }

    if (!audioRef.current.paused) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const renderState = (state: any, t: number) => {
    const prev = prevLineEl.current;
    const cur = curLineEl.current;
    const nextText = nextLineEl.current;
    if (!state) {
      if (cur) cur.innerHTML = '';
      if (nextText) nextText.textContent = '';
      lastBlock.current = -1;
      return;
    }
    const { cb, ci, next: nb } = state;
    if (nextText) nextText.textContent = nb ? nb.lw.join(' ') : '';
    if (ci !== lastBlock.current) {
      if (cur) {
        cur.innerHTML = cb.lw.map((w: string, i: number) => `<span class="w-wrap"><span class="w-off">${w}</span><span class="w-on">${w}</span></span>`).join(' ');
        cur.classList.remove('block-new');
        void cur.offsetWidth; 
        cur.classList.add('block-new');
      }
      lastBlock.current = ci;
    }
    if (cur) {
      const wraps = cur.querySelectorAll('.w-wrap');
      wraps.forEach((wrap: any, i: number) => {
        const on = wrap.querySelector('.w-on');
        if (!on) return;
        const wordStart = cb.w[i].t;
        const wordEnd = (i < cb.w.length - 1) ? cb.w[i+1].t : cb.be;
        let p = 0;
        if (t >= wordStart && t < wordEnd) p = (t - wordStart) / (wordEnd - wordStart);
        else if (t >= wordEnd) p = 1;
        on.style.width = `${p * 100}%`;
      });
    }
  };

  const handleSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || !audioRef.current.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * audioRef.current.duration;
    audioRef.current.currentTime = t;
    if (videoElRef.current) videoElRef.current.currentTime = t;
    const state = getState(t);
    renderState(state, t);
  };

  const [userInteracted, setUserInteracted] = useState(false);

  const hasVideo = !!song.videoUrl;

  const handleStartMaster = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUserInteracted(true);
    togglePlay(); // Spustí play i fullscreen
  };

  return (
    <div className="player-root" style={{ 
      position: 'fixed', inset: 0, background: '#000', color: '#fff', 
      fontFamily: 'Inter, sans-serif', overflow: 'hidden' 
    }}>
      
      {/* 🛑 MASTER START OVERLAY (Pro Fullscreen & Autoplay) */}
      {!isPlaying && !userInteracted && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, 
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem'
        }}>
           <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '50px', cursor: 'pointer', boxShadow: '0 0 50px rgba(255,215,0,0.4)', animation: 'pulseDJ 2s infinite' }} onClick={handleStartMaster}>
             ▶️
           </div>
           <style jsx>{`
             @keyframes pulseDJ { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
           `}</style>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        .player-root { --glow: rgba(255, 215, 0, 0.55); }
        .w-wrap { position: relative; display: inline-block; padding: 0; margin: 0 0.1em; }
        .w-off { color: rgba(255,255,255,1); text-shadow: 1px 1px 3px rgba(0,0,0,0.9); }
        .w-on { position: absolute; left: 0; top: 0; width: 0%; overflow: hidden; white-space: nowrap; color: #ffd700; text-shadow: 1px 1px 3px rgba(0,0,0,0.9); }
        .ln-ctx { font-size: clamp(14px, 3.5vw, 28px); color: rgba(255,255,255,0.4); font-weight: 700; text-align: center; min-height: 1.4em; }
        #cur-line { font-size: clamp(28px, 6.5vw, 82px); font-weight: 900; text-align: center; min-height: 1.2em; line-height: 1.2; letter-spacing: -0.01em; }
        @keyframes blockIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .block-new { animation: blockIn 0.3s ease-out forwards; }
        @media (orientation: portrait) {
          #cur-line { font-size: clamp(22px, 8vw, 42px); padding: 0 1rem; }
          .ln-ctx { font-size: clamp(12px, 4vw, 18px); }
          #stage { padding: 0 5vw !important; gap: 2vh !important; }
          #controls { 
            flex-direction: column !important; 
            align-items: stretch !important; 
            padding: 1.5rem !important; 
            gap: 1.2rem !important;
          }
          .btn-group { display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 12px; }
          .meta-info { display: flex; justify-content: space-between; align-items: flex-end; width: 100%; font-size: 11px !important; }
        }
      `}} />

      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {hasVideo ? (
          <video ref={videoElRef} src={song.videoUrl || ''} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <img 
            src={song.backgroundUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop'}
            onLoad={() => setImgLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.35) saturate(1.2)', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.8s ease-in-out' }} 
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)' }} />
      </div>

      {!hasVideo && (
        <div id="stage" style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 10vw', gap: '3vh', pointerEvents: 'none' }}>
            <div ref={countEl} style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: '20px', position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
              <div className="cnt-v" style={{ color: 'var(--color-gold)', fontSize: '130px', lineHeight: 1, fontWeight: 900, textShadow: '0 0 50px rgba(255,215,0,1)', filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.8))', marginBottom: '-10px' }} />
              <div style={{ width: '400px', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden', boxShadow: '0 0 25px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                 <div ref={countBarEl} style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #FFD700, #FFA500, #FFD700)', boxShadow: '0 0 15px var(--color-gold)', transition: 'width 0.1s linear' }} />
              </div>
            </div>
           <div ref={curLineEl} id="cur-line" />
           <div ref={nextLineEl} className="ln-ctx" />
        </div>
      )}

      <div id="ui-layer" style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
         <div id="controls" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', pointerEvents: 'auto', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
            
            {/* META INFO (Řádek 1 na mobilu) */}
            <div className="meta-info" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                   <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{song.artist} – {song.title}</span>
                   <span ref={timeEl}>0:00 / 0:00</span>
                </div>
                
                {/* PROGRESS BAR (Řádek 2 na mobilu) */}
                <div onClick={handleSeek} style={{ height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', cursor: 'pointer', position: 'relative' }}>
                   <div ref={pbarEl} style={{ height: '100%', background: 'var(--color-gold)', width: '0%', borderRadius: '4px', boxShadow: '0 0 12px var(--glow)' }} />
                </div>
            </div>

            {/* BUTTONS (Řádek 3 na mobilu) */}
            <div className="btn-group" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <button onClick={togglePlay} style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--color-gold)', border: 'none', color: '#000', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 {isPlaying ? '⏸' : '▶'}
              </button>
              {song.instrumentalUrl && (
                <button onClick={toggleTrack} style={{ padding: '12px 16px', borderRadius: '12px', background: isInstrumental ? 'rgba(0,177,64,0.2)' : 'rgba(255,255,255,0.05)', border: isInstrumental ? '1px solid #00B140' : '1px solid rgba(255,255,255,0.1)', color: isInstrumental ? '#00B140' : 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  {isInstrumental ? <span>🎻 KARAOKE</span> : <span>👤 ORIGINÁL</span>}
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); toggleFullScreen(); }} style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }} title="Full Screen">
                ⛶
              </button>
              <Link href="/" style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }} onClick={e=>e.stopPropagation()}>Zavřít</Link>
            </div>

         </div>
      </div>
    </div>
  );
}
