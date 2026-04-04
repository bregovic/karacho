'use client';
import { useState } from 'react';
import { updateSong } from '@/app/admin/actions';

interface SongEditModalProps {
  song: any;
  onClose: () => void;
}

export default function SongEditModal({ song, onClose }: SongEditModalProps) {
  const [formData, setFormData] = useState({
    title: song.title || '',
    artist: song.artist || '',
    genre: song.genre || '',
    tags: Array.isArray(song.tags) ? song.tags.join(', ') : '',
    lyrics: song.lyrics || '',
    animationStyle: song.animationStyle || 'karaoke-classic',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSong(song.id, formData);
      onClose();
    } catch (err) {
      alert('Chyba při ukládání změn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>✕</button>
        
        <h2 style={{ color: 'var(--color-gold)', marginBottom: '2rem' }}>Editovat: {song.title}</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '13px', color: '#999' }}>Název skladby</label>
              <input 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '13px', color: '#999' }}>Interpret</label>
              <input 
                value={formData.artist} 
                onChange={e => setFormData({...formData, artist: e.target.value})}
                style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '13px', color: '#999' }}>Žánr</label>
              <input 
                value={formData.genre} 
                onChange={e => setFormData({...formData, genre: e.target.value})}
                style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '13px', color: '#999' }}>Styl Animace (Render)</label>
              <select 
                value={formData.animationStyle} 
                onChange={e => setFormData({...formData, animationStyle: e.target.value})}
                style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px' }}
              >
                <option value="karaoke-classic">Originální Karacho (Zlato-bílá)</option>
                <option value="karaoke-neon">Moderní Neon (Tyrkysová)</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '13px', color: '#999' }}>Štítky (čárkou)</label>
            <input 
              value={formData.tags} 
              onChange={e => setFormData({...formData, tags: e.target.value})}
              placeholder="Duet, Rock, 80s..."
              style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '13px', color: '#999' }}>Text písně (Lyrics)</label>
            <textarea 
              value={formData.lyrics} 
              onChange={e => setFormData({...formData, lyrics: e.target.value})}
              style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', minHeight: '200px', lineHeight: '1.6' }}
            />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
             <h4 style={{ margin: '0 0 1rem 0', color: 'var(--color-teal)', fontSize: '14px' }}>Připojené soubory (Evidence)</h4>
             <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                 <li style={{ display: 'flex', justifyContent: 'space-between', opacity: song.audioUrl ? 1 : 0.4 }}>
                   <span>🎵 Audio Stopa (Originál)</span>
                   {song.audioUrl ? <a href={song.audioUrl} target="_blank" style={{ color: 'var(--color-gold)' }}>Otevřít soubor ↗</a> : <span>Chybí</span>}
                 </li>
                 <li style={{ display: 'flex', justifyContent: 'space-between', opacity: song.instrumentalUrl ? 1 : 0.4 }}>
                   <span>🎻 Instrumentál (Karaoke)</span>
                   {song.instrumentalUrl ? <a href={song.instrumentalUrl} target="_blank" style={{ color: 'var(--color-gold)' }}>Otevřít soubor ↗</a> : <span>Chybí</span>}
                 </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', opacity: song.jsonUrl ? 1 : 0.4 }}>
                  <span>⚙️ Časování (LRC/Studio)</span>
                  {song.jsonUrl ? <a href={song.jsonUrl} target="_blank" style={{ color: 'var(--color-gold)' }}>Otevřít soubor ↗</a> : <span>Chybí</span>}
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', opacity: song.videoUrl ? 1 : 0.4 }}>
                  <span>🎬 Finální Video (MP4)</span>
                  {song.videoUrl ? <a href={song.videoUrl} target="_blank" style={{ color: 'var(--color-gold)' }}>Otevřít soubor ↗</a> : <span>Chybí</span>}
                </li>
             </ul>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '12px 24px' }}>Zrušit</button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '12px 32px' }}>
              {loading ? 'Ukládám...' : 'Uložit změny'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
