'use client';
import { useState } from 'react';
import { updateSong } from '@/app/admin/actions';
import BackgroundGalleryModal from './BackgroundGalleryModal';

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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

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

  const handleApplyBackground = (url: string) => {
    setFormData({ ...formData, backgroundUrl: url });
    setIsGalleryOpen(false);
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '850px', maxHeight: '95vh', overflowY: 'auto', padding: '2.5rem', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
          
          <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          
          <h2 style={{ color: 'var(--color-gold)', marginBottom: '2.5rem', letterSpacing: '-0.02em' }}>Editace Skladby: {song.title}</h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>NÁZEV</label>
                <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', borderRadius: '12px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>INTERPRET</label>
                <input value={formData.artist} onChange={e => setFormData({...formData, artist: e.target.value})} style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', borderRadius: '12px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={{ fontSize: '12px', color: '#00B140', fontWeight: 'bold' }}>STAV PUBLIKACE</label>
                <select 
                  value={formData.state} 
                  onChange={e => setFormData({...formData, state: e.target.value})} 
                  style={{ padding: '12px', background: '#111', color: 'white', border: '2px solid rgba(0,177,64,0.3)', borderRadius: '12px', appearance: 'auto' }}
                >
                  <option value="NEW">🆕 Nová (Draft)</option>
                  <option value="PENDING_TIMING">⚙️ Rozpracovaná</option>
                  <option value="ACTIVE">✅ AKTIVNÍ (VEŘEJNÁ)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>ŽÁNR</label>
                <input list="genre-list" value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', borderRadius: '12px' }} />
                <datalist id="genre-list">{allGenres.map(g => <option key={g}>{g}</option>)}</datalist>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>STYL ANIMACE</label>
                <select value={formData.animationStyle} onChange={e => setFormData({...formData, animationStyle: e.target.value})} style={{ padding: '12px', background: '#111', color: 'white', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', appearance: 'auto' }}>
                  <option value="karaoke-classic">Retro Karacho (Zlato)</option>
                  <option value="karaoke-neon">Modern Karaoke (Neon)</option>
                </select>
              </div>
            </div>

            {/* VOLBA POZADÍ - INTEGROVANÁ GALERIE */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
               <div style={{ width: '160px', height: '90px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)', background: '#000', flexShrink: 0 }}>
                  <img src={formData.backgroundUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop'} alt="Bkg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
               </div>
               <div style={{ flex: 1, minWidth: '240px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--color-teal)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🖼️ POZADÍ SKLADBY</label>
                  <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#666' }}>Vyberte vizuální styl z vaší knihovny nebo přidejte nový obrázek.</p>
                  <button 
                    type="button" 
                    onClick={() => setIsGalleryOpen(true)}
                    style={{ padding: '10px 20px', background: 'var(--color-teal)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}
                  >
                    🚀 OTEVŘÍT GALERII & KNIHOVNU
                  </button>
               </div>
               <input 
                  value={formData.backgroundUrl} 
                  onChange={e => setFormData({...formData, backgroundUrl: e.target.value})} 
                  placeholder="URL obrázku (nebo vyberte z galerie)" 
                  style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#555', fontSize: '11px', padding: '8px 0', outline: 'none' }} 
               />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>ŠTÍTKY (separated by comma)</label>
              <input value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', borderRadius: '12px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>TEXT PÍSNĚ</label>
              <textarea value={formData.lyrics} onChange={e => setFormData({...formData, lyrics: e.target.value})} style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', borderRadius: '12px', minHeight: '150px', lineHeight: '1.6' }} />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '12px 28px', borderRadius: '12px' }}>Zrušit</button>
              <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '12px 36px', borderRadius: '12px' }}>
                {loading ? 'Ukládám...' : (formData.state === 'ACTIVE' ? '🚀 ULOŽIT & PUBLIKOVAT' : '💾 ULOŽIT NÁVRH')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* GALERIE MODAL */}
      <BackgroundGalleryModal 
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        onSelect={handleApplyBackground}
        allBackgrounds={allBackgrounds}
      />
    </>
  );
}
