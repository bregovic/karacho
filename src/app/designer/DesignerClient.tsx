'use client';
import { useState, useRef, useEffect, ChangeEvent } from 'react';
import Link from 'next/link';

export default function DesignerClient({ song }: { song: any }) {
  const [view, setView] = useState<'setup' | 'editor'>('setup');
  const [audioName, setAudioName] = useState('Nahrát audio soubor');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generování bloků ze surového textu
  const [blocks, setBlocks] = useState<any[]>([]);
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);

  // Zpracování textu při načtení
  useEffect(() => {
    if (song?.lyrics) {
      // Jednoduché rozdělení na řádky a slova
      const lines = song.lyrics.split('\n').filter((l: string) => l.trim().length > 0);
      const parsedBlocks = lines.map((line: string) => ({
        lw: line.split(' ').filter((w: string) => w.trim().length > 0),
        bs: null,
        be: null,
        w: [] // Zde budou uložené časy slov: { t: number, i: number }
      }));
      setBlocks(parsedBlocks);
    }
  }, [song]);

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
    if (!audioRef.current || blocks.length === 0) return;
    setView('editor');
    setCurrentBlockIdx(0);
    setCurrentWordIdx(-1);
    audioRef.current.play();
  };

  // Klíčová logika "Časování pomocí mezerníku"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== 'editor' || !audioRef.current || e.code !== 'Space') return;
      e.preventDefault();

      const t = audioRef.current.currentTime;
      setBlocks(prev => {
        const newBlocks = [...prev];
        const cb = newBlocks[currentBlockIdx];

        if (!cb) return prev; // Vše hotovo

        // Pokud zaznamenáváme první slovo v bloku, nastavíme rovnou i začátek bloku
        if (currentWordIdx === -1) {
          cb.bs = t;
        }

        const nextWordIdx = currentWordIdx + 1;
        
        if (nextWordIdx < cb.lw.length) {
          // Zaznamenání času pro dané slovo
          cb.w.push({ t, i: nextWordIdx });
          setCurrentWordIdx(nextWordIdx);
        }

        // Pokud to bylo poslední slovo v bloku
        if (nextWordIdx === cb.lw.length - 1) {
          cb.be = t + 2; // Odhadnutý konec zobrazení bloku (lze upravit)
          setCurrentBlockIdx(currentBlockIdx + 1);
          setCurrentWordIdx(-1);
        }

        return newBlocks;
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [view, currentBlockIdx, currentWordIdx]);

  if (view === 'setup') {
    return (
      <div style={{ padding: '2rem', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--color-teal)' }}>Studio: {song?.title || 'Nepřiřazeno'}</h1>
          <Link href="/admin" className="btn-secondary" style={{ textDecoration: 'none' }}>Zpět</Link>
        </header>

        <div className="glass-panel" style={{ padding: '4rem 2rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'var(--color-gold)' }}>Mistr Časovač</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Načteno bloků: {blocks.length}</p>
          </div>

          <label className="btn-secondary" style={{ width: '100%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <span>🎵 {audioName}</span>
            <input type="file" accept="audio/*" onChange={handleAudioLoad} style={{ position: 'absolute', opacity: 0, left: 0, top: 0, right: 0, bottom: 0, cursor: 'pointer' }} />
          </label>

          <button onClick={handleStart} disabled={audioName === 'Nahrát audio soubor' || blocks.length === 0} className="btn-primary" style={{ width: '100%' }}>
            ▶ Spustit nahrávání titulků
          </button>
        </div>
      </div>
    );
  }

  const isFinished = currentBlockIdx >= blocks.length;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)' }}>
      <header style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10 }}>
        <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={() => { setView('setup'); audioRef.current?.pause(); }}>
          Zastavit nahrávání
        </button>
      </header>

      {/* Editor Stage */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '2rem' }}>
        
        {isFinished ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--color-gold)', marginBottom: '1rem' }}>🎉 Hotovo!</h2>
            <p>Zde je vygenerovaný JSON připravený pro databázi:</p>
            <textarea readOnly value={JSON.stringify({ blocks }, null, 2)} style={{ width: '100%', height: '300px', background: '#000', color: '#0f0', padding: '1rem', marginTop: '1rem', fontFamily: 'monospace' }} />
          </div>
        ) : (
          <>
            {/* Odkaz pro uložení timing nápovědy */}
            <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'center' }}>
              Zpívej s písničkou a mačkej <strong style={{ color: 'var(--color-gold)' }}>[MEZERNÍK]</strong> při začátku každého slova.
            </div>

            {/* Zobrazení aktuálního textu */}
            <div style={{ fontSize: 'clamp(28px, 6vw, 64px)', fontWeight: 900, textAlign: 'center', display: 'flex', gap: '0.4em', flexWrap: 'wrap', justifyContent: 'center' }}>
              {blocks[currentBlockIdx]?.lw.map((word: string, i: number) => (
                <span key={i} style={{ 
                  color: i <= currentWordIdx ? 'var(--color-gold)' : 'rgba(255,255,255,0.4)',
                  transition: 'color 0.1s'
                }}>
                  {word}
                </span>
              ))}
            </div>

            {/* Náhled dalšího řádku */}
            <div style={{ fontSize: 'clamp(16px, 3vw, 24px)', color: 'rgba(255,255,255,0.2)', fontWeight: 700, marginTop: '2rem' }}>
              Další: {blocks[currentBlockIdx + 1]?.lw.join(' ') || '--- konec ---'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
