'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { incrementPlayCount } from '@/app/admin/actions';
import { useSession } from '@/context/SessionContext';
import { getSessionStatus, updateSessionState, advanceSessionQueue } from '@/app/actions/session-actions';

interface PlayerBlock {
  lw: string[];
  bs: number;
  be: number;
  v?: number; // Hlas 1 nebo 2
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
    const isWatchMode = window.location.search.includes('mode=watch');
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.muted = isWatchMode;
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
          const s = await getSessionStatus(joinCode);
          if (s) {
            if (s.status === 'PAUSED' && !audioRef.current.paused) {
               audioRef.current.pause();
            } else if (s.status === 'PLAYING' && audioRef.current.paused && userInteracted) {
               audioRef.current.play().catch(() => {});
            }
            if (!audioRef.current.paused) {
               updateSessionState(joinCode, { currentTime: audioRef.current.currentTime, status: 'PLAYING' });
            }
          }
       } else {
          const s = await getSessionStatus(joinCode);
          if (s) {
             const diff = Math.abs(audioRef.current.currentTime - (s.currentTime || 0));
             if (diff > 1.5) {
                audioRef.current.currentTime = s.currentTime || 0;
                if (videoElRef.current) videoElRef.current.currentTime = s.currentTime || 0;
             }
             if (s.status === 'PLAYING' && audioRef.current.paused) {
                audioRef.current.play().catch(() => {});
             } else if (s.status === 'PAUSED' && !audioRef.current.paused) {
                audioRef.current.pause();
             }
          }
       }
    }, isWatchMode ? 1500 : 2000);

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

  const getVoiceState = (t: number, voice: number) => {
    const ci = blocks.findIndex(b => t >= b.bs && t < b.be && ((b.v || 3) === voice));
    if (ci < 0) return null;
    const cb = blocks[ci];
    let nc = 0;
    for (const w of cb.w || []) {
      if (t >= w.t) nc = w.i + 1;
    }
    const nextIdx = blocks.findIndex((b, idx) => idx > ci && ((b.v || 3) === voice));
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
      if (nextText) nextText.textContent = '';
      lastBlkRef.current = -1;
      return;
    }
    const { cb, ci, next: nb } = state;
    if (nextText) nextText.textContent = nb ? nb.lw.join(' ') : '';
    
    if (ci !== lastBlkRef.current) {
      if (cur) {
        let fillColor = '#ffd700'; // Center (W)
        if (voice === 1) fillColor = '#ff4b2b'; // Voice 1 (A) - Červená
        if (voice === 2) fillColor = '#00d2ff'; // Voice 2 (D) - Modrá

        cur.innerHTML = cb.lw.map((w: string, i: number) => `<span class="w-wrap"><span class="w-off">${w}</span><span class="w-on" style="color: ${fillColor}">${w}</span></span>`).join(' ');
        cur.classList.remove('block-new');
        void cur.offsetWidth; 
        cur.classList.add('block-new');
      }
      lastBlkRef.current = ci;
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
  };

  const [userInteracted, setUserInteracted] = useState(false);
  const hasVideo = !!song.videoUrl;

  const handleStartMaster = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUserInteracted(true);
    togglePlay();
  };

  return (
    <div className="player-root" style={{ 
      position: 'fixed', inset: 0, background: '#000', color: '#fff', 
      fontFamily: 'Inter, sans-serif', overflow: 'hidden' 
    }}>
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
        .w-on { position: absolute; left: 0; top: 0; width: 0%; overflow: hidden; white-space: nowrap; text-shadow: 1px 1px 3px rgba(0,0,0,0.9); }
        .ln-ctx { font-size: clamp(14px, 1.8vw, 22px); color: rgba(255,255,255,0.4); font-weight: 700; text-align: center; min-height: 1.4em; transition: opacity 0.3s; }
        #cur-line-1, #cur-line-2, #cur-line-C { font-size: clamp(24px, 5.5vw, 70px); font-weight: 900; text-align: center; min-height: 1.2em; line-height: 1.1; letter-spacing: -0.01em; }
        @keyframes blockIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .block-new { animation: blockIn 0.3s ease-out forwards; }
      `}} />

      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {hasVideo ? (
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

      <div id="stage" style={{ position: 'relative', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', pointerEvents: 'none', zIndex: 3 }}>
        <div ref={countEl} style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'absolute', top: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
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
      </div>

      <div id="ui-layer" style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
         <div id="controls" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', pointerEvents: 'auto', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
            <div className="meta-info" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                   <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{song.artist} – {song.title}</span>
                   <span ref={timeEl}>0:00 / 0:00</span>
                </div>
                <div onClick={handleSeek} style={{ height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', cursor: 'pointer', position: 'relative' }}>
                   <div ref={pbarEl} style={{ height: '100%', background: 'var(--color-gold)', width: '0%', borderRadius: '4px', boxShadow: '0 0 12px var(--glow)' }} />
                </div>
            </div>

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
