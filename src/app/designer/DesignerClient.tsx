'use client';
import { useState, useRef, useEffect, ChangeEvent, useCallback } from 'react';
import Link from 'next/link';
import { autoAlignSong } from '@/app/admin/auto-align';

type TimingEvent = 
  | { type: 'line'; time: number; lineIdx: number }
  | { type: 'word'; time: number; lineIdx: number; wordIdx: number }
  | { type: 'countdown'; time: number }
  | { type: 'lineEnd'; time: number; lineIdx: number };

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
  const [chordsText, setChordsText] = useState((song?.chords || '') as string);

  const [chordCharsPerLine, setChordCharsPerLine] = useState(40);
  const [songbookPage, setSongbookPage] = useState(0);
  const [showSongbookPreview, setShowSongbookPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'lyrics' | 'chords'>('lyrics');

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
        setVoiceMap(prev => ({ ...prev, [b.li]: b.v || 3 }));
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

  const forceLineEndAndAdvanceToNext = (autoKeyFirstWord: boolean = false) => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    
    // 1. Ukončíme aktuální řádek
    const lineEndEv = eventsRef.current.find(e => e.type === 'lineEnd' && e.lineIdx === curLineRef.current);
    if (!lineEndEv) {
       eventsRef.current.push({ type: 'lineEnd', time: t, lineIdx: curLineRef.current });
    }
    
    // 2. Aktivujeme další řádek (pokud existuje)
    const nextL = curLineRef.current + 1;
    if (nextL <= linesRef.current.length) { // Změna < na <= pro umožnění ukončení
       eventsRef.current.push({ type: 'line', time: t, lineIdx: nextL });
       
       if (autoKeyFirstWord && nextL < linesRef.current.length) {
          eventsRef.current.push({ type: 'word', time: t, lineIdx: nextL, wordIdx: 0 });
          curLineRef.current = nextL;
          curWordRef.current = 0;
       } else {
          curLineRef.current = nextL;
          curWordRef.current = -1; 
       }
    } 
    
    restoreState();
    forceUpdate();
  };

  const handleWordTiming = (v?: number) => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    
    if (curLineRef.current < 0) {
      curLineRef.current = 0;
      eventsRef.current.push({ type: 'line', time: t, lineIdx: 0 });
    }

    const targetVoice = v !== undefined ? v : 3;
    setVoiceMap(prev => ({ ...prev, [curLineRef.current]: targetVoice }));

    const nextW = curWordRef.current + 1;
    const lineLen = linesRef.current[curLineRef.current]?.length || 0;

    if (nextW < lineLen) {
      eventsRef.current.push({ type: 'word', time: t, lineIdx: curLineRef.current, wordIdx: nextW });
      restoreState();
      forceUpdate();
    } else {
      forceLineEndAndAdvanceToNext(true); // <--- Tady u W chceme auto-key prvního slova
    }
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

    if (e.key.toLowerCase() === 'a') {
      handleWordTiming(1);
      return;
    }
    if (e.key.toLowerCase() === 'd') {
      handleWordTiming(2);
      return;
    }
    if (e.key.toLowerCase() === 's') {
      handleWordTiming(3);
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
      forceLineEndAndAdvanceToNext();
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
          // PŘIDÁNA MEZERA ZA SLOVO (znak &nbsp; nebo mezera)
          return `<span style="transition: color 0.07s ease, text-shadow 0.07s ease; display: inline-block; color: ${color}; text-shadow: ${shadow}">${w}</span>&nbsp;`;
        }).join('');
      } else {
        curLineEl.current.innerHTML = cl >= linesRef.current.length 
          ? '<span style="color:var(--color-gold)">🎉 HOTOVO! Klikni Export.</span>' 
          : '<span style="color:rgba(255,255,255,0.4); font-size: 0.5em;">Stiskněte MEZERNÍK...</span>';
      }
    }
  };

  const generateBlocksJSON = () => {
    const blocks = [];
    const dur = audioRef.current?.duration || 0;
    
    // Procházíme o jeden index více, abychom podchytili i ten finální prázdný blok
    for (let li = 0; li <= linesRef.current.length; li++) {
       const lineEvents = eventsRef.current.filter(e => e.type === 'line' && e.lineIdx === li);
       const wordEvs = eventsRef.current.filter(e => e.type === 'word' && e.lineIdx === li).sort((a: any, b: any) => a.wordIdx - b.wordIdx);
       const lineEndEv = eventsRef.current.find(e => e.type === 'lineEnd' && e.lineIdx === li);
       
       if (lineEvents.length === 0 && wordEvs.length === 0) continue;
       
       const lw = linesRef.current[li] || [];
       const blockStart = lineEvents.length ? lineEvents[0].time : (wordEvs.length ? wordEvs[0].time : 0);
       let blockEnd = dur;
       if (lineEndEv) {
          blockEnd = lineEndEv.time;
       } else if (li < linesRef.current.length) {
          const nextLE = eventsRef.current.filter(e => e.type === 'line' && e.lineIdx === li + 1);
          if (nextLE.length) blockEnd = nextLE[0].time;
       }
       
       blocks.push({
          li, lw, bs: blockStart, be: blockEnd, v: voiceMap[li] || 3, w: wordEvs.map((w: any) => ({ t: (w as any).time, i: (w as any).wordIdx }))
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
        body: JSON.stringify({ timingData: data, lyrics: rawText, chords: chordsText }),
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

  const handlePublish = async () => {
    if (!song?.id) return;
    setSaving(true);
    try {
      const data = generateBlocksJSON();
      await fetch(`/api/songs/${song.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timingData: data, lyrics: rawText, chords: chordsText, state: 'ACTIVE' }),
      });
      window.location.href = '/admin';
    } catch (e) {
      console.error(e);
      alert("Chyba při publikaci.");
    } finally {
      setSaving(false);
    }
  };

  if (view === 'setup') {
    return (
      <div style={{ padding: '2rem', minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
        <div className="glass-panel" style={{ padding: '4rem 2rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          
          <div style={{ textAlign: 'center', width: '100%' }}>
            
            {/* PŘEPÍNAČ EDITORŮ */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
               <button onClick={() => setViewMode('lyrics')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 800, cursor: 'pointer', background: viewMode === 'lyrics' ? 'var(--color-gold)' : 'transparent', color: viewMode === 'lyrics' ? '#000' : 'rgba(255,255,255,0.4)' }}>🎤 TEXT (Karaoke)</button>
               <button onClick={() => setViewMode('chords')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 800, cursor: 'pointer', background: viewMode === 'chords' ? 'var(--color-gold)' : 'transparent', color: viewMode === 'chords' ? '#000' : 'rgba(255,255,255,0.4)' }}>🎸 AKORDY (Zpěvník)</button>
            </div>

            <div style={{ textAlign: 'left', width: '100%', marginBottom: '1rem' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                 {viewMode === 'lyrics' ? 'Editor textu & Progress:' : 'Editor akordů (Zdroj pro zpěvník):'}
              </label>
              {viewMode === 'lyrics' ? (
                <div 
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => setRawText(e.currentTarget.innerText)}
                  style={{
                    width: '100%', minHeight: '250px', maxHeight: '400px', overflowY: 'auto',
                    background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,180,0,0.3)', 
                    padding: '1.5rem', borderRadius: '12px', fontFamily: 'monospace', fontSize: '15px', 
                    lineHeight: '1.8', outline: 'none', whiteSpace: 'pre-wrap'
                  }}
                >
                  {rawText.split('\n').map((lineText, li) => {
                    const words = lineText.trim().split(/\s+/).filter(w => w);
                    if (words.length === 0) return <div key={li}><br/></div>;
                    
                    return (
                      <div key={li} style={{ marginBottom: '0.2rem' }}>
                        {words.map((word, wi) => {
                          const hasTiming = eventsRef.current.some(e => e.type === 'word' && e.lineIdx === li && e.wordIdx === wi);
                          return (
                            <span key={wi}>
                              <span style={{ 
                                color: hasTiming ? 'var(--color-gold)' : 'rgba(255,255,255,0.4)',
                                fontWeight: hasTiming ? 900 : 400,
                                textShadow: hasTiming ? '0 0 10px rgba(255,215,0,0.2)' : 'none'
                              }}>
                                {word}
                              </span>
                              {' '}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <textarea 
                   value={chordsText}
                   onChange={(e) => setChordsText(e.target.value)}
                   spellCheck={false}
                   style={{
                      width: '100%', minHeight: '250px', maxHeight: '400px',
                      background: 'rgba(0,0,0,0.3)', color: 'var(--color-gold)', border: '1px solid rgba(255,180,0,0.3)', 
                      padding: '1.5rem', borderRadius: '12px', fontFamily: 'monospace', fontSize: '14px', 
                      lineHeight: '1.4', outline: 'none', whiteSpace: 'pre', resize: 'vertical'
                   }}
                />
              )}
            </div>
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

          {/* SONGBOOK PREVIEW SECTION */}
          <div style={{ width: '100%', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--color-gold)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>📖 Náhled Zpěvníku (Akordy)</h3>
                <button 
                  onClick={() => setShowSongbookPreview(!showSongbookPreview)} 
                  className="btn-secondary" 
                  style={{ padding: '4px 12px', fontSize: '11px' }}
                >
                  {showSongbookPreview ? 'Skrýt' : 'Zobrazit náhled'}
                </button>
             </div>

             {showSongbookPreview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                   {/* Nastavení šířky */}
                   <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Znaků na řádek:</span>
                      <input 
                        type="range" min="20" max="80" value={chordCharsPerLine} 
                        onChange={(e) => setChordCharsPerLine(parseInt(e.target.value))} 
                        style={{ flex: 1, accentColor: 'var(--color-gold)' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-gold)', width: '30px' }}>{chordCharsPerLine}</span>
                   </div>

                   {/* Simulátor Stránky */}
                   <div 
                      onClick={() => setSongbookPage(p => p + 1)}
                      style={{ 
                        aspectRatio: '1/1.4', width: '100%', background: '#fff', color: '#000', 
                        borderRadius: '4px', padding: '2rem', position: 'relative', cursor: 'pointer',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
                      }}
                   >
                      {songbookPage === 0 ? (
                         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 900, textTransform: 'uppercase' }}>{song.title}</h1>
                            <h2 style={{ fontSize: '1.5rem', color: '#666', fontWeight: 400 }}>{song.artist}</h2>
                            <div style={{ position: 'absolute', bottom: '2rem', fontSize: '12px', color: '#999', textTransform: 'uppercase', letterSpacing: '2px' }}>Karacho Songbook • Strana 1</div>
                         </div>
                      ) : (
                         <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.6', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                               <span style={{ fontWeight: 800 }}>{song.title}</span>
                               <span style={{ color: '#999' }}>{songbookPage + 1}</span>
                            </div>
                            <pre style={{ 
                               whiteSpace: 'pre-wrap', 
                               wordBreak: 'break-word',
                               fontSize: 'clamp(10px, 2vw, 14px)',
                               width: `${chordCharsPerLine}ch`,
                               maxWidth: '100%',
                               margin: '0 auto'
                            }}>
                               {/* Logika rozdělení do stránek */}
                               {chordsText.split('\n').slice((songbookPage - 1) * 30, songbookPage * 30).join('\n')}
                            </pre>
                            {chordsText.split('\n').length <= songbookPage * 30 && (
                               <div style={{ textAlign: 'center', color: '#ccc', marginTop: '1rem', fontStyle: 'italic', fontSize: '12px' }}>— Konec písně —</div>
                            )}
                         </div>
                      )}
                      
                      {/* Navigační tečky */}
                      <div style={{ position: 'absolute', bottom: '10px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '5px' }}>
                         {[...Array(Math.ceil(chordsText.split('\n').length / 25) + 1)].map((_, i) => (
                            <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === songbookPage ? 'var(--color-gold)' : '#ddd' }} />
                         ))}
                      </div>
                   </div>
                   
                   <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                      <button onClick={(e) => { e.stopPropagation(); setSongbookPage(p => Math.max(0, p - 1)); }} className="btn-secondary" style={{ padding: '6px 20px' }}>Předchozí</button>
                      <button onClick={(e) => { e.stopPropagation(); setSongbookPage(p => p + 1); }} className="btn-secondary" style={{ padding: '6px 20px' }}>Další</button>
                      <button onClick={(e) => { e.stopPropagation(); setSongbookPage(0); }} className="btn-secondary" style={{ padding: '6px 12px' }}>Re-start</button>
                   </div>
                </div>
             )}
          </div>
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
                <div ref={curLineEl} id="cur-line" style={{ minHeight: '120px', color: 'white', fontSize: 'clamp(40px, 8vw, 85px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px', textShadow: '0 0 40px rgba(255,255,255,0.15)', transition: 'all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)', filter: isPlaying ? 'none' : 'blur(2px)', opacity: isPlaying ? 1 : 0.6 }} />
                
                {/* Následující řádek */}
                <div ref={nextLineEl} style={{ minHeight: '60px', color: 'rgba(255,255,255,0.15)', fontSize: 'clamp(20px, 4vw, 40px)', fontWeight: 500, letterSpacing: '2px', transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)' }} />
             </div>

             {/* MOBILNÍ DOTYKOVÁ PLOCHA (ŤUKAT SEM) */}
             <div 
               onClick={(e) => { e.stopPropagation(); if(isPlaying) handleWordTiming(); }}
               style={{ 
                 position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'auto',
                 display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '20vh'
               }}
             >
                <div className="mobile-tap-hint" style={{ padding: '20px 40px', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: '50px', color: 'var(--color-gold)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.1em', backdropFilter: 'blur(10px)', opacity: isPlaying ? 0.3 : 0 }}>
                   ŤUKEJ SEM DO RYTMU
                </div>
             </div>
          </div>

          <style dangerouslySetInnerHTML={{ __html: `
             @media (max-width: 768px) { 
               .desktop-legend { display: none !important; } 
               .mobile-main-controls { display: flex !important; } 
               .mobile-tap-hint { display: block !important; }
             }
             @media (min-width: 1025px) {
               .mobile-only { display: none !important; }
             }
             .mobile-main-controls { display: none; }
             .mobile-tap-hint { display: none; }
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

          <div className="mobile-main-controls" style={{ position: 'absolute', bottom: '100px', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', zIndex: 100, pointerEvents: 'none' }}>
              {/* PROGRESS BAR - Ponecháme viditelný pro všechny (na PC pro klikání myší) */}
              <div style={{ width: '100vw', padding: '0 20px', boxSizing: 'border-box', pointerEvents: 'auto' }}>
                  <div 
                    onClick={(e) => { if (audioRef.current?.duration) { const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = (e.clientX - r.left) / r.width * audioRef.current.duration; } }} 
                    style={{ width: '100%', height: '35px', background: 'rgba(255,255,255,0.05)', borderRadius: '18px', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}
                  >
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--color-gold), #fff)', width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, transition: 'width 0.1s linear', boxShadow: '0 0 20px rgba(255,215,0,0.5)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontFamily: 'monospace' }}>
                     <span>{fmtTime(currentTime)}</span>
                     <span>{fmtTime(duration)}</span>
                  </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '25px', pointerEvents: 'auto' }}>
                <button 
                  className="mobile-only"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (eventsRef.current.length > 0) { 
                      const last = eventsRef.current.pop(); 
                      if (last && audioRef.current) {
                        audioRef.current.currentTime = Math.max(0, last.time - 0.1);
                        if (audioRef.current.paused) audioRef.current.play();
                      }
                      restoreState(); 
                      forceUpdate(); 
                    } 
                  }} 
                  style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', border: '2px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', fontSize: '28px', backdropFilter: 'blur(10px)' }}
                  title="Zpět (Backspace)"
                >
                  ✕
                </button>
                
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} style={{ width: '100px', height: '100px', borderRadius: '50%', background: isPlaying ? 'var(--color-gold)' : 'rgba(255,255,255,0.15)', border: 'none', fontSize: '42px', boxShadow: isPlaying ? '0 0 40px rgba(255,215,0,0.4)' : 'none', transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                </div>

                <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); if(isPlaying) handleWordTiming(); }} 
                    style={{ width: '85px', height: '85px', borderRadius: '50%', background: 'rgba(0,255,180,0.2)', border: '3px solid rgba(0,255,180,0.5)', color: 'white', fontSize: '32px', backdropFilter: 'blur(10px)', boxShadow: '0 0 30px rgba(0,255,180,0.2)' }}
                  >
                    ✨
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); if(isPlaying) forceLineEndAndAdvanceToNext(); }} 
                    style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.3)', color: 'white', fontSize: '20px', backdropFilter: 'blur(10px)' }}
                    title="Další řádek (Enter)"
                  >
                    📏
                  </button>
                </div>
              </div>
          </div>

          <div style={{ height: '70px', background: 'rgba(0,0,0,0.98)', borderTop: '2px solid rgba(255,255,255,0.1)', zIndex: 10, display: 'flex', alignItems: 'center', padding: '0 2rem', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
             <button 
               className="btn-primary" 
               style={{ padding: '10px 40px', background: 'var(--color-gold)', color: '#000', fontWeight: 900, borderRadius: '50px', fontSize: '14px' }} 
               onClick={handleSave} 
               disabled={saving}
             >
               {saving ? 'UKLÁDÁM...' : (saveDone ? '✓ ULOŽENO' : '💾 ULOŽIT ROZDĚLANÉ')}
             </button>
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
                <button 
                  className="btn-primary" 
                  onClick={handlePublish}
                  disabled={saving}
                  style={{ width: '100%', background: 'linear-gradient(45deg, #4ade80, #22c55e)', border: 'none', color: '#000', fontWeight: 'bold', padding: '12px' }}
                >
                  🚀 PUBLIKOVAT DO SVĚTA
                </button>
                <div style={{ fontSize: '11px', color: '#4ade80', textAlign: 'center' }}>Vše uloženo. Kliknutím výše píseň zveřejníte v katalogu.</div>
             </div>
          )}

         <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {eventsRef.current.map((ev, idx) => {
               const isLine = ev.type === 'line';
               const isLineEnd = ev.type === 'lineEnd';
               const isCountdown = ev.type === 'countdown';
               let text = '';
               if (isLine) {
                 const v = voiceMap[ev.lineIdx] || 1;
                 text = `[Blok Start ${ev.lineIdx+1}] ${v === 1 ? 'G' : (v === 2 ? 'R' : 'W')}`;
               } else if (isLineEnd) {
                 text = `[Blok Koniec ${ev.lineIdx+1}] 🏁`;
               } else if (isCountdown) {
                 text = `🚦 ODPOČET`;
               } else {
                 text = linesRef.current[ev.lineIdx]?.[ev.wordIdx] || '???';
               }

               return (
                 <div key={idx} style={{ background: isLine || isLineEnd ? 'rgba(255,215,0,0.05)' : (isCountdown ? 'rgba(255,75,43,0.1)' : 'rgba(255,255,255,0.02)'), padding: '6px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <input type="number" step="0.01" defaultValue={ev.time.toFixed(3)} onBlur={e => updateEvTime(idx, e.target.value)} style={{ width:'60px', background:'transparent', border:'none', color: isCountdown ? '#ff4b2b' : 'var(--color-teal)', fontSize:'11px', fontFamily:'monospace' }} />
                    <span style={{ fontSize:'12px', color: (isLine || isLineEnd) ? 'var(--color-gold)' : (isCountdown ? '#ff4b2b' : 'rgba(255,255,255,0.7)'), flex:1 }}>{text}</span>
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
