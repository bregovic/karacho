'use client';
import { useState, useRef, useEffect, ChangeEvent } from 'react';
import Link from 'next/link';

type TimingEvent = 
  | { type: 'line'; time: number; lineIdx: number }
  | { type: 'word'; time: number; lineIdx: number; wordIdx: number };

export default function DesignerClient({ song }: { song: any }) {
  const [view, setView] = useState<'setup' | 'editor'>('setup');
  const [mode, setMode] = useState<'lines' | 'words'>('words');
  const [audioName, setAudioName] = useState('Nahrát audio soubor');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Záznam textu ze setupu
  const [rawText, setRawText] = useState((song?.lyrics || '') as string);

  // Data
  const linesRef = useRef<string[][]>([]);
  const eventsRef = useRef<TimingEvent[]>([]);
  
  // State 
  const curLineRef = useRef<number>(-1);
  const curWordRef = useRef<number>(-1);

  // DOM Refs 
  const curLineEl = useRef<HTMLDivElement>(null);
  const prevLineEl = useRef<HTMLDivElement>(null);
  const nextLineEl = useRef<HTMLDivElement>(null);
  const pbarEl = useRef<HTMLDivElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);

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
    audioRef.current.onended = () => { setIsPlaying(false); setView('setup'); };
  };

  const handleStart = () => {
    // Parsování textu před spuštěním editoru
    const parsedLines = rawText.split('\n')
      .map(l => l.trim().split(/\s+/).filter(w => w))
      .filter(l => l.length > 0);
      
    if (!audioRef.current || parsedLines.length === 0) return;
    
    linesRef.current = parsedLines;
    setView('editor');
    restoreState();
    audioRef.current.play();
    startTick();
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play();
    else audioRef.current.pause();
  };

  const restoreState = () => {
    const lineEvents = eventsRef.current.filter(e => e.type === 'line');
    if (!lineEvents.length) {
      curLineRef.current = -1;
      curWordRef.current = -1;
    } else {
      curLineRef.current = Math.max(...lineEvents.map(e => e.lineIdx));
      const wordEvents = eventsRef.current.filter(e => e.type === 'word' && e.lineIdx === curLineRef.current);
      curWordRef.current = wordEvents.length ? Math.max(...wordEvents.map(e => (e as any).wordIdx)) : -1;
    }
    renderUI();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (view !== 'editor' || !audioRef.current) return;

    const t = audioRef.current.currentTime;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
      return;
    }

    if (e.code === 'Backspace') {
      e.preventDefault();
      if (eventsRef.current.length > 0) {
        const last = eventsRef.current.pop();
        if (last) {
          audioRef.current.currentTime = Math.max(0, last.time - 0.05);
          if (audioRef.current.paused) audioRef.current.play();
          restoreState();
        }
      }
      return;
    }

    if (e.code === 'Enter') {
      e.preventDefault();
      const nextL = curLineRef.current + 1;
      if (nextL < linesRef.current.length) {
        eventsRef.current = eventsRef.current.filter(x => !(x.type === 'line' && x.lineIdx === nextL));
        eventsRef.current.push({ type: 'line', time: t, lineIdx: nextL });
        restoreState();
      }
      return;
    }

    if (mode === 'words' && (e.code === 'KeyW' || e.code === 'ArrowRight')) {
      e.preventDefault();
      if (curLineRef.current < 0) curLineRef.current = 0; 
      const lineLen = linesRef.current[curLineRef.current]?.length || 0;
      const nextW = curWordRef.current + 1;

      if (nextW < lineLen) {
        if (nextW === 0) {
           const hasLineEvent = eventsRef.current.some(x => x.type === 'line' && x.lineIdx === curLineRef.current);
           if (!hasLineEvent) {
             eventsRef.current.push({ type: 'line', time: t, lineIdx: curLineRef.current });
           }
        }
        
        eventsRef.current.push({ type: 'word', time: t, lineIdx: curLineRef.current, wordIdx: nextW });
        restoreState();
      }
      return;
    }
    
    if (e.key === '[' || e.key === ']') {
       audioRef.current.pause();
       const inc = e.key === '[' ? -1 : 1;
       const targetLine = Math.max(0, Math.min(linesRef.current.length - 1, curLineRef.current + inc));
       const ev = eventsRef.current.find(ev => ev.type === 'line' && ev.lineIdx === targetLine);
       if (ev) {
           audioRef.current.currentTime = ev.time;
       }
       curLineRef.current = targetLine;
       restoreState();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  const tick = () => {
    if (!audioRef.current || view !== 'editor') return;
    
    const t = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 1;
    
    if (pbarEl.current) pbarEl.current.style.width = `${(t / dur) * 100}%`;
    if (timeEl.current) {
      const fmt = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
      timeEl.current.textContent = `${fmt(t)} / ${fmt(dur)}`;
    }

    if (mode === 'words' && !audioRef.current.paused) {
      const lineEvents = eventsRef.current.filter(e => e.type === 'line').sort((a, b) => a.lineIdx - b.lineIdx);
      let target = -1;
      for (const ev of lineEvents) {
        if (t >= ev.time) target = ev.lineIdx;
      }
      if (target > curLineRef.current) {
         curLineRef.current = target;
         restoreState();
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  };

  const startTick = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  const renderUI = () => {
    const cl = curLineRef.current;
    const cw = curWordRef.current;
    const prev = cl > 0 ? linesRef.current[cl - 1] : null;
    const curr = cl >= 0 && cl < linesRef.current.length ? linesRef.current[cl] : null;
    const nextText = cl + 1 < linesRef.current.length ? linesRef.current[cl + 1] : null;

    if (prevLineEl.current) prevLineEl.current.textContent = prev ? prev.join(' ') : '';
    if (nextLineEl.current) nextLineEl.current.textContent = nextText ? nextText.join(' ') : '';

    if (curLineEl.current) {
      if (curr) {
        curLineEl.current.innerHTML = curr.map((w: string, i: number) => {
          const isOn = i <= cw;
          const color = isOn ? '#ffd700' : 'rgba(255,255,255,0.82)';
          const shadow = isOn ? '0 2px 6px rgba(0,0,0,0.95), 0 0 24px rgba(255,215,0,0.55)' : '0 2px 6px rgba(0,0,0,0.95)';
          return `<span style="margin: 0 0.1em; transition: color 0.07s ease, text-shadow 0.07s ease; display: inline-block; color: ${color}; text-shadow: ${shadow}">${w}</span>`;
        }).join(' ');
      } else {
        curLineEl.current.innerHTML = cl >= linesRef.current.length ? '<span style="color:var(--color-gold)">🎉 HOTOVO! Klikni Uložit JSON.</span>' : '<span style="color:var(--text-secondary)">Pauza... Stiskni MEZERNÍK.</span>';
      }
    }
  };

  if (view === 'setup') {
    return (
      <div style={{ padding: '2rem', minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
        <div className="glass-panel" style={{ padding: '4rem 2rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Studio: <span style={{ color: 'var(--color-gold)' }}>{song?.title || 'Nepřiřazeno'}</span></h2>
            
            <textarea 
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Vložte sem text písně..."
              style={{
                width: '100%', 
                height: '250px', 
                background: 'rgba(0,0,0,0.3)', 
                color: 'white', 
                border: '1px solid rgba(255,255,255,0.1)', 
                padding: '1rem', 
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right', marginTop: '8px' }}>
              Znění textu upravte podle potřeby před spuštěním časování. Pro spuštění vložte i zvukový soubor dole.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <button onClick={() => setMode('lines')} className={mode === 'lines' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1 }}>Klíčování - Celé Řádky</button>
            <button onClick={() => setMode('words')} className={mode === 'words' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1 }}>Klíčování - Jednotlivá Slova</button>
          </div>

          <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>🎵</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>{audioName}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Otevřít audio k této písni (MP3/WAV) z počítače</span>
            </div>
            <input type="file" accept="audio/*" onChange={handleAudioLoad} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
          </label>

          <button onClick={handleStart} disabled={audioName === 'Nahrát audio soubor' || rawText.trim() === ''} className={audioName === 'Nahrát audio soubor' ? 'btn-secondary' : 'btn-primary'} style={{ width: '100%', opacity: audioName === 'Nahrát audio soubor' ? 0.5 : 1 }}>
            ▶ Vstoupit a spustit klíčování
          </button>
        </div>
      </div>
    );
  }

  const generateBlocksJSON = () => {
    const blocks = [];
    const dur = audioRef.current?.duration || 0;
    
    for (let li = 0; li < linesRef.current.length; li++) {
       const lineEvents = eventsRef.current.filter(e => e.type === 'line' && e.lineIdx === li);
       const wordEvs = eventsRef.current.filter(e => e.type === 'word' && e.lineIdx === li).sort((a: any, b: any) => a.wordIdx - b.wordIdx);
       
       if (lineEvents.length === 0 && wordEvs.length === 0) continue;
       
       const lw = linesRef.current[li];
       const blockStart = lineEvents.length ? lineEvents[0].time : (wordEvs.length ? wordEvs[0].time : 0);
       let blockEnd = dur;
       
       if (li < linesRef.current.length - 1) {
          const nextLE = eventsRef.current.filter(e => e.type === 'line' && e.lineIdx === li + 1);
          if (nextLE.length) blockEnd = nextLE[0].time;
       }

       blocks.push({
         li,
         lw,
         bs: blockStart,
         be: blockEnd,
         w: wordEvs.map((w: any) => ({ t: w.time, i: w.wordIdx }))
       });
    }
    return { blocks, dur };
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a14', zIndex: 9999, overflow: 'hidden', fontFamily: "-apple-system, 'Inter', sans-serif" }} onClick={togglePlay}>
      <header style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, display: 'flex', gap: '1rem' }}>
        <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '14px', background: 'rgba(255,255,255,0.1)' }} onClick={(e) => { e.stopPropagation(); setView('setup'); audioRef.current?.pause(); }}>
          ← Zpět
        </button>
        <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', fontWeight: 600 }}>
          Mód: {mode === 'words' ? '📝 SLOVA (W/Šipka, Enter na konec řádku)' : '📏 ŘÁDKY (Enter, [, ])'} | 🔙 Backspace
        </div>
      </header>

      <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6vw', gap: '2.5vh', pointerEvents: 'none' }}>
        <div ref={prevLineEl} style={{ fontSize: 'clamp(13px,3.2vw,26px)', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textAlign: 'center', minHeight: '1.3em', textShadow: '0 2px 8px rgba(0,0,0,0.9)', lineHeight: 1.3, padding: '0 2vw' }} />
        <div ref={curLineEl} style={{ fontSize: 'clamp(24px, 6vw, 78px)', fontWeight: 900, textAlign: 'center', minHeight: '1.2em', lineHeight: 1.2, padding: '0 1vw', letterSpacing: '-0.01em' }} >
             <span style={{color: 'rgba(255,255,255,0.5)'}}>Stiskněte mezerník pro zahájení hudby</span>
        </div>
        <div ref={nextLineEl} style={{ fontSize: 'clamp(13px,3.2vw,26px)', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textAlign: 'center', minHeight: '1.3em', textShadow: '0 2px 8px rgba(0,0,0,0.9)', lineHeight: 1.3, padding: '0 2vw' }} />
      </div>

      <div onClick={(e) => { e.stopPropagation(); if (audioRef.current && audioRef.current.duration) { const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = (e.clientX - r.left) / r.width * audioRef.current.duration; } }} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', zIndex: 10 }}>
        <div ref={pbarEl} style={{ height: '100%', background: 'var(--color-gold)', width: '0%', pointerEvents: 'none' }} />
      </div>

      <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
        <span ref={timeEl} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>0:00 / 0:00</span>
        <button style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
         <button className="btn-primary" onClick={(e) => {
            e.stopPropagation();
            const data = generateBlocksJSON();
            dlSRT(JSON.stringify(data, null, 2), "karaoke-data.json");
         }}>📥 Uložit JSON (Export)</button>
      </div>
    </div>
  );
}

function dlSRT(content: string, name: string) {
  try {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    console.error(e);
  }
}
