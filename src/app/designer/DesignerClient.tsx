'use client';
import { useState, useRef, useEffect, ChangeEvent } from 'react';
import Link from 'next/link';

export default function DesignerClient({ song }: { song: any }) {
  const [view, setView] = useState<'setup' | 'editor'>('setup');
  const [audioName, setAudioName] = useState('Nahrát audio soubor');
  const [bgName, setBgName] = useState('Nahrát volitelné pozadí (GIF/PNG)');
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Data pro záznam
  const [blocks, setBlocks] = useState<any[]>([]);
  const currentBlockIdxRef = useRef(0);
  const currentWordIdxRef = useRef(-1);
  const blocksRef = useRef<any[]>([]);

  // DOM Refs pro extrémní výkon jako v původním prototypu
  const curLineRef = useRef<HTMLDivElement>(null);
  const prevLineRef = useRef<HTMLDivElement>(null);
  const nextLineRef = useRef<HTMLDivElement>(null);
  const pbarRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  // Inicializace dat na začátku
  useEffect(() => {
    if (song?.lyrics) {
      const lines = song.lyrics.split('\n').filter((l: string) => l.trim().length > 0);
      const parsedBlocks = lines.map((line: string) => ({
        lw: line.split(' ').filter((w: string) => w.trim().length > 0),
        bs: null,
        be: null,
        w: [] 
      }));
      setBlocks(parsedBlocks);
      blocksRef.current = JSON.parse(JSON.stringify(parsedBlocks));
    }
  }, [song]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
    };
  }, []);

  const handleAudioLoad = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }
    audioRef.current = new Audio(URL.createObjectURL(f));
    audioRef.current.preload = 'auto';
    setAudioName(f.name);
    
    audioRef.current.onplay = () => setIsPlaying(true);
    audioRef.current.onpause = () => setIsPlaying(false);
    audioRef.current.onended = () => setIsPlaying(false);
  };

  const handleBgLoad = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    setBgUrl(URL.createObjectURL(f));
    setBgName(f.name);
  };

  const handleStart = () => {
    if (!audioRef.current || blocks.length === 0) return;
    setView('editor');
    currentBlockIdxRef.current = 0;
    currentWordIdxRef.current = -1;
    audioRef.current.play();
    startTick();
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play();
    else audioRef.current.pause();
  };

  const tick = () => {
    if (!audioRef.current || view !== 'editor') return;
    
    const t = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 1;
    
    // UI Progress bar
    if (pbarRef.current) pbarRef.current.style.width = `${(t / dur) * 100}%`;
    if (timeRef.current) {
      const fmt = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
      timeRef.current.textContent = `${fmt(t)} / ${fmt(dur)}`;
    }

    // Extrémně rychlý DOM update pro aktuální slova, bez React Renderu
    renderCurrentState();

    rafRef.current = requestAnimationFrame(tick);
  };

  const startTick = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  const renderCurrentState = () => {
    const cIdx = currentBlockIdxRef.current;
    if (cIdx >= blocksRef.current.length) {
      if (curLineRef.current) curLineRef.current.innerHTML = '<span style="color:var(--color-gold)">🎉 HOTOVO!</span>';
      if (prevLineRef.current) prevLineRef.current.textContent = '';
      if (nextLineRef.current) nextLineRef.current.textContent = '';
      return;
    }

    const pb = cIdx > 0 ? blocksRef.current[cIdx - 1] : null;
    const cb = blocksRef.current[cIdx];
    const nb = cIdx < blocksRef.current.length - 1 ? blocksRef.current[cIdx + 1] : null;
    const wIdx = currentWordIdxRef.current;

    if (prevLineRef.current) prevLineRef.current.textContent = pb ? pb.lw.join(' ') : '';
    if (nextLineRef.current) nextLineRef.current.textContent = nb ? nb.lw.join(' ') : '';

    if (curLineRef.current) {
      curLineRef.current.innerHTML = cb.lw.map((w: string, i: number) => {
        const isOn = i <= wIdx;
        const color = isOn ? '#ffd700' : 'rgba(255,255,255,0.82)';
        const shadow = isOn ? '0 2px 6px rgba(0,0,0,0.95), 0 0 24px rgba(255,215,0,0.55)' : '0 2px 6px rgba(0,0,0,0.95)';
        return `<span style="margin: 0 0.1em; transition: color 0.07s ease, text-shadow 0.07s ease; display: inline-block; color: ${color}; text-shadow: ${shadow}">${w}</span>`;
      }).join(' ');
    }
  };

  // Záznam stisku (jako v původním prototypu akorát zapisujeme)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== 'editor' || !audioRef.current || e.code !== 'Space') return;
      e.preventDefault();

      const t = audioRef.current.currentTime;
      const cIdx = currentBlockIdxRef.current;
      const wIdx = currentWordIdxRef.current;
      
      const cb = blocksRef.current[cIdx];
      if (!cb) return;

      if (wIdx === -1) {
        cb.bs = t;
      }

      const nextWIdx = wIdx + 1;
      
      if (nextWIdx < cb.lw.length) {
        cb.w.push({ t, i: nextWIdx });
        currentWordIdxRef.current = nextWIdx;
      }

      // Konec bloku
      if (nextWIdx === cb.lw.length - 1) {
        cb.be = t + 2; 
        currentBlockIdxRef.current = cIdx + 1;
        currentWordIdxRef.current = -1;
        
        // Zapsat progress i do react stavu ať máme finální JSON
        setBlocks([...blocksRef.current]);
      }
      
      // Projistotu forced render
      renderCurrentState();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [view]);

  if (view === 'setup') {
    return (
      <div style={{ padding: '2rem', minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
        <div className="glass-panel" style={{ padding: '4rem 2rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎤</div>
            <h2 style={{ color: 'var(--text-primary)' }}>Nahrávací Studio: <span style={{ color: 'var(--color-gold)' }}>{song?.title || 'Nepřiřazeno'}</span></h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Přidali jsme přesně původní vzhled tvého playeru. Teď si zaznamenáme text do hudby.</p>
          </div>

          <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>🎵</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>{audioName}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Nahrát audio soubor (MP3, WAV)</span>
            </div>
            <input type="file" accept="audio/*" onChange={handleAudioLoad} style={{ position: 'absolute', opacity: 0, left: 0, top: 0, right: 0, bottom: 0, cursor: 'pointer' }} />
          </label>

          <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>🖼</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>{bgName}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Volitelné pozadí</span>
            </div>
            <input type="file" accept="image/*" onChange={handleBgLoad} style={{ position: 'absolute', opacity: 0, left: 0, top: 0, right: 0, bottom: 0, cursor: 'pointer' }} />
          </label>

          <button onClick={handleStart} disabled={audioName === 'Nahrát audio soubor' || blocks.length === 0} className={audioName === 'Nahrát audio soubor' ? 'btn-secondary' : 'btn-primary'} style={{ width: '100%', opacity: audioName === 'Nahrát audio soubor' ? 0.5 : 1 }}>
            ▶ Vstoupit na Stage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a14', zIndex: 9999, overflow: 'hidden', fontFamily: "-apple-system, 'Inter', sans-serif" }} onClick={togglePlay}>
      
      {/* Původní Player Design */}
      <img src={bgUrl || ''} style={{ display: bgUrl ? 'block' : 'none', position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} alt="bg" />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.45) 42%,rgba(0,0,0,.22) 100%)', zIndex: 1 }}></div>

      <header style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, display: 'flex', gap: '1rem' }}>
        <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '14px', background: 'rgba(255,255,255,0.1)' }} onClick={(e) => { e.stopPropagation(); setView('setup'); audioRef.current?.pause(); }}>
          ← Zpět
        </button>
        <div style={{ padding: '8px 16px', background: 'rgba(255,0,0,0.2)', color: 'red', borderRadius: '8px', fontWeight: 600 }}>
          Odklepávej [MEZERNÍK]
        </div>
      </header>

      {/* Stage */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6vw', gap: '2.5vh', pointerEvents: 'none' }}>
        <div ref={prevLineRef} style={{ fontSize: 'clamp(13px,3.2vw,26px)', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textAlign: 'center', minHeight: '1.3em', textShadow: '0 2px 8px rgba(0,0,0,0.9)', lineHeight: 1.3, padding: '0 2vw' }} />
        <div ref={curLineRef} style={{ fontSize: 'clamp(24px, 6vw, 78px)', fontWeight: 900, textAlign: 'center', minHeight: '1.2em', lineHeight: 1.2, padding: '0 1vw', letterSpacing: '-0.01em' }} />
        <div ref={nextLineRef} style={{ fontSize: 'clamp(13px,3.2vw,26px)', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textAlign: 'center', minHeight: '1.3em', textShadow: '0 2px 8px rgba(0,0,0,0.9)', lineHeight: 1.3, padding: '0 2vw' }} />
      </div>

      <div onClick={(e) => { e.stopPropagation(); if (audioRef.current && audioRef.current.duration) { const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = (e.clientX - r.left) / r.width * audioRef.current.duration; } }} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', zIndex: 10 }}>
        <div ref={pbarRef} style={{ height: '100%', background: 'var(--color-gold)', width: '0%', pointerEvents: 'none' }} />
      </div>

      <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
        <span ref={timeRef} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>0:00 / 0:00</span>
        <button style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }} onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>
      
      {/* Výstup generovaného formátu - skrytý z UI, ale přístupný ke kopírování po dojetí */}
      {currentBlockIdxRef.current >= blocks.length && (
        <div style={{ position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%', background: 'rgba(0,0,0,0.95)', zIndex: 100, padding: '2rem', borderRadius: '16px', overflow: 'auto' }}>
          <h2 style={{ color: 'var(--color-gold)', marginBottom: '1rem' }}>🎉 HOTOVO - JSON VYGENEROVÁN:</h2>
          <textarea readOnly value={JSON.stringify({ blocks: blocksRef.current }, null, 2)} style={{ width: '100%', height: '80%', background: '#111', color: '#0f0', padding: '1rem', fontFamily: 'monospace', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
          <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => setView('setup')}>Nahrát znovu k písni</button>
        </div>
      )}
    </div>
  );
}
