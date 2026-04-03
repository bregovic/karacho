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
  const [renderTick, setRenderTick] = useState(0); // Pro vynucené re-rendery postranního panelu
  
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [rawText, setRawText] = useState((song?.lyrics || '') as string);

  // --- AUTO-LOAD AUDIO Z CLOUDU ---
  useEffect(() => {
    if (song?.audioUrl) {
      if (audioRef.current) audioRef.current.pause();
      const a = new Audio();
      a.crossOrigin = "anonymous"; // ZÁSADNÍ FIX: povolení pro přehrávání z jiné domény
      a.src = song.audioUrl;
      a.preload = 'auto';
      a.onplay = () => { setIsPlaying(true); forceUpdate(); };
      a.onpause = () => { setIsPlaying(false); forceUpdate(); };
      a.onended = () => { setIsPlaying(false); forceUpdate(); };
      // Zásadní fix: počkáme na metadata, aby UI vědělo délku
      a.onloadedmetadata = () => forceUpdate();
      a.onerror = (e) => {
        console.error("Audio Load Error:", e);
        setAudioName("CHYBA: Soubor nelze načíst (zkontrolujte CORS)");
        forceUpdate();
      };
      audioRef.current = a;
      setAudioName(`Cloud: ${song.title}.mp3`);
    }
  }, [song?.audioUrl]);

  const linesRef = useRef<string[][]>([]);
  const eventsRef = useRef<TimingEvent[]>([]);
  
  const curLineRef = useRef<number>(-1);
  const curWordRef = useRef<number>(-1);

  const curLineEl = useRef<HTMLDivElement>(null);
  const prevLineEl = useRef<HTMLDivElement>(null);
  const nextLineEl = useRef<HTMLDivElement>(null);
  const pbarEl = useRef<HTMLDivElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);

  const forceUpdate = () => setRenderTick(t => t + 1);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Pokud máme v paměti local Blob URL, uvolníme ji
      if (audioRef.current && audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  const handleAudioLoad = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
    }
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.src = URL.createObjectURL(f);
    a.preload = 'auto';
    a.onplay = () => { setIsPlaying(true); forceUpdate(); };
    a.onpause = () => { setIsPlaying(false); forceUpdate(); };
    a.onloadedmetadata = () => forceUpdate();
    audioRef.current = a;
    setAudioName(f.name);
  };

  const handleStart = () => {
    const parsedLines = rawText.split('\n')
      .map(l => l.trim().split(/\s+/).filter(w => w))
      .filter(l => l.length > 0);
      
    if (!audioRef.current || parsedLines.length === 0) return;
    
    linesRef.current = parsedLines;
    setView('editor');
    restoreState();
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
    // Esc pro návrat domů/zpět
    if (e.code === 'Escape') {
      window.location.href = '/admin';
      return;
    }

    if (view !== 'editor' || !audioRef.current) return;
    
    // Ignorujeme klávesy pokud uživatel přepisuje uvnitř inputu
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
       return;
    }

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
          forceUpdate();
        }
      }
      return;
    }

    if (e.code === 'Enter') {
      e.preventDefault();
      const nextL = curLineRef.current + 1;
      if (nextL < linesRef.current.length) {
        // Pokud do této linky ještě nebylo vstoupeno, označíme její začátek
        eventsRef.current.push({ type: 'line', time: t, lineIdx: nextL });
        curLineRef.current = nextL;
        curWordRef.current = -1;
        restoreState();
        forceUpdate();
      }
      return;
    }

    if (e.code === 'KeyW' || e.code === 'ArrowRight') {
      e.preventDefault();
      if (curLineRef.current < 0) {
        // Pokud jsme ještě nezačali, první W označí začátek první linky
        curLineRef.current = 0;
        eventsRef.current.push({ type: 'line', time: t, lineIdx: 0 });
      }

      const nextW = curWordRef.current + 1;
      const lineLen = linesRef.current[curLineRef.current]?.length || 0;

      if (nextW < lineLen) {
        eventsRef.current.push({ type: 'word', time: t, lineIdx: curLineRef.current, wordIdx: nextW });
        restoreState();
        forceUpdate();
      } else {
        // PO POSLEDNÍM SLOVĚ SKOČÍME NA DALŠÍ ŘÁDEK (Enter chování)
        const nextL = curLineRef.current + 1;
        if (nextL < linesRef.current.length) {
          curLineRef.current = nextL;
          curWordRef.current = 0;
          eventsRef.current.push({ type: 'line', time: t, lineIdx: nextL });
          eventsRef.current.push({ type: 'word', time: t, lineIdx: nextL, wordIdx: 0 });
          restoreState();
          forceUpdate();
        }
      }
      return;
    }

    if (e.key === '[' || e.key === ']') {
       e.preventDefault();
       audioRef.current.pause();
       const inc = e.key === '[' ? -1 : 1;
       const targetLine = Math.max(0, Math.min(linesRef.current.length - 1, curLineRef.current + inc));
       const ev = eventsRef.current.find(ev => ev.type === 'line' && ev.lineIdx === targetLine);
       if (ev) {
           audioRef.current.currentTime = ev.time;
       }
       curLineRef.current = targetLine;
       restoreState();
       forceUpdate();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        curLineEl.current.innerHTML = cl >= linesRef.current.length ? '<span style="color:var(--color-gold)">🎉 HOTOVO! Klikni Export.</span>' : '<span style="color:rgba(255,255,255,0.4); font-size: 0.5em;">Stiskněte MEZERNÍK...</span>';
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
                width: '100%', height: '250px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.5'
              }}
            />
          </div>
          <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>🎵</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>{audioName}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Změnit audio...</span>
            </div>
            <input type="file" accept="audio/*" onChange={handleAudioLoad} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
          </label>
          <button onClick={handleStart} disabled={rawText.trim() === ''} className={rawText.trim() === '' ? 'btn-secondary' : 'btn-primary'} style={{ width: '100%' }}>
            ▶ Vstoupit do Studia
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
         li, lw, bs: blockStart, be: blockEnd, w: wordEvs.map((w: any) => ({ t: w.time, i: w.wordIdx }))
       });
    }
    return { blocks, dur };
  };

  const deleteEv = (idx: number) => {
     eventsRef.current.splice(idx, 1);
     restoreState();
     forceUpdate();
  };

  const updateEvTime = (idx: number, newTime: string) => {
     const t = parseFloat(newTime);
     if (!isNaN(t)) {
        eventsRef.current[idx].time = t;
        restoreState();
        forceUpdate();
     }
  };

  const updateWordText = (lineIdx: number, wordIdx: number, newText: string) => {
    linesRef.current[lineIdx][wordIdx] = newText;
    forceUpdate();
  };

  const [saving, setSaving] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const handleSave = async () => {
    if (!song?.id) return;
    setSaving(true);
    try {
      const data = generateBlocksJSON();
      await fetch(`/api/songs/${song.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timingData: data, lyrics: rawText }),
      });
    } catch (e) {
      console.error(e);
      alert("Chyba sítě.");
    } finally {
      setSaving(false);
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
                width: '100%', height: '250px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.5'
              }}
            />
          </div>
          <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>🎵</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>{audioName}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Změnit audio...</span>
            </div>
            <input type="file" accept="audio/*" onChange={handleAudioLoad} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
          </label>
          <button onClick={handleStart} disabled={rawText.trim() === ''} className={rawText.trim() === '' ? 'btn-secondary' : 'btn-primary'} style={{ width: '100%' }}>
            ▶ Vstoupit do Studia
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a14', zIndex: 9999, overflow: 'hidden', display: 'flex' }} onClick={() => { if(!isPlaying) togglePlay(); }}>
      
      {/* LEVÁ ČÁST - STAGE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <header style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, display: 'flex', gap: '1rem' }}>
            <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={(e) => { e.stopPropagation(); setView('setup'); audioRef.current?.pause(); }}>
              ← Zpět
            </button>
          </header>

          <div style={{ flex: 1, position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6vw', gap: '2.5vh', pointerEvents: 'none' }}>
            <div ref={prevLineEl} className="ln-ctx" />
            <div ref={curLineEl} id="cur-line" />
            <div ref={nextLineEl} className="ln-ctx" />
          </div>

          <style dangerouslySetInnerHTML={{ __html: `
             @media (max-width: 768px) { .desktop-legend { display: none !important; } .mobile-main-controls { display: flex !important; } }
             .mobile-main-controls { display: none; }
          `}} />
          
          <div className="desktop-legend" style={{ textAlign: 'center', width: '100%', pointerEvents: 'none', marginBottom: '80px' }}>
             <div style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', padding: '6px 16px', borderRadius: '20px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'inline-flex', gap: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span><b>W / Šipka →</b> Slovo</span>
                <span><b>Enter</b> Blok</span>
                <span><b>Space</b> Pauza</span>
                <span><b>Backspace</b> Zpět</span>
             </div>
          </div>

          {/* MOBILNÍ OVLÁDÁNÍ */}
          <div className="mobile-main-controls" style={{ position: 'absolute', bottom: '120px', left: 0, right: 0, justifyContent: 'center', alignItems: 'center', gap: '25px', zIndex: 100, pointerEvents: 'auto' }}>
              <button onClick={(e) => { e.stopPropagation(); handleKeyDown({ code: 'Enter', preventDefault: () => {} } as any); }} style={{ width: '65px', height: '65px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '24px', backdropFilter: 'blur(10px)' }}>📏</button>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 {!isPlaying && (
                    <div style={{ position: 'absolute', bottom: '90px', display: 'flex', background: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '15px', gap: '15px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                       <button onClick={(e) => { e.stopPropagation(); handleKeyDown({ code: 'Backspace', preventDefault: () => {} } as any); }} style={{ background: 'none', border: 'none', fontSize: '20px' }}>🔙</button>
                       <button onClick={(e) => { e.stopPropagation(); handleKeyDown({ key: '[', preventDefault: () => {} } as any); }} style={{ background: 'none', border: 'none', fontSize: '20px' }}>◀</button>
                       <button onClick={(e) => { e.stopPropagation(); handleKeyDown({ key: ']', preventDefault: () => {} } as any); }} style={{ background: 'none', border: 'none', fontSize: '20px' }}>▶</button>
                    </div>
                 )}
                 <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} style={{ width: '85px', height: '85px', borderRadius: '50%', background: isPlaying ? 'var(--color-gold)' : 'rgba(255,255,255,0.15)', border: 'none', fontSize: '32px', boxShadow: isPlaying ? '0 0 30px rgba(255,215,0,0.3)' : 'none' }}>{isPlaying ? '⏸' : '▶'}</button>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleKeyDown({ code: 'KeyW', preventDefault: () => {} } as any); }} style={{ width: '65px', height: '65px', borderRadius: '50%', background: 'rgba(0,255,180,0.15)', border: '2px solid rgba(0,255,180,0.3)', color: 'white', fontSize: '24px', backdropFilter: 'blur(10px)' }}>✨</button>
          </div>

          <div style={{ height: '70px', background: 'rgba(0,0,0,0.9)', borderTop: '1px solid rgba(255,255,255,0.05)', zIndex: 10, display: 'flex', flexDirection: 'column', padding: '0 2rem' }} onClick={e => e.stopPropagation()}>
             <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <button style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
                 <span ref={timeEl} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', minWidth: '90px' }}>0:00 / 0:00</span>
                 <div onClick={(e) => { if (audioRef.current?.duration) { const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = (e.clientX - r.left) / r.width * audioRef.current.duration; } }} style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', position: 'relative' }}>
                    <div ref={pbarEl} style={{ height: '100%', background: 'var(--color-gold)', width: '0%', borderRadius: '4px' }} />
                 </div>
             </div>
          </div>
      </div>

      <div style={{ width: '340px', background: '#0e0e16', borderLeft: '1px solid rgba(255,255,255,0.05)', zIndex: 1000, display: 'flex', flexDirection: 'column', position: 'absolute', right: 0, top: 0, bottom: 0, transform: isTimelineOpen ? 'translateX(0)' : 'translateX(340px)', transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: isTimelineOpen ? '-10px 0 30px rgba(0,0,0,0.5)' : 'none' }} onClick={e => e.stopPropagation()}>
         <div onClick={() => setIsTimelineOpen(!isTimelineOpen)} style={{ position: 'absolute', left: '-40px', top: '50%', transform: 'translateY(-50%)', width: '40px', height: '60px', background: '#0e0e16', border: '1px solid rgba(255,255,255,0.05)', borderRight: 'none', borderRadius: '10px 0 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px', color: isTimelineOpen ? 'var(--color-gold)' : 'white' }}>{isTimelineOpen ? '▶' : '◀'}</div>
         <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0, fontWeight: 600 }}>Timeline</h3>
            <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => { dlSRT(JSON.stringify(generateBlocksJSON(), null, 2), "karaoke-data.json"); }}>📥</button>
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: 'var(--color-teal)' }} onClick={handleSave} disabled={saving}>{saving ? '...' : '💾'}</button>
            </div>
         </div>
         <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {eventsRef.current.map((ev, idx) => {
               const isLine = ev.type === 'line';
               const text = isLine ? `[Line ${ev.lineIdx+1}]` : linesRef.current[ev.lineIdx][ev.wordIdx];
               return (
                 <div key={idx} style={{ background: isLine ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <input type="number" step="0.01" defaultValue={ev.time.toFixed(3)} onBlur={e => updateEvTime(idx, e.target.value)} style={{ width:'60px', background:'transparent', border:'none', color:'var(--color-teal)', fontSize:'11px', fontFamily:'monospace' }} />
                    {!isLine ? (
                      <input type="text" defaultValue={text} onBlur={e => updateWordText(ev.lineIdx, (ev as any).wordIdx, e.target.value)} style={{ flex:1, background:'transparent', border:'none', color:'rgba(255,255,255,0.7)', fontSize:'12px' }} />
                    ) : (
                      <span style={{ fontSize:'12px', color: 'var(--color-gold)', flex:1 }}>{text}</span>
                    )}
                    <button onClick={() => deleteEv(idx)} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.2)', cursor:'pointer', fontSize:'12px' }}>✕</button>
                 </div>
               );
            })}
         </div>
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
