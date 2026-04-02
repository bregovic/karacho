'use client';
import { useState, useRef, useEffect, ChangeEvent } from 'react';
import Link from 'next/link';

// Původní ukázková data z prototypu (zde jen kousek, abychom to nevyplnili celé na 100 řádků)
const SAMPLE_DATA = {
  blocks: [
    {"lw":["Lalalalalalala"],"bs":14.975,"be":28.69,"w":[{"t":21.835,"i":0}]},
    {"lw":["Nebe","je","modrý","a","zlatý"],"bs":33.953,"be":36.555,"w":[{"t":34.264,"i":0},{"t":34.907,"i":1},{"t":35.124,"i":2},{"t":35.478,"i":3},{"t":35.812,"i":4}]},
    {"lw":["Bílá","sluneční","záře"],"bs":36.555,"be":39.821,"w":[{"t":37.288,"i":0},{"t":38.297,"i":1},{"t":39.083,"i":2}]},
    {"lw":["Horko","a","sváteční","šaty"],"bs":39.821,"be":42.848,"w":[{"t":40.6,"i":0},{"t":41.332,"i":1},{"t":41.576,"i":2},{"t":42.089,"i":3}]}
  ],
  dur: 228.02
};

export default function DesignerPage() {
  const [view, setView] = useState<'setup' | 'player'>('setup');
  const [audioName, setAudioName] = useState('Nahrát audio soubor');
  const [bgName, setBgName] = useState('Nahrát volitelné pozadí (GIF/PNG)');
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  
  const curLineRef = useRef<HTMLDivElement>(null);
  const prevLineRef = useRef<HTMLDivElement>(null);
  const nextLineRef = useRef<HTMLDivElement>(null);
  const pbarRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  
  const blocks = SAMPLE_DATA.blocks;
  const lastBlockRef = useRef(-1);
  const lastColoredRef = useRef(-1);

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

  const handleStart = () => {
    if (!audioRef.current) return;
    setView('player');
    audioRef.current.play();
    startTick();
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play();
    else audioRef.current.pause();
  };

  // Logika z původního vanila JS prototypu přepsaná do useRef pro extrémní výkon (bez React re-renders)
  const tick = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 1;
    
    if (pbarRef.current) pbarRef.current.style.width = `${(t / dur) * 100}%`;
    if (timeRef.current) {
      const fmt = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
      timeRef.current.textContent = `${fmt(t)} / ${fmt(dur)}`;
    }

    const ci = blocks.findIndex(b => t >= b.bs && t < b.be);
    const cb = ci >= 0 ? blocks[ci] : null;
    
    if (!cb) {
      if (prevLineRef.current) prevLineRef.current.textContent = '';
      if (curLineRef.current) curLineRef.current.innerHTML = '';
      if (nextLineRef.current) nextLineRef.current.textContent = '';
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    let nc = 0;
    for (const w of cb.w) { if (t >= w.t) nc = w.i + 1; }

    const pb = ci > 0 ? blocks[ci - 1] : null;
    const nb = ci < blocks.length - 1 ? blocks[ci + 1] : null;

    if (prevLineRef.current) prevLineRef.current.textContent = pb ? pb.lw.join(' ') : '';
    if (nextLineRef.current) nextLineRef.current.textContent = nb ? nb.lw.join(' ') : '';

    if (ci !== lastBlockRef.current) {
      if (curLineRef.current) {
        curLineRef.current.innerHTML = cb.lw.map((w, i) => `<span class="word ${i < nc ? 'on' : 'off'}" style="margin: 0 0.1em; transition: color 0.07s ease; text-shadow: 0 2px 6px rgba(0,0,0,0.95); display: inline-block; color: ${i < nc ? '#ffd700' : 'rgba(255,255,255,0.82)'}; ${i < nc ? 'text-shadow: 0 2px 6px rgba(0,0,0,0.95), 0 0 24px rgba(255,215,0,0.55);' : ''}">${w}</span>`).join(' ');
      }
      lastBlockRef.current = ci;
      lastColoredRef.current = nc;
    } else if (nc !== lastColoredRef.current) {
      if (curLineRef.current) {
        const spans = curLineRef.current.querySelectorAll('.word') as NodeListOf<HTMLSpanElement>;
        spans.forEach((s, i) => {
          s.style.color = i < nc ? '#ffd700' : 'rgba(255,255,255,0.82)';
          s.style.textShadow = i < nc ? '0 2px 6px rgba(0,0,0,0.95), 0 0 24px rgba(255,215,0,0.55)' : '0 2px 6px rgba(0,0,0,0.95)';
        });
      }
      lastColoredRef.current = nc;
    }

    rafRef.current = requestAnimationFrame(tick);
  };

  const startTick = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  if (view === 'setup') {
    return (
      <div style={{ padding: '2rem', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--color-teal)' }}>Timing Designer</h1>
          <Link href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>Zpět domů</Link>
        </header>

        <div className="glass-panel" style={{ padding: '4rem 2rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎤</div>
            <h2 style={{ color: 'var(--color-gold)' }}>Původní Karaoke Logika</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Pro test přesného časování. Nahraj audio z pc a spusť přehrávač.</p>
          </div>

          <label className="btn-secondary" style={{ width: '100%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <span>🎵 {audioName}</span>
            <input type="file" accept="audio/*" onChange={handleAudioLoad} style={{ position: 'absolute', opacity: 0, left: 0, top: 0, right: 0, bottom: 0, cursor: 'pointer' }} />
          </label>

          <button onClick={handleStart} disabled={audioName === 'Nahrát audio soubor'} className="btn-primary" style={{ width: '100%', opacity: audioName === 'Nahrát audio soubor' ? 0.5 : 1 }}>
            ▶ Spustit player
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', overflow: 'hidden' }} onClick={togglePlay}>
      <header style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10 }}>
        <Link href="/" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '14px', textDecoration: 'none' }} onClick={(e) => { e.stopPropagation(); setView('setup'); if(audioRef.current) audioRef.current.pause(); }}>
          ← Zpět
        </Link>
      </header>

      {/* Zpěvová scéna (stage) - uprostřed obrazovky */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: '2rem', gap: '2vh' }}>
        <div ref={prevLineRef} style={{ fontSize: 'clamp(14px, 3vw, 24px)', color: 'rgba(255,255,255,0.3)', fontWeight: 700, minHeight: '1.3em', textAlign: 'center' }} />
        <div ref={curLineRef} style={{ fontSize: 'clamp(28px, 6vw, 78px)', fontWeight: 900, textAlign: 'center', minHeight: '1.2em', letterSpacing: '-0.01em' }} />
        <div ref={nextLineRef} style={{ fontSize: 'clamp(14px, 3vw, 24px)', color: 'rgba(255,255,255,0.3)', fontWeight: 700, minHeight: '1.3em', textAlign: 'center' }} />
      </div>

      {/* Progress Bar a Controls */}
      <div onClick={(e) => { e.stopPropagation(); if (audioRef.current && audioRef.current.duration) { const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = (e.clientX - r.left) / r.width * audioRef.current.duration; } }} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '6px', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', zIndex: 10 }}>
        <div ref={pbarRef} style={{ height: '100%', background: 'var(--color-gold)', width: '0%', pointerEvents: 'none' }} />
      </div>

      <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 10, display: 'flex', alignItems: 'center', gap: '1rem' }} onClick={(e) => e.stopPropagation()}>
        <span ref={timeRef} style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>0:00 / 0:00</span>
        <button className="btn-secondary" onClick={togglePlay} style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  );
}
