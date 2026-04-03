'use client';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { updateSongAudio, updateSongInstrumental, updateSongJson, updateSongVideo } from '@/app/admin/actions';

function RendererContent() {
  const searchParams = useSearchParams();
  const songId = searchParams.get('songId');

  const [jsonName, setJsonName] = useState('1. Nahrát JSON soubor (z klíčování)');
  const [audioName, setAudioName] = useState('2. Nahrát originální audio');
  const [bgName, setBgName] = useState('3. Nahrát pozadí (Grafika/Zelené plátno)');
  const [animStyle, setAnimStyle] = useState('karaoke-gold'); 
  
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const jsonRef = useRef<File | null>(null);
  const audioRef = useRef<File | null>(null);
  const bgRef = useRef<File | null>(null);

  // Fallback data pro auto-load z DB
  const [remoteJsonData, setRemoteJsonData] = useState<any>(null);
  const [remoteAudioUrl, setRemoteAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!songId) {
      console.log("Renderer: songId not yet present in searchParams.");
      return;
    }
    
    console.log("Renderer: Starting auto-load for songId:", songId);
    setJsonName("⏳ Načítám časování...");
    setAudioName("⏳ Načítám audio...");

    fetch(`/api/songs/${songId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(async song => {
        console.log("Renderer: Song data fetched successfully:", song.title);
        
        // 1. TIMING DATA (JSON)
        if (song.timingData) {
          setRemoteJsonData(song.timingData);
          setJsonName(`✅ DB: ${song.title}.json`);
        } else if (song.jsonUrl) {
          // Pokud je v DB jen link, stáhneme soubor
          try {
            const res = await fetch(song.jsonUrl);
            const data = await res.json();
            setRemoteJsonData(data);
            setJsonName(`✅ CLOUD: ${song.title}.json`);
          } catch (e) {
            console.error("Renderer Error (JSON download):", e);
            setJsonName("❌ Chyba při stahování JSONu");
          }
        } else {
          setJsonName("❓ Žádné časování v databázi");
        }

        // 2. AUDIO DATA (MP3)
        if (song.audioUrl) {
          setRemoteAudioUrl(song.audioUrl);
          setAudioName(`✅ CLOUD: ${song.title}.mp3`);
        } else {
          setAudioName("❓ Žádné audio v databázi");
        }
      })
      .catch(err => {
        console.error("Renderer Error (Fetch song):", err);
        setJsonName("❌ Selhalo spojení s DB");
        setAudioName("❌ Selhalo spojení s DB");
      });
  }, [songId]);

  const handleJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { jsonRef.current = f; setJsonName(f.name); setRemoteJsonData(null); }
  };
  const handleAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { audioRef.current = f; setAudioName(f.name); setRemoteAudioUrl(null); }
  };
  const handleBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { bgRef.current = f; setBgName(f.name); }
  };

  const handleUploadToCloud = async () => {
    if (!finalBlob || !songId) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      const filename = `render-${songId}-${Date.now()}.webm`;
      formData.append('file', new File([finalBlob], filename, { type: 'video/webm' }));

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.finalUrl) {
        await updateSongVideo(songId, data.finalUrl);
        alert("Video bylo úspěšně nahráno do Katalogu! ✅");
      }
    } catch (e) {
      console.error(e);
      alert("Chyba při nahrávání do Katalogu.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartRender = async () => {
    if ((!jsonRef.current && !remoteJsonData) || (!audioRef.current && !remoteAudioUrl)) {
        alert("Chybí timing data nebo audio! Není z čeho sestavit karaoke.");
        return;
    }
    
    setStatus('rendering');
    setProgress(0);
    setFinalBlob(null);

    try {
        let data = remoteJsonData;
        if (jsonRef.current) {
           const text = await jsonRef.current.text();
           data = JSON.parse(text);
        }
        const blocks = data.blocks;

        // Vytvoř Obrázek
        let img: HTMLImageElement | null = null;
        if (bgRef.current) {
            img = new window.Image();
            img.src = URL.createObjectURL(bgRef.current);
            await new Promise(r => { img!.onload = r; });
        }

        // Vytvoř AudioContext pro nahrání zvuku s Canvasem dohromady
        const audioSrc = audioRef.current ? URL.createObjectURL(audioRef.current) : remoteAudioUrl;
        const au = new window.Audio(audioSrc!);
        au.crossOrigin = "anonymous";
        await new Promise(r => { au.oncanplaythrough = r; });
        
        const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = actx.createMediaStreamDestination();
        const source = actx.createMediaElementSource(au);
        source.connect(dest);
        source.connect(actx.destination); 

        // Vytvoř Canvas 1920x1080
        const W = 1920; 
        const H = 1080;
        const canvas = document.createElement('canvas');
        canvas.width = W; 
        canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        // Vytvoř Video Stream @30FPS
        const stream = (canvas as any).captureStream(30);
        stream.addTrack(dest.stream.getAudioTracks()[0]);

        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 12000000 });
        const chunks: Blob[] = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
           const blob = new Blob(chunks, { type: 'video/webm' });
           setFinalBlob(blob);
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = `karacho-render-${Date.now()}.webm`;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
           setStatus('done');
        };

        recorder.start();
        au.play();

        const renderWords = (ctx: CanvasRenderingContext2D, y: number, initialFontSize: number, words: string[], numColored: number, alpha: number) => {
            let fontSize = initialFontSize;
            let totalWidth = 0;
            const widths: number[] = [];
            let spaceW = 0;
            
            do {
                ctx.font = `900 ${fontSize}px "Inter", sans-serif`;
                totalWidth = 0;
                widths.length = 0;
                words.forEach(w => {
                   const m = ctx.measureText(w).width;
                   widths.push(m);
                   totalWidth += m;
                });
                spaceW = ctx.measureText(" ").width;
                totalWidth += spaceW * (words.length - 1);
                
                if (totalWidth > W * 0.85) {
                    fontSize -= 4;
                }
            } while (totalWidth > W * 0.85 && fontSize > 16);

            let sx = (W / 2) - (totalWidth / 2);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            
            words.forEach((w, i) => {
                const isColored = i < numColored;
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = 'rgba(0,0,0,0.85)';
                ctx.lineWidth = fontSize * 0.1;
                ctx.lineJoin = 'round';
                ctx.strokeText(w, sx, y);
                
                if (isColored) {
                   ctx.fillStyle = animStyle === 'karaoke-neon' ? '#00e5ff' : '#ffd700';
                   ctx.shadowColor = animStyle === 'karaoke-neon' ? '#00e5ff' : 'rgba(255,215,0,0.5)';
                   ctx.shadowBlur = 24;
                } else {
                   ctx.fillStyle = `rgba(255,255,255,${alpha * 0.85})`;
                   ctx.shadowBlur = 0;
                }
                ctx.fillText(w, sx, y);
                ctx.shadowBlur = 0;
                sx += widths[i] + spaceW;
            });
        };

        const interval = setInterval(() => {
            const t = au.currentTime;
            setProgress((t / au.duration) * 100);
            
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#00B140';
            ctx.fillRect(0, 0, W, H);
    
            if (img) {
               ctx.drawImage(img, 0, 0, W, H);
               ctx.fillStyle = 'rgba(0,0,0,0.6)';
               ctx.fillRect(0, 0, W, H);
            }
    
            const ci = blocks.findIndex((b: any) => t >= b.bs && t < b.be);
            if (ci >= 0) {
                const prev = ci > 0 ? blocks[ci - 1] : null;
                const curr = blocks[ci];
                const next = ci < blocks.length - 1 ? blocks[ci + 1] : null;

                let nc = 0;
                for (const we of curr.w) { if (t >= we.t) nc = we.i + 1; }
    
                if (prev) renderWords(ctx, H * 0.25, 48, prev.lw, prev.lw.length, 0.4);
                renderWords(ctx, H * 0.50, 90, curr.lw, nc, 1.0);
                if (next) renderWords(ctx, H * 0.75, 48, next.lw, 0, 0.4);
            }
    
            if (t >= au.duration || au.paused) {
                clearInterval(interval);
                recorder.stop();
                actx.close();
            }
        }, 1000 / 30);

    } catch (err) {
        console.error(err);
        alert('Došlo k chybě při generování. Ujistěte se, že je okno zaostřeno.');
        setStatus('idle');
    }
  };

  return (
    <div style={{ padding: '2rem', minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
        <div className="glass-panel" style={{ padding: '4rem 2rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎬</div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Renderovna <span style={{ color: 'var(--color-teal)' }}>Videa</span></h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Teď už jen jeden klik a tvé na mobilu naťukané karaoke bude ve WebM! 🚀
            </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', pointerEvents: status === 'rendering' ? 'none' : 'auto', opacity: status === 'rendering' ? 0.3 : 1 }}>
            <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>📄</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>{jsonName}</div>
              <input type="file" accept=".json" onChange={handleJson} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
            </label>

            <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>🎵</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>{audioName}</div>
              <input type="file" accept="audio/*" onChange={handleAudio} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
            </label>

            <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>🖼</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>{bgName}</div>
              <input type="file" accept="image/*" onChange={handleBg} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
             <select value={animStyle} onChange={e => setAnimStyle(e.target.value)} disabled={status==='rendering'} style={{ padding: '8px', background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}>
                <option value="karaoke-gold">Původní Karacho Zlato-Bílý Styl</option>
                <option value="karaoke-neon">Moderní Neonový Styl (Glow)</option>
             </select>
          </div>

          {status === 'idle' && (
            <button className="btn-primary" style={{ width: '100%' }} onClick={handleStartRender}>
              ▶ Vytvořit finální WebM Video
            </button>
          )}

          {status === 'rendering' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--color-gold)', fontWeight: 'bold' }}>
                    Probíhá renderování ({progress.toFixed(1)}%)
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-gold)' }} />
                </div>
            </div>
          )}

          {status === 'done' && (
             <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '100%', textAlign: 'center', padding: '1rem', background: 'rgba(0,255,0,0.1)', border: '1px solid rgba(0,255,0,0.2)', borderRadius: '8px' }}>
                   <h3 style={{ color: '#0f0', margin: 0 }}>Hotovo! Video se stahuje.</h3>
                </div>
                {songId && (
                   <button 
                     className="btn-primary" 
                     style={{ width: '100%', background: 'var(--color-teal)' }} 
                     onClick={handleUploadToCloud}
                     disabled={isUploading}
                   >
                     {isUploading ? 'Nahrávám video do cloudu...' : '☁️ Publikovat do Katalogu'}
                   </button>
                )}
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setStatus('idle')}>Zkusit znovu</button>
             </div>
          )}

        </div>
      </div>
  );
}

export default function RendererPage() {
  return (
    <Suspense fallback={<div style={{ padding: '4rem', color: '#fff', textAlign: 'center' }}>Načítám renderovnu...</div>}>
      <RendererContent />
    </Suspense>
  );
}
