'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [renderTick, setRenderTick] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const prevLineEl = useRef<HTMLDivElement>(null);
  const curLineEl = useRef<HTMLDivElement>(null);
  const nextLineEl = useRef<HTMLDivElement>(null);
  const pbarEl = useRef<HTMLDivElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);

  const lastBlock = useRef<number>(-1);
  const lastColored = useRef<number>(-1);

  const data: TimingData = (song.timingData as any) || { blocks: [], dur: 0 };
  const blocks = data.blocks || [];
  const dur = data.dur || 0;

  useEffect(() => {
    const a = new Audio();
    a.crossOrigin = "anonymous";
    // Pokud máme instrumentál a uživatel ho chce, načteme ho, jinak originál
    a.src = (isInstrumental && song.instrumentalUrl) ? song.instrumentalUrl : song.audioUrl;
    a.preload = "auto";
    a.onplay = () => setIsPlaying(true);
    a.onpause = () => setIsPlaying(false);
    a.onended = () => { setIsPlaying(false); lastBlock.current = -1; };
    audioRef.current = a;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, [song.audioUrl, song.instrumentalUrl]);

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

    // Vizuální offset 0.5s (kompenzace reakční doby při časování)
    const visualTime = t + 0.5;

    // Progress bar
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

    if (!audioRef.current.paused) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const renderState = (state: any, t: number) => {
    const prev = prevLineEl.current;
    const cur = curLineEl.current;
    const nextText = nextLineEl.current;

    if (!state) {
      if (prev) prev.textContent = '';
      if (cur) cur.innerHTML = '';
      if (nextText) nextText.textContent = '';
      lastBlock.current = -1;
      return;
    }

    const { cb, ci, prev: pb, next: nb } = state;

    if (prev) prev.textContent = pb ? pb.lw.join(' ') : '';
    if (nextText) nextText.textContent = nb ? nb.lw.join(' ') : '';

    if (ci !== lastBlock.current) {
      // NOVÝ BLOK
      if (cur) {
        cur.innerHTML = cb.lw.map((w: string, i: number) => 
          `<span class="w-wrap"><span class="w-off">${w}</span><span class="w-on">${w}</span></span>`
        ).join(' ');

        cur.classList.remove('block-new');
        void cur.offsetWidth; 
        cur.classList.add('block-new');
      }
      lastBlock.current = ci;
    }

    // Plynulý progres slov
    if (cur) {
      const wraps = cur.querySelectorAll('.w-wrap');
      wraps.forEach((wrap: any, i: number) => {
        const on = wrap.querySelector('.w-on');
        if (!on) return;
        
        const wordStart = cb.w[i].t;
        const wordEnd = (i < cb.w.length - 1) ? cb.w[i+1].t : cb.be;
        
        let p = 0;
        if (t >= wordStart && t < wordEnd) {
          p = (t - wordStart) / (wordEnd - wordStart);
        } else if (t >= wordEnd) {
          p = 1;
        }
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

  const hasVideo = !!song.videoUrl;

  return (
    <div className="player-root" style={{ 
      position: 'fixed', inset: 0, 
      background: '#000', 
      color: '#fff', 
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden'
    }} onClick={() => togglePlay()}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .player-root { --glow: rgba(255, 215, 0, 0.55); }
        .w-wrap { position: relative; display: inline-block; padding: 0 4px; }
        .w-off { color: rgba(255,255,255,0.85); text-shadow: 0 2px 8px rgba(0,0,0,1); }
        .w-on { 
          position: absolute; left: 4px; top: 0; width: 0%; overflow: hidden; white-space: nowrap; 
          color: #ffd700; text-shadow: 0 2px 8px rgba(0,0,0,1), 0 0 24px var(--glow);
        }
        .ln-ctx { font-size: clamp(14px, 3.5vw, 28px); color: rgba(255,255,255,0.4); font-weight: 700; text-align: center; min-height: 1.4em; }
        #cur-line { font-size: clamp(28px, 6.5vw, 82px); font-weight: 900; text-align: center; min-height: 1.2em; line-height: 1.2; letter-spacing: -0.01em; }
        @keyframes blockIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .block-new { animation: blockIn 0.3s ease-out forwards; }
      `}} />

      {/* POZADÍ - VIDEO NEBO OBRÁZEK */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {hasVideo ? (
          <video 
            ref={videoElRef}
            src={song.videoUrl || ''} 
            muted playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ 
            width: '100%', height: '100%', 
            backgroundImage: `url(${song.backgroundUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop'})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.35) saturate(1.2)'
          }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)' }} />
      </div>

      {/* TEXTOVÁ VRSTVA (POUZE POKUD NEMÁME VIDEO) */}
      {!hasVideo && (
        <div id="stage" style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 10vw', gap: '3vh', pointerEvents: 'none' }}>
           <div ref={prevLineEl} className="ln-ctx" />
           <div ref={curLineEl} id="cur-line" />
           <div ref={nextLineEl} className="ln-ctx" />
        </div>
      )}

      <div id="ui-layer" style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
         <div id="controls" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', pointerEvents: 'auto', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
            <button onClick={togglePlay} style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-gold)', border: 'none', color: '#000', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               {isPlaying ? '⏸' : '▶'}
            </button>
            
            {song.instrumentalUrl && (
              <button 
                onClick={toggleTrack} 
                style={{ 
                  padding: '10px 14px', borderRadius: '12px', background: isInstrumental ? 'rgba(0,177,64,0.2)' : 'rgba(255,255,255,0.05)', 
                  border: isInstrumental ? '1px solid #00B140' : '1px solid rgba(255,255,255,0.1)',
                  color: isInstrumental ? '#00B140' : 'white', cursor: 'pointer', fontWeight: 600, fontSize: '11px', display: 'flex', gap: '8px', alignItems: 'center'
                }}
              >
                {isInstrumental ? <span>🎻 KARAOKE</span> : <span>👤 ORIGINÁL</span>}
              </button>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                   <span>{song.artist} – {song.title}</span>
                   <span ref={timeEl}>0:00 / 0:00</span>
                </div>
                <div onClick={handleSeek} style={{ height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '3px', cursor: 'pointer', position: 'relative' }}>
                   <div ref={pbarEl} style={{ height: '100%', background: 'var(--color-gold)', width: '0%', borderRadius: '3px', boxShadow: '0 0 12px var(--glow)' }} />
                </div>
            </div>
            <Link href="/admin" style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e=>e.stopPropagation()}>Zavřít</Link>
         </div>
      </div>
    </div>
  );
}
