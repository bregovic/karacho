'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { incrementPlayCount } from '@/app/admin/actions';
import { useSession } from '@/context/SessionContext';
import { getSessionStatus, updateSessionState, advanceSessionQueue } from '@/app/actions/session-actions';
import { recordSinging } from '@/app/actions/user-actions';

interface PlayerBlock {
  lw: string[];
  bs: number;
  be: number;
  v?: number; // Hlas 1 nebo 2
  w: { t: number; i: number; v?: number }[];
}

interface TimingData {
  blocks: PlayerBlock[];
  dur: number;
}

function ChordsView({ chords, songTitle, artist }: { chords: string, songTitle: string, artist: string }) {
  const [scrollSpeed, setScrollSpeed] = useState(0); 
  
  useEffect(() => {
    if (scrollSpeed === 0) return;
    const scrollInterval = setInterval(() => {
      window.scrollBy({ top: scrollSpeed, behavior: 'auto' });
    }, 50);
    return () => clearInterval(scrollInterval);
  }, [scrollSpeed]);

  const toggleScroll = () => {
    setScrollSpeed(prev => (prev === 0 ? 1 : (prev === 1 ? 2 : (prev === 2 ? 3 : 0))));
  };
  const lines = chords.split('\n');
  
  const renderLine = (line: string) => {
    const words = line.trim().split(/\s+/);
    const looksLikeChords = words.length > 0 && words.every(w => 
      /^[A-G](maj|min|dim|aug|sus|mi|m|#|b|7|9|11|13)*(\/[A-G][#b]*)?$/i.test(w) || /^[\/|,\(\)\+\-]+$/.test(w)
    );

    if (looksLikeChords && !line.includes('[')) {
      return (
        <div style={{ color: '#ffcc00', fontWeight: 900, marginBottom: '-0.3em', fontSize: '1.3em', textAlign: 'center' }}>
          {line}
        </div>
      );
    }

    const parts = line.split(/(\[[^\]]+\])/);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', minHeight: '1.8em', justifyContent: 'center', textAlign: 'center' }}>
        {parts.map((part, i) => {
          if (part.startsWith('[') && part.endsWith(']')) {
            const chordName = part.slice(1, -1);
            return (
              <span key={i} style={{ width: 0, overflow: 'visible', pointerEvents: 'none', position: 'relative' }}>
                <span style={{ 
                  color: '#ffcc00', fontWeight: 900, fontSize: '0.8em', 
                  position: 'absolute', bottom: '1.8em', left: '50%', transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap', textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                }}>
                  {chordName}
                </span>
              </span>
            );
          }
          return (
            <span key={i} style={{ whiteSpace: 'pre' }}>
              {part}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ 
      padding: '5rem 5% 20rem', maxWidth: '100%', width: '100%', boxSizing: 'border-box',
      fontSize: 'clamp(18px, 4vw, 32px)', lineHeight: '2.8', color: '#eee',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word', position: 'relative', zIndex: 10,
      textAlign: 'center'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ color: '#fff', fontSize: 'clamp(32px, 6vw, 48px)', fontWeight: 900, margin: '0 0 10px', textShadow: '0 0 20px rgba(255,215,0,0.2)' }}>{songTitle}</h1>
        <p style={{ opacity: 0.6, fontSize: '22px', margin: 0 }}>{artist}</p>
      </div>
      
      <div 
        onClick={() => { if(scrollSpeed === 0) toggleScroll(); else window.scrollBy({ top: 200, behavior: 'smooth' }); }}
        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1.2rem', alignItems: 'center' }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ width: '100%' }}>
            {renderLine(line)}
          </div>
        ))}
      </div>
      
      <div style={{ height: '40vh' }} />

      {/* PLOVOUCÍ OVLÁDÁNÍ - Přesunuto vlevo dolů aby nevadilo menu/zavírání */}
      <div className="mobile-only" style={{ position: 'fixed', bottom: '40px', left: '30px', zIndex: 1000, display: 'flex', gap: '10px' }}>
         <button 
           onClick={(e) => { e.stopPropagation(); toggleScroll(); }}
           style={{ 
             padding: '16px 24px', borderRadius: '50px', 
             background: scrollSpeed > 0 ? '#00ffa0' : 'rgba(255,255,255,0.08)', 
             color: scrollSpeed > 0 ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.1)', 
             fontWeight: 900, cursor: 'pointer', boxShadow: '0 15px 40px rgba(0,0,0,0.4)',
             backdropFilter: 'blur(15px)', transition: 'all 0.3s', fontSize: '13px', display: 'flex', gap: '10px', alignItems: 'center'
           }}
         >
           <span>{scrollSpeed > 0 ? '📜' : '🖱️'}</span>
           {scrollSpeed > 0 ? `AUTOSCROLL: ${scrollSpeed}` : 'AUTOSCROLL OFF'}
         </button>
      </div>
    </div>
  );
}

export default function PlayerClient({ song }: { song: any }) {
  const { joinCode, sessionData, localMode, isHost } = useSession();
  const isChordsMode = localMode === 'CHORDS' || sessionData?.sessionMode === 'CHORDS';
  const shouldSuppressAudio = (isChordsMode || isWatchMode) && !isHost;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInstrumental, setIsInstrumental] = useState(!!song.instrumentalUrl);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [renderTick, setRenderTick] = useState(0);

  const systemBackgrounds = useMemo(() => [
    '/backgrounds/disco.png', '/backgrounds/rock.png', '/backgrounds/retro_80s.png',
    '/backgrounds/jazz.png', '/backgrounds/pop.png', '/backgrounds/country.png',
    '/backgrounds/hiphop.png', '/backgrounds/jungle.png', '/backgrounds/rocknroll.png',
    '/backgrounds/opera.png', '/backgrounds/hightech.png', '/backgrounds/matrix.png',
    '/backgrounds/tekkno.png', '/backgrounds/funk.png'
  ], []);

  const randomBackground = useMemo(() => {
    return systemBackgrounds[Math.floor(Math.random() * systemBackgrounds.length)];
  }, [systemBackgrounds]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  const curLineEl1 = useRef<HTMLDivElement>(null);
  const nextLineEl1 = useRef<HTMLDivElement>(null);
  const curLineEl2 = useRef<HTMLDivElement>(null);
  const nextLineEl2 = useRef<HTMLDivElement>(null);
  const curLineElC = useRef<HTMLDivElement>(null);
  const nextLineElC = useRef<HTMLDivElement>(null);
  const pbarEl = useRef<HTMLDivElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const countEl = useRef<HTMLDivElement>(null);
  const countBarEl = useRef<HTMLDivElement>(null);

  const lastBlock1 = useRef<number>(-1);
  const lastBlock2 = useRef<number>(-1);
  const lastBlockC = useRef<number>(-1);

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
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {});
      }
    }
  };

  useEffect(() => {
    if (!joinCode) return;
    const interval = setInterval(async () => {
      const s = await getSessionStatus(joinCode);
      if (s && s.currentSongId && s.currentSongId !== song.id) {
         window.location.href = `/player/${s.currentSongId}`;
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [joinCode, song.id]);

  const isWatchMode = typeof window !== 'undefined' && window.location.search.includes('mode=watch');

  useEffect(() => {
    const a = new Audio();
    a.crossOrigin = "anonymous";
    
    // AGRESIVNÍ STOPKA PRO AKORDY A PASIVNÍ REŽIM (POUZE PRO NON-HOST)
    if (shouldSuppressAudio || isMuted) {
      a.muted = true;
      a.volume = 0;
    }

    const initialSrc = (!!song.instrumentalUrl) ? song.instrumentalUrl : song.audioUrl;
    a.src = initialSrc;
    a.preload = (isChordsMode || isWatchMode) ? "none" : "auto";
    
    a.onplay = () => { 
      if (isChordsMode && !isHost) {
        a.pause();
        return;
      }
      setIsPlaying(true); 
      requestWakeLock(); 
      if (joinCode && !isWatchMode) {
          updateSessionState(joinCode, { 
              status: 'PLAYING', 
              currentSongId: song.id,
              startedAt: new Date().toISOString(),
              startTimeOffset: a.currentTime
          });
      }
    };
    a.onpause = () => { 
      setIsPlaying(false); 
      releaseWakeLock(); 
      if (joinCode && !isWatchMode) {
          updateSessionState(joinCode, { status: 'PAUSED', currentTime: a.currentTime });
      }
    };
    a.onplaying = () => {
      incrementPlayCount(song.id);
      recordSinging(song.id);
      startTick();
      if (!isWatchMode) toggleFullScreen();
    };
    a.onended = async () => { 
      setIsPlaying(false); 
      lastBlock1.current = -1; 
      lastBlock2.current = -1;
      lastBlockC.current = -1;
      releaseWakeLock(); 
      if (isWatchMode) return;
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

    const syncInterval = setInterval(async () => {
       if (!joinCode || !audioRef.current) return;
       
       if (!isWatchMode) {
          // Master logic (Spreading updates)
          if (!audioRef.current.paused) {
             updateSessionState(joinCode, { currentTime: audioRef.current.currentTime, status: 'PLAYING' });
          }
       } else {
          // Slave logic (Following Master)
          const session = await getSessionStatus(joinCode);
          if (session) {
             const s = session as any;
             let serverTime = s.currentTime || 0;
             if (s.status === 'PLAYING' && s.startedAt) {
                const now = Date.now();
                const startedAt = new Date(s.startedAt).getTime();
                serverTime = (now - startedAt) / 1000 + (s.startTimeOffset || 0);
             }

             const diff = serverTime - audioRef.current.currentTime; // kladné = jsme pozadu, záporné = jsme napřed
             const absDiff = Math.abs(diff);

             // SMART SYNC LOGIC
             if (absDiff > 1.2) {
                // Velký skok - musíme seeknout
                audioRef.current.currentTime = serverTime;
                if (videoElRef.current) videoElRef.current.currentTime = serverTime;
                audioRef.current.playbackRate = 1.0;
             } else if (absDiff > 0.15) {
                // Malý drift - plynulé srovnání pomocí rychlosti přehrávání (není tolik slyšet jako skok)
                if (diff > 0) {
                   audioRef.current.playbackRate = 1.05; // Mírně zrychlíme
                } else {
                   audioRef.current.playbackRate = 0.95; // Mírně zpomalíme
                }
             } else {
                // Jsme v toleranci, hrajeme normálně
                audioRef.current.playbackRate = 1.0;
             }

             if (s.status === 'PLAYING' && audioRef.current.paused && !isChordsMode) {
                audioRef.current.play().catch(() => {});
             } else if (s.status === 'PAUSED' && !audioRef.current.paused) {
                audioRef.current.pause();
                audioRef.current.playbackRate = 1.0;
             }
          }
       }
    }, isWatchMode ? 250 : 1000); // watch režim "tepe" 4x za sekundu pro lepší plynulost

    if (!isChordsMode || isHost) {
      const playAttempt = a.play();
      if (playAttempt !== undefined) {
        playAttempt.catch(err => {
          console.log("Autoplay blocked by browser");
        });
      }
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

  const [isMuted, setIsMuted] = useState(shouldSuppressAudio);
  
  // Načtení/Uložení mute preferencí
  useEffect(() => {
    const savedMute = localStorage.getItem('karacho_mute');
    if (savedMute !== null) {
      setIsMuted(savedMute === 'true' || isWatchMode);
    }
  }, [isWatchMode]);

  useEffect(() => {
    localStorage.setItem('karacho_mute', isMuted.toString());
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      audioRef.current.volume = isMuted ? 0 : 1;
    }
  }, [isMuted]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isChordsMode && !isHost) return; // V režimu akordů nehraje hudba (pokud nejsme host)
    if (!audioRef.current) return;
    toggleFullScreen();
    
    // Lokální akce
    const isCurrentlyPaused = audioRef.current.paused;
    const newStatus = isCurrentlyPaused ? 'PLAYING' : 'PAUSED';

    if (isCurrentlyPaused) {
      audioRef.current.play();
      if (videoElRef.current) videoElRef.current.play();
      startTick();
    } else {
      audioRef.current.pause();
      if (videoElRef.current) videoElRef.current.pause();
    }

    // Synchronizace do relace
    if (joinCode) {
      updateSessionState(joinCode, { 
        status: newStatus, 
        currentTime: audioRef.current.currentTime 
      });
    }
  };

  const handleNext = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioRef.current) audioRef.current.pause();

    if (joinCode) {
      const next = await advanceSessionQueue(joinCode);
      if (next && next.currentSongId) {
        window.location.href = `/player/${next.currentSongId}`;
        return;
      }
    }
    window.location.href = '/';
  };

  const startTick = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  const isBlockInVoice = (b: PlayerBlock, containerVoice: number) => {
     let has1 = false; let has2 = false; let has3 = false;
     let wordCount = 0;
     for (const w of (b.w || [])) {
        wordCount++;
        const v = w.v || b.v || 3;
        if (v === 1) has1 = true;
        if (v === 2) has2 = true;
        if (v === 3) has3 = true;
     }

     // Pokud blok zatím nemá oťukaná slova (NextText náhledy), bereme globální barvu bloku
     if (wordCount === 0) {
        const v = b.v || 3;
        return v === containerVoice;
     }

     if (containerVoice === 1 && has1) return true;
     if (containerVoice === 2 && has2) return true;
     if (containerVoice === 3 && has3) return true;

     return false;
  };

  const getVoiceState = (t: number, voice: number) => {
    let ci = blocks.findIndex(b => t >= b.bs && t < b.be && isBlockInVoice(b, voice));
    
    // PAUSE HANDLING: Pokud zrovna žádný text do t nehraje (ticho v písni),
    // chceme na obrazovce ukázat BLÍŽÍCÍ se text jako přípravu, ať se nehledí do tmy.
    if (ci < 0) {
       const nextFutureIdx = blocks.findIndex(b => b.bs >= t && isBlockInVoice(b, voice));
       if (nextFutureIdx >= 0) {
          const futureBlock = blocks[nextFutureIdx];
          if (futureBlock.bs - t < 8.0) { // objeví text až 8s předem
             ci = nextFutureIdx;
          }
       }
    }

    if (ci < 0) return null;
    const cb = blocks[ci];
    let nc = 0;
    for (const w of cb.w || []) {
      if (t >= w.t) nc = w.i + 1;
    }
    const nextIdx = blocks.findIndex((b, idx) => idx > ci && isBlockInVoice(b, voice));
    return {
      cb, nc, ci,
      next: nextIdx >= 0 ? blocks[nextIdx] : null
    };
  };

  const tick = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    const d = audioRef.current.duration || dur || 1;
    const visualTime = t + 0.5;

    const s1 = getVoiceState(visualTime, 1);
    const s2 = getVoiceState(visualTime, 2);
    const sC = getVoiceState(visualTime, 3);
    renderVoiceState(s1, visualTime, 1);
    renderVoiceState(s2, visualTime, 2);
    renderVoiceState(sC, visualTime, 3);

    if (pbarEl.current) pbarEl.current.style.width = `${(t / d) * 100}%`;
    if (videoElRef.current) {
        const diffInput = Math.abs(videoElRef.current.currentTime - t);
        if (diffInput > 0.5) videoElRef.current.currentTime = t;
    }
    if (timeEl.current) {
        const fmt = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
        timeEl.current.textContent = `${fmt(t)} / ${fmt(d)}`;
    }

    if (countEl.current && countBarEl.current) {
        const countdownPoints = (data as any).countdowns && (data as any).countdowns.length > 0
            ? (data as any).countdowns
            : (blocks.length > 0 && blocks[0].w.length > 0 ? [blocks[0].w[0].t] : []);
        const targetPoint = countdownPoints.find((pt: number) => (pt > t && pt - t < 3.5));
        if (targetPoint !== undefined) {
            const diff = targetPoint - t;
            countEl.current.style.display = 'flex';
            countEl.current.style.opacity = '1';
            const valEl = countEl.current.querySelector('.cnt-v');
            if (valEl) valEl.textContent = Math.ceil(diff) > 0 ? `${Math.ceil(diff)}` : '';
            const progress = (Math.max(0, diff) / 3) * 100;
            countBarEl.current.style.width = `${Math.min(100, progress)}%`;
            if (diff < 0.2) countEl.current.style.opacity = (diff / 0.2).toString();
        } else {
            countEl.current.style.display = 'none';
        }
    }

    if (!audioRef.current.paused) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const renderVoiceState = (state: any, t: number, voice: number) => {
    const cur = voice === 1 ? curLineEl1.current : (voice === 2 ? curLineEl2.current : curLineElC.current);
    const nextText = voice === 1 ? nextLineEl1.current : (voice === 2 ? nextLineEl2.current : nextLineElC.current);
    const lastBlkRef = voice === 1 ? lastBlock1 : (voice === 2 ? lastBlock2 : lastBlockC);

    if (!state) {
      if (cur) cur.innerHTML = '';
      if (nextText) nextText.innerHTML = '';
      lastBlkRef.current = -1;
      return;
    }
    const { cb, ci, next: nb } = state;

    if (nextText) {
       if (nb) {
          nextText.innerHTML = nb.lw.map((w: string, i: number) => {
             const wordV = nb.w && nb.w[i] ? (nb.w[i] as any).v : null;
             const targetV = wordV || nb.v || 3;
             let isHidden = (voice !== 3 && voice !== targetV && targetV !== 3);
             return isHidden ? `<span style="visibility: hidden;">${w}</span>` : w;
          }).join(' ');
       } else {
          nextText.innerHTML = '';
       }
    }
    
    if (ci !== lastBlkRef.current) {
      if (cur) {
        // Zjistíme, jestli bylo ticho víc jak 5 vteřin
        let maxBe = 0;
        for(let j = 0; j < ci; j++) {
           if (blocks[j].be > maxBe) maxBe = blocks[j].be;
        }
        cur.innerHTML = cb.lw.map((w: string, i: number) => {
          // Zjistíme hlas konkrétního slova (pokud je v datech)
          const wordV = cb.w && cb.w[i] ? (cb.w[i] as any).v : null;
          const targetV = wordV || cb.v || 3;
          
          let fillColor = '#ffd700'; // Default Gold/Both (S)
          if (targetV === 1) fillColor = '#ff4b2b'; // Voice 1 - Red (A)
          if (targetV === 2) fillColor = '#00d2ff'; // Voice 2 - Blue (D)
          if (targetV === 3) fillColor = '#ffd700'; // Both - Gold (S)

          let isHidden = (voice !== 3 && voice !== targetV && targetV !== 3);

          const wrapStyle = isHidden ? "visibility: hidden;" : "";
          return `<span class="w-wrap" style="${wrapStyle}"><span class="w-off">${w}</span><span class="w-on" style="color: ${fillColor}; text-shadow: 0 0 15px ${fillColor}66">${w}</span></span>`;
        }).join(' ');
        
        cur.classList.remove('block-new');
        void cur.offsetWidth; 
        cur.classList.add('block-new');
      }
      lastBlkRef.current = ci;
    }
    if (cur) {
      // Zpřesnění: Čas do začátku PRVNÍHO SLOVA v řádku (místo začátku bloku bs)
      const firstWordT = cb.w && cb.w[0] ? cb.w[0].t : cb.bs;
      const realTimeToStartLine = firstWordT - (t - 0.5); 

      // Výpočet mezery od předchozího bloku pro tento hlas
      let lastBe = 0;
      for (let j = 0; j < ci; j++) {
        if (isBlockInVoice(blocks[j], voice) && blocks[j].be > lastBe) lastBe = blocks[j].be;
      }
      const gap = (ci === 0) ? firstWordT : (firstWordT - lastBe);
      const shouldFlash = gap >= 5.0;

      const wraps = cur.querySelectorAll('.w-wrap');
      wraps.forEach((wrap: any, i: number) => {
        const off = wrap.querySelector('.w-off');
        const on = wrap.querySelector('.w-on');
        if (!on || !off) return;
        
        const wordStart = cb.w[i].t;
        const wordEnd = (i < cb.w.length - 1) ? cb.w[i+1].t : cb.be;
        
        // ORANŽOVÉ BLIKNUTÍ - Pouze při pauze > 5s nebo na začátku
        if (shouldFlash && realTimeToStartLine <= 1.5 && realTimeToStartLine > 0.5) {
           off.style.color = '#ff8c00'; // Oranžová upozorňovačka
           off.style.textShadow = '0 0 15px #ff8c00aa';
        } else {
           off.style.color = '';
           off.style.textShadow = '';
        }

        let p = 0;
        if (t >= wordStart && t < wordEnd) p = (t - wordStart) / (wordEnd - wordStart);
        else if (t >= wordEnd) p = 1;
        on.style.clipPath = `inset(0 ${100 - (p * 100)}% 0 0)`;
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
  };

  const [userInteracted, setUserInteracted] = useState(true);
  const hasVideo = !!song.videoUrl;

  return (
    <div className="player-root" style={{ 
      position: 'fixed', inset: 0, background: '#000', color: '#fff', 
      fontFamily: 'Inter, sans-serif', overflow: 'hidden' 
    }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .player-root { --glow: rgba(255, 215, 0, 0.55); }
        .w-wrap { position: relative; display: inline-block; padding: 0; margin: 0 0.1em; }
        .w-on { position: absolute; left: 0; top: 0; height: 100%; width: 100%; clip-path: inset(0 100% 0 0); overflow: visible; white-space: nowrap; text-shadow: 1px 1px 3px rgba(0,0,0,0.9); }
        .ln-ctx { font-size: clamp(14px, 1.8vw, 22px); color: rgba(255,255,255,0.4); font-weight: 700; text-align: center; min-height: 1.4em; transition: opacity 0.3s; }
        #cur-line-1, #cur-line-2, #cur-line-C { position: relative; font-size: clamp(24px, 5.5vw, 70px); font-weight: 900; text-align: center; min-height: 1.2em; line-height: 1.1; letter-spacing: -0.01em; }
        @keyframes blockIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .block-new { animation: blockIn 0.3s ease-out forwards; }
        @media (min-width: 1025px) {
          .mobile-only { display: none !important; }
        }
        @media (max-width: 600px) {
          .footer-title-hide { display: none !important; }
        }
      `}} />

      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {hasVideo && !isChordsMode ? (
          <video ref={videoElRef} src={song.videoUrl || ''} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <img 
            src={song.backgroundUrl || randomBackground}
            onLoad={() => setImgLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.35) saturate(1.2)', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.8s ease-in-out' }} 
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)' }} />
      </div>

      <div id="stage" style={{ position: 'relative', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: isChordsMode ? 'auto' : 'hidden', pointerEvents: isChordsMode ? 'auto' : 'none', zIndex: 3 }}>
        {isChordsMode ? (
           song.chords ? (
              <ChordsView chords={song.chords} songTitle={song.title} artist={song.artist} />
           ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '2rem' }}>
                 <p style={{ fontSize: '24px', opacity: 0.5 }}>Tato píseň zatím nemá uložené akordy.</p>
                 <Link href="/" style={{ padding: '1rem 2rem', background: 'var(--color-gold)', color: '#000', borderRadius: '14px', textDecoration: 'none', fontWeight: 900 }}>Zpět do katalogu</Link>
              </div>
           )
        ) : (
          <>
            <div ref={countEl} style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
              <div className="cnt-v" style={{ color: 'var(--color-gold)', fontSize: '85px', lineHeight: 1, fontWeight: 900, textShadow: '0 0 40px rgba(255,215,0,0.8)', filter: 'drop-shadow(0 4px 15px rgba(0,0,0,0.8))', marginBottom: '-5px' }} />
              <div style={{ width: '180px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', boxShadow: '0 0 25px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                 <div ref={countBarEl} style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #FFD700, #FFA500, #FFD700)', boxShadow: '0 0 15px var(--color-gold)', transition: 'width 0.1s linear' }} />
              </div>
            </div>
            
            {/* HLAS 1 (Top) */}
            <div id="voice1" style={{ position: 'absolute', top: '15%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3vh', padding: '0 5vw' }}>
              <div id="cur-line-1" ref={curLineEl1} style={{ color: 'white' }}></div>
              <div className="ln-ctx" ref={nextLineEl1} style={{ opacity: 0.4 }}></div>
            </div>
    
            {/* HLAS CENTER (Standard W) */}
            <div id="voice3" style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3vh', padding: '0 5vw' }}>
              <div id="cur-line-C" ref={curLineElC} style={{ color: 'white' }}></div>
              <div className="ln-ctx" ref={nextLineElC} style={{ opacity: 0.4 }}></div>
            </div>
    
            {/* HLAS 2 (Bottom) */}
            <div id="voice2" style={{ position: 'absolute', bottom: '25%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3vh', padding: '0 5vw' }}>
              <div id="cur-line-2" ref={curLineEl2} style={{ color: 'white' }}></div>
              <div className="ln-ctx" ref={nextLineEl2} style={{ opacity: 0.4 }}></div>
            </div>
          </>
        )}
      </div>

      <div id="ui-layer" style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
         <div id="controls" style={{ 
           padding: '1.2rem 1.5rem 2.5rem', 
           display: 'flex', 
           flexDirection: 'column',
           gap: '0.8rem',
           pointerEvents: 'auto', 
           background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)',
           backdropFilter: 'blur(10px)'
         }}>
            
            {/* PROGRESS BAR - FULL WIDTH & BIG TOUCH AREA */}
            {!isChordsMode && (
               <div className="progress-section" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div 
                    onClick={handleSeek} 
                    style={{ 
                      height: '32px', // Větší plocha pro dotyk dle pravidel
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 20
                    }}
                  >
                     <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', position: 'relative', overflow: 'hidden' }}>
                        <div ref={pbarEl} style={{ height: '100%', background: 'var(--color-gold)', width: '0%', borderRadius: '10px', boxShadow: '0 0 15px var(--glow)' }} />
                     </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, padding: '0 2px' }}>
                     <span ref={timeEl}>0:00 / 0:00</span>
                     <span className="footer-title-hide" style={{ opacity: 0.8 }}>{song.artist} – {song.title}</span>
                  </div>
               </div>
            )}

            <div className="bottom-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              
              <div className="btn-group-left" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                {!isChordsMode && (
                  <button 
                    onClick={toggleMute} 
                    style={{ 
                      width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', 
                      border: '1px solid rgba(255,255,255,0.1)', color: isMuted ? '#ff4b2b' : 'white', 
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' 
                    }}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                )}

                <button onClick={(e) => { e.stopPropagation(); toggleFullScreen(); }} style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                   ⛶
                </button>
              </div>

              <div className="btn-group-center" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {!isChordsMode && (
                  <button onClick={togglePlay} style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'var(--color-gold)', border: 'none', color: '#000', fontSize: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(255,215,0,0.4)', transition: 'transform 0.2s', zIndex: 100 }}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                )}
                {joinCode && (
                  <button onClick={handleNext} style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }} title="Další ve frontě">
                    ⏭️
                  </button>
                )}
              </div>

              <div className="btn-group-right" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                {!isChordsMode && song.instrumentalUrl && (
                  <button onClick={toggleTrack} style={{ height: '46px', padding: '0 16px', borderRadius: '14px', background: isInstrumental ? 'rgba(0,177,64,0.15)' : 'rgba(255,255,255,0.08)', border: isInstrumental ? '1px solid #00B140' : '1px solid rgba(255,255,255,0.1)', color: isInstrumental ? '#00ffa0' : 'white', cursor: 'pointer', fontWeight: 800, fontSize: '11px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isInstrumental ? '🎻 KARAOKE' : '👤 ORIGINÁL'}
                  </button>
                )}
                <Link href="/" style={{ height: '46px', padding: '0 16px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '14px', textDecoration: 'none', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', fontWeight: 700 }} onClick={e=>e.stopPropagation()}>ZAVŘÍT</Link>
              </div>

            </div>
         </div>
      </div>
    </div>
  );
}
