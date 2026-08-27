'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { incrementPlayCount } from '@/app/admin/actions';
import { useSession } from '@/context/SessionContext';
import { getSessionStatus, updateSessionState, advanceSessionQueue } from '@/app/actions/session-actions';
import { recordSinging } from '@/app/actions/user-actions';
import HlaseniChyby from '@/components/HlaseniChyby';

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
  const isWatchMode = typeof window !== 'undefined' && window.location.search.includes('mode=watch');
  const router = useRouter();
  const { joinCode, sessionData, localMode, isHost } = useSession();
  const isChordsMode = localMode === 'CHORDS' || sessionData?.sessionMode === 'CHORDS';
  const shouldSuppressAudio = (isChordsMode || isWatchMode) && !isHost;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  /** Otevřený dialog hlášení chyby + hláška po odeslání. */
  const [hlasim, setHlasim] = useState(false);
  const [hlaseniHotovo, setHlaseniHotovo] = useState('');

  useEffect(() => {
    if (!hlaseniHotovo) return;
    const t = setTimeout(() => setHlaseniHotovo(''), 4000);
    return () => clearTimeout(t);
  }, [hlaseniHotovo]);
  const [playbackMode, setPlaybackMode] = useState<'ORIG' | 'INST'>(() => {
    if (!song.instrumentalUrl) return 'ORIG';
    if (typeof window === 'undefined') return 'INST';
    const posledni = window.localStorage.getItem('karacho:rezim');
    return posledni === 'ORIG' ? 'ORIG' : 'INST';
  });

  // Zapamatování volby, ať navazující písně jedou ve stejném režimu.
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('karacho:rezim', playbackMode);
  }, [playbackMode]);
  const playbackModeRef = useRef(playbackMode);
  const [imgLoaded, setImgLoaded] = useState(false);

  const systemBackgrounds = useMemo(() => [
    '/backgrounds/pop.png', '/backgrounds/rock.png', '/backgrounds/disco.png',
    '/backgrounds/retro_80s.png', '/backgrounds/jazz.png', '/backgrounds/country.png',
    '/backgrounds/hiphop.png', '/backgrounds/jungle.png', '/backgrounds/rocknroll.png',
    '/backgrounds/opera.png', '/backgrounds/hightech.png', '/backgrounds/matrix.png',
    '/backgrounds/tekkno.png', '/backgrounds/funk.png'
  ], []);

  const randomBackground = useMemo(() => {
    return systemBackgrounds[Math.floor(Math.random() * systemBackgrounds.length)];
  }, [systemBackgrounds]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Skrytý element, který si na pozadí stáhne tu stopu, která zrovna nehraje.
  // Nikdy se nepřehrává – jde jen o to mít soubor v mezipaměti, aby přepnutí
  // režimu nemuselo stahovat 3–5 MB (na mobilu to bylo znát jako zaseknutí).
  const preloadRef = useRef<HTMLAudioElement | null>(null);
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

  const lastBlock1A = useRef<number>(-1);
  const lastBlock1B = useRef<number>(-1);
  const lastBlock2A = useRef<number>(-1);
  const lastBlock2B = useRef<number>(-1);
  const lastBlockCA = useRef<number>(-1);
  const lastBlockCB = useRef<number>(-1);
  const recordHandled = useRef(false);

  const data: TimingData = (song.timingData as any) || { blocks: [], dur: 0 };
  const blocks = data.blocks || [];
  const dur = data.dur || 0;

  const isDuet = useMemo(() => {
    return blocks.some(b => {
      if (b.v === 1 || b.v === 2) return true;
      return b.w?.some(w => w.v === 1 || w.v === 2);
    });
  }, [blocks]);

  const availableModes = useMemo(() => {
    const m: ('INST' | 'ORIG')[] = [];
    if (song.instrumentalUrl) {
       m.push('INST');
    }
    m.push('ORIG');
    return m;
  }, [song.instrumentalUrl]);

  useEffect(() => {
    if ('mediaSession' in navigator && song) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist || 'Karacho Interpret',
        album: 'Karacho Karaoke 🎤',
        artwork: [
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
         const btn = document.getElementById('main-play-btn');
         if (btn) btn.click();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
         const btn = document.getElementById('main-play-btn');
         if (btn) btn.click();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
         const btn = document.getElementById('main-next-btn');
         if (btn) btn.click();
      });
    }
  }, [song]);

  /**
   * Odchod z písně. Musí VŽDY nejdřív vypnout celoobrazovkový režim:
   * fullscreen visí na documentElement, takže klientská navigace ho nezruší
   * a uživatel skončí na katalogu pořád „zamčený" v fullscreenu – na mobilu
   * to vypadá, jako by tlačítko nefungovalo. Zároveň se smaže příznak, který
   * fullscreen jinak automaticky obnoví u další písně.
   */
  const closePlayer = async () => {
    try {
      sessionStorage.setItem('karacho-fullscreen', '0');
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* fullscreen nemusí jít vypnout – odchod nesmí zablokovat */
    }
    router.push('/');
  };

  // Preserve fullscreen across session song transitions
  useEffect(() => {
    const wasFullscreen = sessionStorage.getItem('karacho-fullscreen') === '1';
    if (wasFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    const onFsChange = () => {
      sessionStorage.setItem('karacho-fullscreen', document.fullscreenElement ? '1' : '0');
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

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

  useEffect(() => {
    let p: any = audioRef.current;
    if (!p) return;
    
    if (audioRef.current && song.audioUrl) {
      // Set initial source based on playback mode
      audioRef.current.src = playbackModeRef.current === 'INST' && song.instrumentalUrl ? song.instrumentalUrl : song.audioUrl;
    }

    if (shouldSuppressAudio || isMuted) {
      p.muted = true;
    }

    if (p instanceof HTMLAudioElement) {
       p.preload = "auto";
    }

    if (song.startTime > 0 && p.currentTime === 0) {
      p.currentTime = song.startTime;
    }

    const handlePlay = () => {
      if (isChordsMode && !isHost) {
        p.pause();
        return;
      }
      setIsPlaying(true);
      requestWakeLock();
      if (joinCode && !isWatchMode) {
        updateSessionState(joinCode, { 
          status: 'PLAYING', 
          currentSongId: song.id,
          startedAt: new Date().toISOString(),
          startTimeOffset: p.currentTime
        });
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      releaseWakeLock();
      if (joinCode && !isWatchMode) {
        updateSessionState(joinCode, { status: 'PAUSED', currentTime: p.currentTime });
      }
    };

    const handleEnded = async () => {
      setIsPlaying(false);
      lastBlock1A.current = -1; lastBlock1B.current = -1;
      lastBlock2A.current = -1; lastBlock2B.current = -1;
      lastBlockCA.current = -1; lastBlockCB.current = -1;
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

    p.onplay = handlePlay;
    p.onpause = handlePause;
    p.onended = handleEnded;

    const handlePlaying = () => {
      if (!recordHandled.current) {
        incrementPlayCount(song.id);
        recordSinging(song.id);
        recordHandled.current = true;
      }
      startTick();
    };

    p.onplaying = handlePlaying;

    const syncInterval = setInterval(async () => {
      const currentPlayer = audioRef.current;
      if (!currentPlayer) return;

      if (!joinCode) return;

      if (!isWatchMode) {
        if (!currentPlayer.paused) {
          updateSessionState(joinCode, { currentTime: currentPlayer.currentTime, status: 'PLAYING' });
        }
      } else {
        const session = await getSessionStatus(joinCode);
        if (session) {
          const s = session as any;
          let serverTime = s.currentTime || 0;
          if (s.status === 'PLAYING' && s.startedAt) {
            const now = Date.now();
            const startedAt = new Date(s.startedAt).getTime();
            serverTime = (now - startedAt) / 1000 + (s.startTimeOffset || 0);
          }

          const diff = serverTime - currentPlayer.currentTime;
          const absDiff = Math.abs(diff);

          if (absDiff > 1.2) {
            currentPlayer.currentTime = serverTime;
          } else if (absDiff > 0.15) {
            const rate = diff > 0 ? 1.05 : 0.95;
            currentPlayer.playbackRate = rate;
          } else {
            currentPlayer.playbackRate = 1.0;
          }

          if (s.status === 'PLAYING' && currentPlayer.paused && !isChordsMode) {
            currentPlayer.play().catch(() => {});
          } else if (s.status === 'PAUSED' && !currentPlayer.paused) {
            currentPlayer.pause();
          }
        }
      }
    }, isWatchMode ? 250 : 1000);

    if (!isChordsMode || isHost) {
      p.play().catch(() => {});
    }

    return () => {
      clearInterval(syncInterval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      p.pause();
      releaseWakeLock();
    };
  }, [song.audioUrl, song.instrumentalUrl, joinCode]);

  // Druhá stopa se přednačítá jen když dává smysl: v režimu akordů se zvuk
  // podle manifestu nesmí ani bufferovat, a bez instrumentálu není co stahovat.
  useEffect(() => {
    const el = preloadRef.current;
    if (!el) return;
    const druha =
      playbackMode === 'INST' ? song.audioUrl : song.instrumentalUrl;
    if (shouldSuppressAudio || isChordsMode || !song.instrumentalUrl || !druha) {
      el.removeAttribute('src');
      el.load();
      return;
    }
    if (el.getAttribute('src') !== druha) {
      el.src = druha;
      el.load();
    }
  }, [playbackMode, song.audioUrl, song.instrumentalUrl, shouldSuppressAudio, isChordsMode]);

  const cyclePlaybackMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!song.instrumentalUrl) return;
    const p = audioRef.current;
    if (!p) return;
    
    const currentIndex = availableModes.indexOf(playbackMode);
    const nextIndex = (currentIndex + 1) % availableModes.length;
    const nextMode = availableModes[nextIndex] as any;
    
    const wasPlaying = !p.paused;
    const currentTime = p.currentTime;

    p.src = nextMode === 'INST' ? (song.instrumentalUrl || song.audioUrl) : song.audioUrl;

    // Čas se smí nastavit až když má element načtená metadata. Dřív se
    // nastavoval hned po výměně src, kdy je readyState ještě 0 – Chrome si
    // takový seek odloží, ale Safari na iPhonu ho umí zahodit nebo provést
    // pozdě, což bylo slyšet jako škubnutí a skok v čase.
    const obnovitPozici = () => {
      p.currentTime = currentTime;
      if (wasPlaying) p.play().catch(() => {});
    };
    // Na `readyState` se hned po výměně src spolehnout nejde – prohlížeč ho
    // resetuje až v další úloze, takže by ještě hlásil stav PŘEDCHOZÍ stopy
    // a seek by se ztratil. Čekáme proto vždy na loadedmetadata.
    p.addEventListener('loadedmetadata', obnovitPozici, { once: true });
    p.load();

    setPlaybackMode(nextMode);
    playbackModeRef.current = nextMode;
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
  }, [isMuted]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isChordsMode && !isHost) return;
    const p = audioRef.current;
    if (!p) return;
    
    const isCurrentlyPaused = p.paused;
    const newStatus = isCurrentlyPaused ? 'PLAYING' : 'PAUSED';

    if (isCurrentlyPaused) {
      p.play().catch(() => {});
    } else {
      p.pause();
    }

    if (joinCode) {
      updateSessionState(joinCode, { 
        status: newStatus, 
        currentTime: p.currentTime || 0
      });
    }
  };

  const handleNext = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const p = audioRef.current;
    if (p) p.pause();

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

     const blockVoice = (wordCount === 0) ? (b.v || 3) : null;

     if (isDuet) {
        // Duet: společný text patří doprostřed, a jen tam. Dřív ho dostávaly
        // oba krajní pásy, takže se stejný řádek vypsal dvakrát nad sebou.
        const jeSpolecny = (blockVoice !== null) ? blockVoice === 3 : (has3 && !has1 && !has2);

        if (containerVoice === 3) return jeSpolecny;
        if (jeSpolecny) return false;

        if (containerVoice === 1) {
           if (blockVoice !== null) return blockVoice === 1;
           return has1;
        }
        if (containerVoice === 2) {
           if (blockVoice !== null) return blockVoice === 2;
           return has2;
        }
     } else {
        // Solo mode: only container 3 (center) is used.
        if (containerVoice === 1 || containerVoice === 2) return false;
        return true; // All blocks go to container 3
     }
     return false;
  };

  const getVoiceState = (t: number, voice: number) => {
    let ci = blocks.findIndex(b => t >= b.bs && t < b.be && isBlockInVoice(b, voice));
    if (ci < 0) {
       const nextFutureIdx = blocks.findIndex(b => b.bs >= t && isBlockInVoice(b, voice));
       if (nextFutureIdx >= 0 && blocks[nextFutureIdx].bs - t < 8.0) ci = nextFutureIdx;
    }
    if (ci < 0) return null;
    const cb = blocks[ci];

    // If the first word is more than 5s away, don't show this block as active yet
    // Instead, show it only as the "next" preview
    const firstWordTime = cb.w?.[0]?.t ?? cb.bs;
    if (firstWordTime - t > 5.0) {
       // Find the previous block in this voice to keep showing as active
       const prevIdx = blocks.slice(0, ci).reverse().findIndex(b => isBlockInVoice(b, voice));
       if (prevIdx >= 0) {
          const realPrevIdx = ci - 1 - prevIdx;
          const prevBlock = blocks[realPrevIdx];
          let nc = 0;
          for (const w of prevBlock.w || []) { if (t >= w.t) nc = w.i + 1; }
          return { cb: prevBlock, nc, ci: realPrevIdx, next: cb };
       }
       return null;
    }

    let nc = 0;
    for (const w of cb.w || []) { if (t >= w.t) nc = w.i + 1; }
    return { cb, nc, ci, next: blocks.find((b, idx) => idx > ci && isBlockInVoice(b, voice)) || null };
  };


  const tick = () => {
    const p = audioRef.current;
    if (!p) return;
    const t = p.currentTime;
    const d = p.duration || dur || 1;
    const visualTime = t + 0.2;

    const s1 = getVoiceState(visualTime, 1);
    const s2 = getVoiceState(visualTime, 2);
    const sC = getVoiceState(visualTime, 3);

    // No dual-audio sync needed - single element plays the active track

    renderVoiceState(s1, visualTime, 1, curLineEl1, nextLineEl1, lastBlock1A, lastBlock1B);
    renderVoiceState(s2, visualTime, 2, curLineEl2, nextLineEl2, lastBlock2A, lastBlock2B);
    renderVoiceState(sC, visualTime, 3, curLineElC, nextLineElC, lastBlockCA, lastBlockCB);

    if (pbarEl.current) pbarEl.current.style.width = `${(t / d) * 100}%`;
    if (timeEl.current) {
        const fmt = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
        timeEl.current.textContent = `${fmt(t)} / ${fmt(d)}`;
    }

    if (countEl.current && countBarEl.current) {
        const countdownPoints = (data as any).countdowns || [];
        const targetPoint = countdownPoints.find((pt: number) => (pt > t && pt - t < 3.5));
        if (targetPoint !== undefined) {
            const diff = targetPoint - t;
            countEl.current.style.display = 'flex';
            countEl.current.style.opacity = '1';
            const valEl = countEl.current.querySelector('.cnt-v');
            if (valEl) valEl.textContent = Math.ceil(diff) > 0 ? `${Math.ceil(diff)}` : '';
            countBarEl.current.style.width = `${Math.min(100, (Math.max(0, diff) / 3) * 100)}%`;
        } else {
            countEl.current.style.display = 'none';
        }
    }

    if (!p.paused) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const getShouldBlockFlash = (block: PlayerBlock | null, t: number, voice: number) => {
    if (!block) return false;
    const voiceBlocks = blocks.filter(b => isBlockInVoice(b, voice));
    const blockIdx = voiceBlocks.indexOf(block);
    if (blockIdx < 0) return false;

    const firstWordT = block.w?.[0]?.t || block.bs;
    const realTimeToStartLine = firstWordT - (t - 0.2);

    let lastBe = 0;
    for (let j = 0; j < blockIdx; j++) {
      if (voiceBlocks[j].be > lastBe) lastBe = voiceBlocks[j].be;
    }
    const gap = (blockIdx === 0) ? firstWordT : (firstWordT - lastBe);
    return gap >= 5.0 && realTimeToStartLine <= 1.5 && realTimeToStartLine > 0.2;
  };

  const renderBlockToRow = (
    rowEl: HTMLDivElement | null,
    block: PlayerBlock | null,
    isActive: boolean,
    t: number,
    voice: number,
    blockIdx: number,
    lastRef: React.MutableRefObject<number>,
    shouldFlash: boolean
  ) => {
    if (!rowEl) return;
    if (!block) {
      rowEl.innerHTML = '';
      lastRef.current = -1;
      return;
    }

    if (blockIdx !== lastRef.current) {
      rowEl.innerHTML = block.lw.map((w: string, i: number) => {
        const targetV = block.w?.[i]?.v || block.v || 3;
        let fillColor = '#ffd700'; 
        if (targetV === 1) fillColor = '#ff4b2b'; 
        if (targetV === 2) fillColor = '#00d2ff'; 
        let isHidden = (voice !== 3 && voice !== targetV && targetV !== 3);
        const wrapStyle = isHidden ? "visibility: hidden;" : "";
        return `<span class="w-wrap" style="${wrapStyle}"><span class="w-off">${w}</span><span class="w-on" style="color: ${fillColor}; text-shadow: 0 0 15px ${fillColor}66">${w}</span></span>`;
      }).join(' ');

      if (isActive) {
        rowEl.classList.remove('block-new');
        void rowEl.offsetWidth; 
        rowEl.classList.add('block-new');
      }
      lastRef.current = blockIdx;
    }

    const wraps = rowEl.querySelectorAll('.w-wrap');
    wraps.forEach((wrap: any, i: number) => {
      const off = wrap.querySelector('.w-off');
      const on = wrap.querySelector('.w-on');
      if (!on || !off) return;

      if (isActive) {
        let p = 0;
        if (block.w && block.w[i]) {
           const wordStart = block.w[i].t;
           const wordEnd = (i < block.w.length - 1) ? block.w[i+1].t : block.be;
           if (t >= wordStart && t < wordEnd) p = (t - wordStart) / (wordEnd - wordStart);
           else if (t >= wordEnd) p = 1;
        } else {
           if (t >= block.bs && t < block.be) p = (t - block.bs) / (block.be - block.bs);
           else if (t >= block.be) p = 1;
        }
        on.style.clipPath = `inset(0 ${100 - (p * 100)}% 0 0)`;
        
        if (shouldFlash) {
           off.style.color = '#ff8c00'; 
           off.style.textShadow = '0 0 15px #ff8c00aa';
        } else {
           off.style.color = '';
           off.style.textShadow = '';
        }
      } else {
        on.style.clipPath = 'inset(0 100% 0 0)';
        if (shouldFlash) {
           off.style.color = '#ff8c00'; 
           off.style.textShadow = '0 0 15px #ff8c00aa';
        } else {
           off.style.color = '';
           off.style.textShadow = '';
        }
      }
    });

    if (isActive) {
      rowEl.classList.remove('upcoming-line');
      rowEl.classList.add('active-line');
    } else {
      rowEl.classList.remove('active-line');
      rowEl.classList.add('upcoming-line');
    }
  };

  const renderVoiceState = (state: any, t: number, voice: number, curEl: any, nextEl: any, lastRefA: any, lastRefB: any) => {
    if (!state) {
      if (curEl.current) curEl.current.innerHTML = '';
      if (nextEl.current) nextEl.current.innerHTML = '';
      lastRefA.current = -1;
      lastRefB.current = -1;
      return;
    }
    const { cb, ci, next: nb } = state;

    const voiceBlocks = blocks.filter(b => isBlockInVoice(b, voice));
    const activeVoiceIdx = voiceBlocks.indexOf(cb);

    const isEven = activeVoiceIdx % 2 === 0;
    const row1Block = isEven ? cb : nb;
    const row2Block = isEven ? nb : cb;

    const row1Active = isEven;
    const row2Active = !isEven;

    const row1Idx = row1Block ? blocks.findIndex(b => b === row1Block) : -99;
    const row2Idx = row2Block ? blocks.findIndex(b => b === row2Block) : -99;

    const row1Flash = getShouldBlockFlash(row1Block, t, voice);
    const row2Flash = getShouldBlockFlash(row2Block, t, voice);

    renderBlockToRow(curEl.current, row1Block, row1Active, t, voice, row1Idx, lastRefA, row1Flash);
    renderBlockToRow(nextEl.current, row2Block, row2Active, t, voice, row2Idx, lastRefB, row2Flash);
  };

  const handleSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = audioRef.current;
    if (!p) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * (p.duration || 0);
    p.currentTime = t;
  };


  return (
    <div className="player-root" style={{ position: 'fixed', inset: 0, background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />
      {/* Předstažení druhé stopy – trvale ztlumené, nikdy se nepřehrává. */}
      <audio ref={preloadRef} preload="auto" muted crossOrigin="anonymous" />

      {hlasim && (
        <HlaseniChyby
          songId={song.id}
          nazev={`${song.artist || 'Neznámý interpret'} – ${song.title}`}
          onClose={() => setHlasim(false)}
          onHotovo={(z) => setHlaseniHotovo(z)}
        />
      )}

      {hlaseniHotovo && (
        <div
          onClick={() => setHlaseniHotovo('')}
          style={{
            position: 'absolute', top: '2rem', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0, 255, 180, 0.25)', border: '1px solid rgba(0, 255, 180, 0.5)',
            padding: '10px 24px', borderRadius: '30px', color: '#fff', fontSize: '13px', fontWeight: 900,
            backdropFilter: 'blur(15px)', zIndex: 10000, cursor: 'pointer', maxWidth: '90vw', textAlign: 'center',
          }}
        >
          {hlaseniHotovo}
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        .player-root { --glow: rgba(255, 215, 0, 0.55); }
        nav { display: none !important; }
        .w-wrap { position: relative; display: inline-block; padding: 0; margin: 0 0.1em; }
        .w-on { position: absolute; left: 0; top: 0; height: 100%; width: 100%; clip-path: inset(0 100% 0 0); overflow: visible; white-space: nowrap; text-shadow: 1px 1px 3px rgba(0,0,0,0.9); }
        .karaoke-line { position: relative; font-size: clamp(24px, 5vw, 60px); font-weight: 900; text-align: center; min-height: 1.2em; line-height: 1.1; letter-spacing: -0.01em; color: rgba(255,255,255,0.6); text-shadow: 1px 1px 3px rgba(0,0,0,0.8); transition: transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1), color 0.3s ease, text-shadow 0.3s ease; transform-origin: center; }
        .karaoke-line.active-line { transform: scale(1); color: rgba(255,255,255,1); }
        .karaoke-line.upcoming-line { transform: scale(0.75); color: rgba(255,255,255,0.5); }
        @keyframes blockIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .block-new { animation: blockIn 0.3s ease-out forwards; }
        @media (min-width: 1025px) {
          .mobile-only { display: none !important; }
        }
        /* Skupiny tlačítek smí zmenšit obsah. Bez min-width:0 je flex položka
           nezmenšitelná pod velikost obsahu a spodní lišta přeteče – ZAVŘÍT
           pak vypadne mimo obrazovku a ořízne ho overflow:hidden na .player-root
           (na úzkém telefonu se z písně nedalo odejít). */
        .btn-group-left, .btn-group-center, .btn-group-right { min-width: 0; }

        @media (max-width: 600px) {
          .footer-title-hide { display: none !important; }
          /* Na úzkém displeji jen křížek – text by lištu rozbil. */
          .close-label { display: none !important; }
          .btn-group-right .close-btn { padding: 0 !important; width: 40px !important; height: 40px !important; gap: 0 !important; font-size: 18px !important; }
          .bottom-row { gap: 0.5rem !important; }
          .btn-group-left, .btn-group-right { gap: 0.5rem !important; }
          /* Užší okraje a menší tlačítka, ať se lišta vejde i s frontou. */
          #controls { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
          .btn-group-left button, .btn-group-right button, #main-next-btn { width: 40px !important; height: 40px !important; font-size: 17px !important; }
          #main-play-btn { width: 60px !important; height: 60px !important; font-size: 26px !important; }
        }

        /* Nejužší telefony (iPhone SE apod.) – ještě o kus těsněji. */
        @media (max-width: 360px) {
          #controls { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
          .bottom-row { gap: 0.375rem !important; }
          .btn-group-left, .btn-group-right, .btn-group-center { gap: 0.375rem !important; }
          .btn-group-left button, .btn-group-right button, #main-next-btn { width: 36px !important; height: 36px !important; font-size: 16px !important; padding: 0 !important; }
          .btn-group-right .close-btn { width: 38px !important; height: 38px !important; }
          #main-play-btn { width: 52px !important; height: 52px !important; font-size: 22px !important; }
        }
        @media (max-height: 520px) {
          .karaoke-line { font-size: clamp(16px, 7vh, 38px) !important; min-height: 1.1em !important; }
          #voice1 { top: 8% !important; gap: 1vh !important; }
          #voice2 { bottom: 25% !important; gap: 1vh !important; }
          #voice3 { gap: 1.5vh !important; }
          #controls { padding: 0.5rem 1rem 0.8rem !important; gap: 0.4rem !important; }
          .progress-section { gap: 2px !important; }
          .progress-section > div:first-child { height: 20px !important; }
          #main-play-btn { width: 48px !important; height: 48px !important; font-size: 20px !important; }
          /* Popisky pryč i naležato. Bez toho zůstal v přepínači text
             „INSTRUMENTÁL", ale pravidlo níž mu vnutilo šířku 36 px – text
             z tlačítka vytekl a překrýval sousední Zavřít. */
          .footer-title-hide { display: none !important; }
          .close-label { display: none !important; }
          .btn-group-left button, .btn-group-right button, #main-next-btn { width: 36px !important; height: 36px !important; font-size: 16px !important; border-radius: 10px !important; padding: 0 !important; }
          /* Zavřít je jediná cesta z písně ven, tak mu necháme větší cíl na prst.
             Selektor je záměrně specifičtější než pravidlo nad ním, jinak by ho
             přebilo (obojí je !important, rozhoduje specifičnost). */
          .btn-group-right .close-btn { width: 44px !important; height: 44px !important; padding: 0 !important; }
        }
      `}} />

      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <img
            ref={(el) => { if (el?.complete) setImgLoaded(true); }}
            src={song.backgroundUrl || randomBackground}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.35) saturate(1.2)', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.8s ease-in-out' }} 
            alt="background"
        />
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
            
            <div id="voice1" style={{ position: 'absolute', top: '22%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3vh', padding: '0 5vw' }}>
              <div className="karaoke-line" ref={curLineEl1}></div>
              <div className="karaoke-line" ref={nextLineEl1}></div>
            </div>
    
            <div id="voice3" style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3vh', padding: '0 5vw' }}>
              <div className="karaoke-line" ref={curLineElC}></div>
              <div className="karaoke-line" ref={nextLineElC}></div>
            </div>
    
            <div id="voice2" style={{ position: 'absolute', bottom: '35%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3vh', padding: '0 5vw' }}>
              <div className="karaoke-line" ref={curLineEl2}></div>
              <div className="karaoke-line" ref={nextLineEl2}></div>
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
            
            {!isChordsMode && (
               <div className="progress-section" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div 
                    onClick={handleSeek} 
                    style={{ 
                      height: '32px', 
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

            <div className="bottom-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', width: '100%' }}>
              
              <div className="btn-group-left" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.8rem', justifyContent: 'flex-start' }}>
                {!isChordsMode && (
                  <button 
                    onClick={toggleMute} 
                    style={{ 
                      width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', 
                      border: '1px solid rgba(255,255,255,0.1)', color: isMuted ? '#ff4b2b' : 'white', 
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                      flexShrink: 0
                    }}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                )}

                <button onClick={(e) => { e.stopPropagation(); toggleFullScreen(); }} style={{ flexShrink: 0, width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                   ⛶
                </button>

                {/* Hlásit chybu se dá až odsud, protože že text nesedí na
                    nahrávku se pozná při zpívání, ne v katalogu. Schválně
                    v levé skupině — vpravo se na mobilu tak tak vejde
                    přepínač stop a Zavřít. */}
                <button
                  onClick={(e) => { e.stopPropagation(); setHlasim(true); }}
                  title="Nahlásit špatný text nebo špatnou píseň"
                  aria-label="Nahlásit chybu"
                  style={{ flexShrink: 0, width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}
                >
                   ⚠️
                </button>
              </div>

              <div className="btn-group-center" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center' }}>
                {!isChordsMode && (
                  <button id="main-play-btn" onClick={togglePlay} style={{ flexShrink: 0, width: '68px', height: '68px', borderRadius: '50%', background: 'var(--color-gold)', border: 'none', color: '#000', fontSize: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(255,215,0,0.4)', transition: 'transform 0.2s', zIndex: 100 }}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                )}
                {joinCode && (
                  <button id="main-next-btn" onClick={handleNext} style={{ flexShrink: 0, width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }} title="Další ve frontě">
                    ⏭️
                  </button>
                )}
              </div>

              <div className="btn-group-right" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.8rem', justifyContent: 'flex-end' }}>
                {!isChordsMode && song.instrumentalUrl && (
                  <button 
                    onClick={cyclePlaybackMode} 
                    style={{ 
                      padding: '0 15px', height: '46px', borderRadius: '14px', 
                      background: playbackMode !== 'ORIG' ? 'rgba(0,255,160,0.1)' : 'rgba(255,255,255,0.08)', 
                      border: `1px solid ${playbackMode !== 'ORIG' ? '#00ffa0aa' : 'rgba(255,255,255,0.1)'}`, 
                      color: playbackMode !== 'ORIG' ? '#00ffa0' : 'white', 
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontSize: '11px', fontWeight: 900, gap: '8px'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>
                      {playbackMode === 'INST' && '🎹'}
                      {playbackMode === 'ORIG' && '🎤'}
                    </span>
                    <span className="footer-title-hide">
                      {playbackMode === 'INST' && 'INSTRUMENTÁL'}
                      {playbackMode === 'ORIG' && 'ORIGINÁL'}
                    </span>
                  </button>
                )}
                <button
                  className="close-btn"
                  onClick={(e) => { e.stopPropagation(); closePlayer(); }}
                  title="Zavřít píseň"
                  aria-label="Zavřít píseň"
                  style={{ flexShrink: 0, height: '46px', padding: '0 16px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '14px', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <span aria-hidden="true">✕</span>
                  <span className="close-label">ZAVŘÍT</span>
                </button>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
}
