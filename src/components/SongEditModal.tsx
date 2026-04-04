'use client';
import { useState } from 'react';
import { updateSong } from '@/app/admin/actions';

interface SongEditModalProps {
  song: any;
  onClose: () => void;
  allGenres?: string[];
  allBackgrounds?: string[];
}

export default function SongEditModal({ song, onClose, allGenres = [], allBackgrounds = [] }: SongEditModalProps) {
  // Inteligentní autopublikace: pokud má song vše potřebné, navrhneme stav ACTIVE
  const hasEssentials = !!song.audioUrl && (!!song.jsonUrl || !!song.timingData);
  
  const [formData, setFormData] = useState({
    title: song.title || '',
    artist: song.artist || '',
    genre: song.genre || '',
    tags: Array.isArray(song.tags) ? song.tags.join(', ') : '',
    lyrics: song.lyrics || '',
    animationStyle: song.animationStyle || 'karaoke-classic',
    backgroundUrl: song.backgroundUrl || '',
    state: song.state || (hasEssentials ? 'ACTIVE' : 'NEW'),
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSong(song.id, formData);
      onClose();
      window.location.reload();
    } catch (err) {
      alert('Chyba při ukládání změn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '850px', maxHeight: '95vh', overflowY: 'auto', padding: '2.5rem', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>✕</button>
        
        <h2 style={{ color: 'var(--color-gold)', marginBottom: '2rem' }}>Editovat: {song.title}</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '13px', color: '#999' }}>Název skladby</label>
              <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '13px', color: '#999' }}>Interpret</label>
              <input value={formData.artist} onChange={e => setFormData({...formData, artist: e.target.value})} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '13px', color: '#00B140', fontWeight: 'bold' }}>Stav publikace (Viditelnost)</label>
              <select 
                value={formData.state} 
                onChange={e => setFormData({...formData, state: e.target.value})} 
                style={{ padding: '12px', background: '#1a1a1a', color: 'white', border: '2px solid rgba(0,177,64,0.3)', borderRadius: '10px', appearance: 'auto' }}
              >
                <option value="NEW">🆕 Nová (Skrytá)</option>
                <option value="PENDING_TIMING">⚙️ Rozpracovaná</option>
                <option value="ACTIVE">✅ AKTIVNÍ (VEŘEJNÁ)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '13px', color: '#999' }}>Žánr</label>
              <input list="genre-list" value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px' }} />
              <datalist id="genre-list">{allGenres.map(g => <option key={g}>{g}</option>)}</datalist>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '13px', color: '#999' }}>Styl Animace (Render)</label>
              <select value={formData.animationStyle} onChange={e => setFormData({...formData, animationStyle: e.target.value})} style={{ padding: '12px', background: '#1a1a1a', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', appearance: 'auto' }}>
                <option value="karaoke-classic">Originální Karacho (Zlato-bílá)</option>
                <option value="karaoke-neon">Moderní Neon (Tyrkysová)</option>
              </select>
            </div>
          </div>

          {/* GALERIE POZADÍ */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
             <h4 style={{ margin: '0 0 1rem 0', color: 'var(--color-teal)', fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
                🖼️ Knihovna Pozadí
                <span style={{ fontSize: '11px', color: '#666', fontWeight: 'normal' }}>Vyberte kliknutím</span>
             </h4>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', maxHeight: '180px', overflowY: 'auto', paddingRight: '8px' }}>
                {allBackgrounds.map(url => (
                  <div 
                    key={url} 
                    onClick={() => setFormData({...formData, backgroundUrl: url})}
                    style={{ 
                       cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: formData.backgroundUrl === url ? '3px solid var(--color-teal)' : '2px solid rgba(255,255,255,0.1)',
                       aspectRatio: '16/9', position: 'relative', transition: 'all 0.2s', transform: formData.backgroundUrl === url ? 'scale(1.05)' : 'none', zIndex: formData.backgroundUrl === url ? 2 : 1
                    }}
                  >
                     <img src={url} alt="Bkg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                     {formData.backgroundUrl === url && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,229,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>✅</div>}
                  </div>
                ))}
             </div>
             <div style={{ marginTop: '12px' }}>
                <input value={formData.backgroundUrl} onChange={e => setFormData({...formData, backgroundUrl: e.target.value})} placeholder="Vložte URL nebo vyberte z galerie" style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.2)', border: 'none', color: '#888', fontSize: '11px', borderRadius: '6px' }} />
             </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '13px', color: '#999' }}>Štítky (čárkou)</label>
            <input value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '13px', color: '#999' }}>Text písně (Lyrics)</label>
            <textarea value={formData.lyrics} onChange={e => setFormData({...formData, lyrics: e.target.value})} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', minHeight: '150px', lineHeight: '1.6' }} />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '12px 24px' }}>Zrušit</button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '12px 32px' }}>
              {loading ? 'Ukládám...' : (formData.state === 'ACTIVE' ? '🚀 Uložit & Zveřejnit' : '💾 Uložit draft')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
