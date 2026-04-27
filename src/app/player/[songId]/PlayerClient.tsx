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
  const { joinCode, sessionData, localMode, isHost } = useSession();
  const isChordsMode = localMode === 'CHORDS' || sessionData?.sessionMode === 'CHORDS';
  const shouldSuppressAudio = (isChordsMode || isWatchMode) && !isHost;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<'ORIG' | 'INST'>(song.instrumentalUrl ? 'INST' : 'ORIG');
  const playbackModeRef = useRef(playbackMode);
  const isMutedRef = useRef(isMuted);
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
  const audioInstRef = useRef<HTMLAudioElement | null>(null);
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
  const recordHandled = useRef(false);

  const data: TimingData = (song.timingData as any) || { blocks: [], dur: 0 };
  const blocks = data.blocks || [];
  const dur = data.dur || 0;

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
    
    if (audioRef.current && song.audioUrl) audioRef.current.src = song.audioUrl;
    if (audioInstRef.current && song.instrumentalUrl) audioInstRef.current.src = song.instrumentalUrl;

    if (shouldSuppressAudio || isMuted) {
      p.muted = true;
      if (audioInstRef.current) audioInstRef.current.muted = true;
    }

    if (p instanceof HTMLAudioElement) {
       p.preload = "auto";
    }

    if (song.startTime > 0 && p.currentTime === 0) {
      p.currentTime = song.startTime;
      if (videoElRef.current) videoElRef.current.currentTime = song.startTime;
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
      lastBlock1.current = -1; lastBlock2.current = -1; lastBlockC.current = -1;
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
            if (videoElRef.current) videoElRef.current.currentTime = serverTime;
          } else if (absDiff > 0.15) {
            const rate = diff > 0 ? 1.05 : 0.95;
            currentPlayer.playbackRate = rate;
          } else {
            currentPlayer.playbackRate = 1.0;
          }

          if (s.status === 'PLAYING' && currentPlayer.paused && !isChordsMode) {
            currentPlayer.play().catch(() => {});
            audioInstRef.current?.play().catch(() => {});
          } else if (s.status === 'PAUSED' && !currentPlayer.paused) {
            currentPlayer.pause();
            audioInstRef.current?.pause();
          }
        }
      }
    }, isWatchMode ? 250 : 1000);

    if (!isChordsMode || isHost) {
      p.play().catch(() => {});
      audioInstRef.current?.play().catch(() => {});
    }

    return () => {
      clearInterval(syncInterval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      p.pause();
      audioInstRef.current?.pause();
      releaseWakeLock();
    };
  }, [song.audioUrl, song.instrumentalUrl, joinCode]);

  const cyclePlaybackMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!song.instrumentalUrl) return;
    
    const currentIndex = availableModes.indexOf(playbackMode);
    const nextIndex = (currentIndex + 1) % availableModes.length;
    const nextMode = availableModes[nextIndex] as any;
    
    setPlaybackMode(nextMode);
    playbackModeRef.current = nextMode;
  };

  useEffect(() => {
     // No longer needed, switching is handled natively by muting the two parallel audio tags in tick()
  }, [playbackMode, song.audioUrl, song.instrumentalUrl]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (audioRef.current) audioRef.current.muted = isMuted;
    if (audioInstRef.current) audioInstRef.current.muted = isMuted;
  }, [isMuted]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  const audioCtxRef = useRef<any>(null);
  const origGainRef = useRef<any>(null);
  const instGainRef = useRef<any>(null);

  const initWebAudio = () => {
     if (!audioCtxRef.current && window.AudioContext) {
         try {
             const ctx = new AudioContext();
             audioCtxRef.current = ctx;
             
             const origGain = ctx.createGain();
             const instGain = ctx.createGain();
             
             origGain.connect(ctx.destination);
             instGain.connect(ctx.destination);
             
             origGainRef.current = origGain;
             instGainRef.current = instGain;
             
             if (audioRef.current) {
                 const origSource = ctx.createMediaElementSource(audioRef.current);
                 origSource.connect(origGain);
             }
             if (audioInstRef.current) {
                 const instSource = ctx.createMediaElementSource(audioInstRef.current);
                 instSource.connect(instGain);
             }
         } catch (e) {
             console.error("WebAudio init error:", e);
         }
     }
     if (audioCtxRef.current?.state === 'suspended') {
         audioCtxRef.current.resume();
     }
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isChordsMode && !isHost) return;
    const p = audioRef.current;
    if (!p) return;
    initWebAudio();
    
    const isCurrentlyPaused = p.paused;
    const newStatus = isCurrentlyPaused ? 'PLAYING' : 'PAUSED';

    if (isCurrentlyPaused) {
      p.play().catch(() => {});
      audioInstRef.current?.play().catch(() => {});
      if (videoElRef.current) videoElRef.current.play().catch(() => {});
    } else {
      p.pause();
      audioInstRef.current?.pause();
      if (videoElRef.current) videoElRef.current.pause();
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
    if (audioInstRef.current) audioInstRef.current.pause();

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
    if (ci < 0) {
       const nextFutureIdx = blocks.findIndex(b => b.bs >= t && isBlockInVoice(b, voice));
       if (nextFutureIdx >= 0 && blocks[nextFutureIdx].bs - t < 8.0) ci = nextFutureIdx;
    }
    if (ci < 0) return null;
    const cb = blocks[ci];
    let nc = 0;
    for (const w of cb.w || []) { if (t >= w.t) nc = w.i + 1; }
    return { cb, nc, ci, next: blocks.find((b, idx) => idx > ci && isBlockInVoice(b, voice)) || null };
  };

  const getCurrentVoice = (t: number) => {
     const block = blocks.find(b => t >= b.bs && t <= b.be);
     if (!block) {
        const upcomingBlock = blocks.find(b => b.bs > t && b.bs - t < 0.5);
        if (upcomingBlock) {
           return Number(upcomingBlock.w?.[0]?.v || upcomingBlock.v || 3);
        }
        return null; 
     }
     if (block.w && block.w.length > 0) {
        for (let i = 0; i < block.w.length; i++) {
           const wStart = block.w[i].t;
           const wEnd = (i < block.w.length - 1) ? block.w[i+1].t : block.be;
           if (i === 0 && t < wStart) {
              return Number(block.w[0].v || block.v || 3);
           }
           if (t >= wStart && t < wEnd) {
              return Number(block.w[i].v || block.v || 3);
           }
        }
     }
     return Number(block.v || 3);
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

    if (audioInstRef.current && audioRef.current) {
        if (audioInstRef.current.paused && !audioRef.current.paused) {
            audioInstRef.current.play().catch(() => {});
        }
        if (audioInstRef.current.readyState >= 3 && audioRef.current.readyState >= 3) {
            const diff = Math.abs(audioInstRef.current.currentTime - audioRef.current.currentTime);
            if (diff > 0.25) {
                audioInstRef.current.currentTime = audioRef.current.currentTime;
            }
        }
    }

    if (audioRef.current) {
       let activeTrack: 'INST' | 'ORIG' = playbackModeRef.current === 'INST' ? 'INST' : 'ORIG';
       
       if (!isMutedRef.current) {
           const muteOrig = activeTrack === 'INST';
           const muteInst = activeTrack === 'ORIG';
           
           if (origGainRef.current) {
               origGainRef.current.gain.value = muteOrig ? 0 : 1;
           } else {
               audioRef.current.muted = muteOrig;
               audioRef.current.volume = muteOrig ? 0 : 1;
           }
           
           if (instGainRef.current) {
               instGainRef.current.gain.value = muteInst ? 0 : 1;
           } else if (audioInstRef.current) {
               audioInstRef.current.muted = muteInst;
               audioInstRef.current.volume = muteInst ? 0 : 1;
           }
       }
       
       const dbg = document.getElementById('debug-overlay');
       if (dbg) dbg.innerText = `Mode: ${playbackModeRef.current} | Trk: ${activeTrack} | O: ${audioRef.current.volume} | I: ${audioInstRef.current?.volume}`;
    }

    renderVoiceState(s1, visualTime, 1, curLineEl1, nextLineEl1, lastBlock1);
    renderVoiceState(s2, visualTime, 2, curLineEl2, nextLineEl2, lastBlock2);
    renderVoiceState(sC, visualTime, 3, curLineElC, nextLineElC, lastBlockC);

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

  const renderVoiceState = (state: any, t: number, voice: number, curEl: any, nextEl: any, lastRef: any) => {
    if (!state) {
      if (curEl.current) curEl.current.innerHTML = '';
      if (nextEl.current) nextEl.current.innerHTML = '';
      lastRef.current = -1;
      return;
    }
    const { cb, ci, next: nb } = state;

    if (nextEl.current) {
       if (nb) {
          nextEl.current.innerHTML = nb.lw.map((w: string, i: number) => {
             const targetV = nb.w?.[i]?.v || nb.v || 3;
             let isHidden = (voice !== 3 && voice !== targetV && targetV !== 3);
             return isHidden ? `<span style="visibility: hidden;">${w}</span>` : w;
          }).join(' ');
       } else {
          nextEl.current.innerHTML = '';
       }
    }
    
    if (ci !== lastRef.current) {
      if (curEl.current) {
        curEl.current.innerHTML = cb.lw.map((w: string, i: number) => {
          const targetV = cb.w?.[i]?.v || cb.v || 3;
          let fillColor = '#ffd700'; 
          if (targetV === 1) fillColor = '#ff4b2b'; 
          if (targetV === 2) fillColor = '#00d2ff'; 
          let isHidden = (voice !== 3 && voice !== targetV && targetV !== 3);
          const wrapStyle = isHidden ? "visibility: hidden;" : "";
          return `<span class="w-wrap" style="${wrapStyle}"><span class="w-off">${w}</span><span class="w-on" style="color: ${fillColor}; text-shadow: 0 0 15px ${fillColor}66">${w}</span></span>`;
        }).join(' ');
        
        curEl.current.classList.remove('block-new');
        void curEl.current.offsetWidth; 
        curEl.current.classList.add('block-new');
      }
      lastRef.current = ci;
    }

    if (curEl.current) {
      const firstWordT = cb.w?.[0]?.t || cb.bs;
      const realTimeToStartLine = firstWordT - (t - 0.2); 

      let lastBe = 0;
      for (let j = 0; j < ci; j++) {
        if (isBlockInVoice(blocks[j], voice) && blocks[j].be > lastBe) lastBe = blocks[j].be;
      }
      const gap = (ci === 0) ? firstWordT : (firstWordT - lastBe);
      const shouldFlash = gap >= 5.0;

      const wraps = curEl.current.querySelectorAll('.w-wrap');
      wraps.forEach((wrap: any, i: number) => {
        const off = wrap.querySelector('.w-off');
        const on = wrap.querySelector('.w-on');
        if (!on || !off) return;
        
        if (shouldFlash && realTimeToStartLine <= 1.5 && realTimeToStartLine > 0.2) {
           off.style.color = '#ff8c00'; 
           off.style.textShadow = '0 0 15px #ff8c00aa';
        } else {
           off.style.color = '';
           off.style.textShadow = '';
        }

        let p = 0;
        if (cb.w && cb.w[i]) {
           const wordStart = cb.w[i].t;
           const wordEnd = (i < cb.w.length - 1) ? cb.w[i+1].t : cb.be;
           if (t >= wordStart && t < wordEnd) p = (t - wordStart) / (wordEnd - wordStart);
           else if (t >= wordEnd) p = 1;
        } else {
           if (t >= cb.bs && t < cb.be) p = (t - cb.bs) / (cb.be - cb.bs);
           else if (t >= cb.be) p = 1;
        }
        on.style.clipPath = `inset(0 ${100 - (p * 100)}% 0 0)`;
      });
    }
  };

  const handleSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = audioRef.current;
    if (!p) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * (p.duration || 0);
    p.currentTime = t;
    if (videoElRef.current) videoElRef.current.currentTime = t;
  };

  const hasVideo = !!song.videoUrl;

  return (
    <div className="player-root" style={{ position: 'fixed', inset: 0, background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />
      <audio ref={audioInstRef} preload="auto" crossOrigin="anonymous" />
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', color: 'lime', fontSize: '10px', padding: '4px', pointerEvents: 'none' }} id="debug-overlay"></div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .player-root { --glow: rgba(255, 215, 0, 0.55); }
        .w-wrap { position: relative; display: inline-block; padding: 0; margin: 0 0.1em; }
        .w-on { position: absolute; left: 0; top: 0; height: 100%; width: 100%; clip-path: inset(0 100% 0 0); overflow: visible; white-space: nowrap; text-shadow: 1px 1px 3px rgba(0,0,0,0.9); }
        .ln-ctx { font-size: clamp(18px, 2.5vw, 30px); color: rgba(255,255,255,0.4); font-weight: 700; text-align: center; min-height: 1.4em; transition: opacity 0.3s; }
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
            ref={(el) => { if (el?.complete) setImgLoaded(true); }}
            src={song.backgroundUrl || randomBackground}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.35) saturate(1.2)', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.8s ease-in-out' }} 
            alt="background"
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
            
            <div id="voice1" style={{ position: 'absolute', top: '15%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3vh', padding: '0 5vw' }}>
              <div id="cur-line-1" ref={curLineEl1} style={{ color: 'white' }}></div>
              <div className="ln-ctx" ref={nextLineEl1} style={{ opacity: 0.4 }}></div>
            </div>
    
            <div id="voice3" style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3vh', padding: '0 5vw' }}>
              <div id="cur-line-C" ref={curLineElC} style={{ color: 'white' }}></div>
              <div className="ln-ctx" ref={nextLineElC} style={{ opacity: 0.4 }}></div>
            </div>
    
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
                <Link href="/" style={{ flexShrink: 0, height: '46px', padding: '0 16px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '14px', textDecoration: 'none', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', fontWeight: 700 }} onClick={e=>e.stopPropagation()}>ZAVŘÍT</Link>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
}
