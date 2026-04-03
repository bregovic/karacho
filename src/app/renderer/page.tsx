'use client';
import { useState, useRef } from 'react';

export default function RendererPage() {
  const [jsonName, setJsonName] = useState('1. Nahrát JSON soubor (z klíčování)');
  const [audioName, setAudioName] = useState('2. Nahrát originální audio');
  const [bgName, setBgName] = useState('3. Nahrát pozadí (Grafika/Zelené plátno)');
  const [animStyle, setAnimStyle] = useState('karaoke-gold'); // Zvolený styl

  return (
    <div style={{ padding: '2rem', minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
        <div className="glass-panel" style={{ padding: '4rem 2rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎬</div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Renderovna <span style={{ color: 'var(--color-teal)' }}>Videa</span></h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Tady vznikne tvoje produkční studio. Zde vezmeš tvůj vyrobený JSON, audio a zvolené pozadí, a my ti z toho zkompilujeme .WebM video připravené pro Premiere Pro.
            </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>📄</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>{jsonName}</div>
              <input type="file" accept=".json" onChange={e => setJsonName(e.target.files?.[0]?.name || jsonName)} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
            </label>

            <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>🎵</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>{audioName}</div>
              <input type="file" accept="audio/*" onChange={e => setAudioName(e.target.files?.[0]?.name || audioName)} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
            </label>

            <label className="btn-secondary" style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>🖼</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>{bgName}</div>
              <input type="file" accept="image/*" onChange={e => setBgName(e.target.files?.[0]?.name || bgName)} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
             <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Výběr enginu animace:</span>
             <select value={animStyle} onChange={e => setAnimStyle(e.target.value)} style={{ padding: '8px', background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}>
                <option value="karaoke-gold">Původní Karacho Zlato-Bílý Styl</option>
                <option value="karaoke-neon">Moderní Neonový Styl (Glow)</option>
                <option value="subtitles-simple">Jen spodní titulky (Šedé)</option>
             </select>
          </div>

          <button className="btn-primary" style={{ width: '100%' }}>
            ▶ Vytvořit finální WebM Video
          </button>
        </div>
      </div>
  );
}
