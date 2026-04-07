'use client';
import { useState, useRef, useEffect, ChangeEvent, useCallback } from 'react';
import Link from 'next/link';
import { autoAlignSong } from '@/app/admin/auto-align';

type TimingEvent = 
  | { type: 'line'; time: number; lineIdx: number }
  | { type: 'word'; time: number; lineIdx: number; wordIdx: number }
  | { type: 'countdown'; time: number };

export default function DesignerClient({ song }: { song: any }) {
  const [view, setView] = useState<'setup' | 'editor'>('setup');
  const [mode, setMode] = useState<'lines' | 'words'>('words');
  const [audioName, setAudioName] = useState('Nahrát audio soubor');
  const [renderTick, setRenderTick] = useState(0); 
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAligning, setIsAligning] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [voiceMap, setVoiceMap] = useState<Record<number, number>>({});

  const [rawText, setRawText] = useState((song?.lyrics || '') as string);

  // --- AUTO-LOAD AUDIO Z CLOUDU ---
  useEffect(() => {
    if (song?.audioUrl) {
      if (audioRef.current) audioRef.current.pause();
      const a = new Audio();
      a.crossOrigin = "anonymous";
      a.src = song.audioUrl;
      a.preload = 'auto';
      a.onplay = () => { setIsPlaying(true); forceUpdate(); };
      a.onpause = () => { setIsPlaying(false); forceUpdate(); };
      a.onended = () => { setIsPlaying(false); forceUpdate(); };
      a.onloadedmetadata = () => {
        setDuration(a.duration);
        forceUpdate();
      };
      a.ontimeupdate = () => {
        setCurrentTime(a.currentTime);
      };
      a.onerror = (e) => {
        console.error("Audio Load Error:", e);
        setAudioName("CHYBA: Soubor nelze načíst");
        forceUpdate();
      };
      audioRef.current = a;
      setAudioName(`Cloud: ${song.title}.mp3`);
    }
  }, [song?.audioUrl]);

  // --- NAČTENÍ EXISTUJÍCÍHO ČASOVÁNÍ (JSON) ---
  useEffect(() => {
    if (song?.timingData && song.timingData.blocks) {
      const newEvents: TimingEvent[] = [];
      song.timingData.blocks.forEach((b: any) => {
        newEvents.push({ type: 'line', time: b.bs, lineIdx: b.li });
        if (b.v) {
          setVoiceMap(prev => ({ ...prev, [b.li]: b.v }));
        }
        if (b.w) {
          b.w.forEach((w: any) => {
            newEvents.push({ type: 'word', time: w.t, lineIdx: b.li, wordIdx: w.i });
          });
        }
      });
      if (song.timingData.countdowns) {
        song.timingData.countdowns.forEach((t: number) => {
          newEvents.push({ type: 'countdown', time: t });
        });
      }
      eventsRef.current = newEvents.sort((a, b) => a.time - b.time);
      forceUpdate();
    }
  }, [song?.timingData]);

  const linesRef = useRef<string[][]>([]);
  const eventsRef = useRef<TimingEvent[]>([]);
  
  const curLineRef = useRef<number>(-1);
  const curWordRef = useRef<number>(-1);

  const curLineEl = useRef<HTMLDivElement>(null);
  const prevLineEl = useRef<HTMLDivElement>(null);
  const nextLineEl = useRef<HTMLDivElement>(null);
  const pbarEl = useRef<HTMLDivElement>(null);

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
    a.onloadedmetadata = () => {
      setDuration(a.duration);
      forceUpdate();
    };
    a.ontimeupdate = () => {
      setCurrentTime(a.currentTime);
    };
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
    forceUpdate();
  };

  const handleAutoAlign = async () => {
    if (!confirm("AI automaticky oklíčuje celý text. Stávající časování v timeline bude přepsáno. Pokračovat?")) return;
    setIsAligning(true);
    try {
      const res = await autoAlignSong(song.id);
      if (res.success && res.timingData) {
        // Převod blocks zpět na TimingEvents pro editor
        const newEvents: TimingEvent[] = [];
        res.timingData.blocks.forEach((b: any, li: number) => {
          newEvents.push({ type: 'line', time: b.bs, lineIdx: li });
          b.w.forEach((w: any) => {
             newEvents.push({ type: 'word', time: w.t, lineIdx: li, wordIdx: w.i });
          });
        });
        eventsRef.current = newEvents;
        alert("✨ Karacho AI úspěšně oklíčovalo písničku! Můžete si to hned pustit a případně doladit v timeline.");
        forceUpdate();
      } else {
        alert("❌ AI Chyba: " + (res.error || "Neznámý problém"));
      }
    } catch (e: any) {
      alert("❌ Chyba komunikace s AI: " + e.message);
    } finally {
      setIsAligning(false);
    }
  };

  const handleReset = () => {
    if (!confirm("Opravdu vymazat veškeré časování a začít znovu? Tato akce je nevratná.")) return;
    eventsRef.current = [];
    forceUpdate();
    alert("🔄 Časová osa byla vymazána. Můžete začít znova (AI nebo ručně).");
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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Esc pro návrat domů/zpět
    if (e.code === 'Escape') {
      window.location.href = '/admin';
      return;
    }

    if (view !== 'editor') return;
    
    // Ignorujeme klávesy pokud uživatel přepisuje uvnitř inputu
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
       return;
    }

    const handleWordTiming = (v?: number) => {
      if (!audioRef.current) return;
      const t = audioRef.current.currentTime;
      
      if (curLineRef.current < 0) {
        curLineRef.current = 0;
        eventsRef.current.push({ type: 'line', time: t, lineIdx: 0 });
      }

      if (v) {
        setVoiceMap(prev => ({ ...prev, [curLineRef.current]: v }));
      }

      const nextW = curWordRef.current + 1;
      const lineLen = linesRef.current[curLineRef.current]?.length || 0;

      if (nextW < lineLen) {
        eventsRef.current.push({ type: 'word', time: t, lineIdx: curLineRef.current, wordIdx: nextW });
        restoreState();
        forceUpdate();
      } else {
        const nextL = curLineRef.current + 1;
        if (nextL < linesRef.current.length) {
          curLineRef.current = nextL;
          curWordRef.current = 0;
          if (v) setVoiceMap(prev => ({ ...prev, [nextL]: v }));
          eventsRef.current.push({ type: 'line', time: t, lineIdx: nextL });
          eventsRef.current.push({ type: 'word', time: t, lineIdx: nextL, wordIdx: 0 });
          restoreState();
          forceUpdate();
        }
      }
    };

    if (e.key.toLowerCase() === 'a') {
      handleWordTiming(1);
      return;
    }
    if (e.key.toLowerCase() === 'd') {
      handleWordTiming(2);
      return;
    }

    if (!audioRef.current) return;
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
      handleWordTiming();
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

    if (e.code === 'KeyT') {
      e.preventDefault();
      eventsRef.current.push({ type: 'countdown', time: t });
      eventsRef.current.sort((a, b) => a.time - b.time);
      forceUpdate();
      return;
    }
  }, [view, voiceMap]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const tick = () => {
    if (!audioRef.current || view !== 'editor') return;
    
    // Automatický náhled: Pokud hrajeme a zrovna nemačkáme klávesy pro nahrávání,
    // najdeme v eventsRef co má právě teď svítit.
    const t = audioRef.current.currentTime;
    const allEvs = eventsRef.current;
    
    if (allEvs.length > 0) {
      // Najdeme poslední událost, která už nastala - ALE IGNORUJEME ODPOČTY (ty jsou pro player)
      const activeEvs = [...allEvs]
        .sort((a,b) => a.time - b.time)
        .filter(e => e.time <= t && e.type !== 'countdown');
        
      if (activeEvs.length > 0) {
        const lastEv = activeEvs[activeEvs.length - 1];
        if (lastEv.type === 'line' || lastEv.type === 'word') {
          curLineRef.current = lastEv.lineIdx;
          curWordRef.current = lastEv.type === 'word' ? lastEv.wordIdx : -1;
        }
      } else {
        curLineRef.current = -1;
        curWordRef.current = -1;
      }
    }

    renderUI();
    rafRef.current = requestAnimationFrame(tick);
  };

  const startTick = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  const fmtTime = (s: number) => {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
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
          if (nextLE.length) blockEnd = (nextLE[0] as any).time;
       }
       blocks.push({
         li, lw, bs: blockStart, be: blockEnd, v: voiceMap[li] || 1, w: wordEvs.map((w: any) => ({ t: (w as any).time, i: (w as any).wordIdx }))
       });
    }

    const countdowns = eventsRef.current
      .filter(e => e.type === 'countdown')
      .map(e => e.time);

    return { blocks, dur, countdowns };
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
  const [saveDone, setSaveDone] = useState(false);
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
      setSaveDone(true);
      // alert("Uloženo do databáze! ✅");
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
             {/* TEXTOVÁ VRSTVA */}
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '30px', padding: '0 5vw' }}>
                {/* Předchozí řádek */}
                <div ref={prevLineEl} style={{ minHeight: '60px', color: 'rgba(255,255,255,0.15)', fontSize: 'clamp(20px, 4vw, 40px)', fontWeight: 500, letterSpacing: '2px', transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' }} />
                
                {/* Aktuální řádek */}
                <div style={{ position: 'relative' }}>
                  <div style={{ 
                    position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
                    background: (voiceMap[curLineRef.current] || 1) === 1 ? 'var(--color-gold)' : '#ff4b2b',
                    color: (voiceMap[curLineRef.current] || 1) === 1 ? 'black' : 'white',
                    padding: '2px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 900,
                    letterSpacing: '1px', opacity: curLineRef.current >= 0 ? 1 : 0
                  }}>
                    {(voiceMap[curLineRef.current] || 1) === 1 ? 'HLAS 1' : 'HLAS 2'}
                  </div>
                  <div ref={curLineEl} id="cur-line" style={{ minHeight: '120px', color: 'white', fontSize: 'clamp(40px, 8vw, 85px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px', textShadow: '0 0 40px rgba(255,255,255,0.15)', transition: 'all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)', filter: isPlaying ? 'none' : 'blur(2px)', opacity: isPlaying ? 1 : 0.6 }} />
                </div>
                
                {/* Následující řádek */}
                <div ref={nextLineEl} style={{ minHeight: '60px', color: 'rgba(255,255,255,0.15)', fontSize: 'clamp(20px, 4vw, 40px)', fontWeight: 500, letterSpacing: '2px', transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' }} />
             </div>
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
                <span><b>A / D</b> Hlas 1 / 2</span>
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

          <div style={{ height: '80px', background: 'rgba(0,0,0,0.95)', borderTop: '2px solid rgba(255,255,255,0.1)', zIndex: 10, display: 'flex', flexDirection: 'column', padding: '0 3rem', boxShadow: '0 -10px 40px rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
             <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                 <button 
                    style={{ width: '56px', height: '56px', borderRadius: '50%', background: isPlaying ? 'white' : 'var(--color-gold)', border: 'none', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', transition: 'all 0.2s', transform: isPlaying ? 'scale(0.95)' : 'scale(1)', boxShadow: '0 0 20px rgba(255,215,0,0.4)' }} 
                    onClick={togglePlay}
                 >
                    {isPlaying ? '⏸' : '▶'}
                 </button>
                 <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', minWidth: '100px', fontWeight: 'bold' }}>
                   {fmtTime(currentTime)} / {fmtTime(duration)}
                 </span>
                 <div onClick={(e) => { if (audioRef.current?.duration) { const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = (e.clientX - r.left) / r.width * audioRef.current.duration; } }} style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--color-gold), #fff)', width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, borderRadius: '6px', boxShadow: '0 0 15px rgba(255,215,0,0.6)' }} />
                 </div>
             </div>
          </div>
      </div>

      <div style={{ width: '340px', background: '#0e0e16', borderLeft: '1px solid rgba(255,255,255,0.05)', zIndex: 1000, display: 'flex', flexDirection: 'column', position: 'absolute', right: 0, top: 0, bottom: 0, transform: isTimelineOpen ? 'translateX(0)' : 'translateX(340px)', transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: isTimelineOpen ? '-10px 0 30px rgba(0,0,0,0.5)' : 'none' }} onClick={e => e.stopPropagation()}>
         <div onClick={() => setIsTimelineOpen(!isTimelineOpen)} style={{ position: 'absolute', left: '-40px', top: '50%', transform: 'translateY(-50%)', width: '40px', height: '60px', background: '#0e0e16', border: '1px solid rgba(255,255,255,0.05)', borderRight: 'none', borderRadius: '10px 0 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px', color: isTimelineOpen ? 'var(--color-gold)' : 'white' }}>{isTimelineOpen ? '▶' : '◀'}</div>
         <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0, fontWeight: 600 }}>Timeline</h3>
             <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  className="btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '11px', background: 'linear-gradient(45deg, #ef4444, #991b1b)', border: 'none', color: '#fff' }} 
                  title="🔄 Vymazat veškeré časování (Reset)" 
                  onClick={handleReset}
                >
                  🔄
                </button>
                <button 
                  className="btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '11px', background: 'linear-gradient(45deg, #a855f7, #7e22ce)', border: 'none', color: '#fff', opacity: isAligning ? 0.5 : 1 }} 
                  title="🪄 AI Auto-Klíčovat (Whisper)" 
                  onClick={handleAutoAlign} 
                  disabled={isAligning}
                >
                  {isAligning ? '⌛' : '🪄'}
                </button>
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: 'var(--color-teal)' }} title="Renderovat video" onClick={() => window.open(`/renderer?songId=${song.id}`, '_blank')}>🎬</button>
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }} title="Stáhnout JSON" onClick={() => { dlSRT(JSON.stringify(generateBlocksJSON(), null, 2), "karaoke-data.json"); }}>📥</button>
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: 'var(--color-gold)' }} onClick={handleSave} disabled={saving}>{saving ? '...' : (saveDone ? '✓' : '💾')}</button>
             </div>
         </div>

         {saveDone && (
             <div style={{ padding: '1rem', background: 'rgba(74, 222, 128, 0.1)', borderBottom: '1px solid rgba(74, 222, 128, 0.2)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <a href={`/player/${song.id}`} style={{ textDecoration: 'none' }}>
                  <button className="btn-primary" style={{ width: '100%', background: 'linear-gradient(45deg, #FFD700, #FFA500)', border: 'none', color: '#000', fontWeight: 'bold', padding: '12px' }}>
                    🎤 JÍT ZPÍVAT HNED!
                  </button>
                </a>
                <div style={{ fontSize: '11px', color: '#4ade80', textAlign: 'center' }}>Vše uloženo. Přehrávač si text vykreslí live.</div>
             </div>
          )}

         <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {eventsRef.current.map((ev, idx) => {
               const isLine = ev.type === 'line';
               const isCountdown = ev.type === 'countdown';
               let text = '';
               if (isLine) {
                 const v = voiceMap[ev.lineIdx] || 1;
                 text = `[Line ${ev.lineIdx+1}] ${v === 1 ? 'G' : 'R'}`;
               }
               else if (isCountdown) text = `🚦 ODPOČET (3, 2, 1)`;
               else text = linesRef.current[ev.lineIdx]?.[ev.wordIdx] || '???';

               return (
                 <div key={idx} style={{ background: isLine ? 'rgba(255,215,0,0.05)' : (isCountdown ? 'rgba(255,75,43,0.1)' : 'rgba(255,255,255,0.02)'), padding: '6px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <input type="number" step="0.01" defaultValue={ev.time.toFixed(3)} onBlur={e => updateEvTime(idx, e.target.value)} style={{ width:'60px', background:'transparent', border:'none', color: isCountdown ? '#ff4b2b' : 'var(--color-teal)', fontSize:'11px', fontFamily:'monospace' }} />
                    {!isLine && !isCountdown ? (
                      <input type="text" defaultValue={text} onBlur={e => updateWordText(ev.lineIdx, (ev as any).wordIdx, e.target.value)} style={{ flex:1, background:'transparent', border:'none', color:'rgba(255,255,255,0.7)', fontSize:'12px' }} />
                    ) : (
                      <span style={{ fontSize:'12px', color: isCountdown ? '#ff4b2b' : 'var(--color-gold)', flex:1, fontWeight: isCountdown ? 800 : 400 }}>{text}</span>
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
