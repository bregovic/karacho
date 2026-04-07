'use client';
import { useState } from 'react';
import { updateSong, updateSongAnimation, updateSongBackground, importLyricsFromUrl, researchSongDataAction } from '@/app/admin/actions';
import BackgroundGalleryModal from './BackgroundGalleryModal';

interface SongEditModalProps {
  song: any;
  onClose: () => void;
  onRefresh: () => void;
  onRemoveBackground: (url: string) => Promise<void>;
  allGenres?: string[];
  allBackgrounds?: string[];
}

export default function SongEditModal({ 
  song, 
  onClose, 
  onRefresh, 
  onRemoveBackground,
  allGenres = [],
  allBackgrounds = []
}: SongEditModalProps) {
  const [formData, setFormData] = useState(song);
  const [isSaving, setIsSaving] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await updateSong(song.id, formData);
    setIsSaving(false);
    onRefresh();
    onClose();
  };

  const handleResearch = async () => {
    setResearching(true);
    setImportStatus('⌛ Zjišťuji...');
    const res = await researchSongDataAction(song.id);
    if (res.success && res.updated) {
      setFormData({ 
        ...formData, 
        ...res.updated,
        tags: res.updated.tags || formData.tags 
      });
      setImportStatus('✅ Data doplněna!');
      setTimeout(() => setImportStatus(null), 3000);
    } else {
      setImportStatus(`❌ ${res.error || 'Informace nenalezeny'}`);
    }
    setResearching(false);
  };

  const handleImportLyrics = async () => {
    if (!importUrl) return;
    setImportStatus('⌛ Stahuji...');
    const res = await importLyricsFromUrl(song.id, importUrl);
    if (res.success) {
      setFormData({ ...formData, lyrics: res.lyrics });
      setImportStatus('✅ Text úspěšně stažen!');
      setTimeout(() => setImportStatus(null), 3000);
    } else {
      setImportStatus(`❌ ${res.error}`);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '850px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: 'var(--color-gold)' }}>✏️ EDITACE PÍSNĚ</h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>ZÁKLADNÍ ÚDAJE</label>
              <button 
                onClick={handleResearch} 
                disabled={researching}
                className="btn-secondary" 
                style={{ padding: '4px 12px', fontSize: '10px', borderRadius: '8px', border: '1px solid var(--color-teal)', color: 'var(--color-teal)' }}
              >
                {researching ? "⌛ HLEDÁM..." : "🪄 RESEARCH DATA"}
              </button>
            </div>
            
            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em', marginTop: '0.5rem' }}>NÁZEV PÍSNĚ</label>
            <input className="input-field" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />

            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>INTERPRET / AUTOR</label>
            <input className="input-field" value={formData.artist || ''} onChange={e => setFormData({ ...formData, artist: e.target.value })} />

            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>ŽÁNR</label>
            <input className="input-field" value={formData.genre || ''} list="genres-list" onChange={e => setFormData({ ...formData, genre: e.target.value })} />
            <datalist id="genres-list">
              {allGenres.map(g => <option key={g} value={g} />)}
            </datalist>

            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>ŠTÍTKY</label>
            <input className="input-field" value={(formData.tags || []).join(', ')} onChange={e => setFormData({ ...formData, tags: e.target.value.split(',').map((s: string) => s.trim()) })} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>STYL ANIMACE</label>
            <select className="input-field" value={formData.animationStyle} onChange={async (e) => {
              const val = e.target.value;
              setFormData({ ...formData, animationStyle: val });
              await updateSongAnimation(song.id, val);
            }}>
              <option value="karaoke-classic">Klasický (spodní linka)</option>
              <option value="karaoke-modern">Moderní (středový)</option>
              <option value="karaoke-cinema">Cinema (velký text)</option>
            </select>

            <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>POZADÍ</label>
            <div 
              style={{ 
                height: '40px', 
                borderRadius: '12px', 
                background: formData.backgroundUrl ? `url(${formData.backgroundUrl}) center/cover` : 'linear-gradient(45deg, #111, #222)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '10px', 
                fontWeight: 800, 
                color: '#fff', 
                textShadow: '0 2px 4px rgba(0,0,0,0.8)' 
              }}
              onClick={() => setShowGallery(true)}
            >
              {!formData.backgroundUrl && "➕ VYBRAT POZADÍ Z GALERIE"}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <label style={{ fontSize: '11px', color: '#888', fontWeight: 800, letterSpacing: '0.05em' }}>TEXT PÍSNĚ</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  placeholder="URL karaoketexty.cz" 
                  value={importUrl} 
                  onChange={e => setImportUrl(e.target.value)}
                  style={{ padding: '6px 12px', fontSize: '11px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', width: '180px' }}
                />
                <button type="button" onClick={handleImportLyrics} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px' }}>🔗 IMPORT</button>
              </div>
            </div>
            {importStatus && <div style={{ fontSize: '11px', color: importStatus.startsWith('✅') ? '#4ade80' : '#f87171', marginTop: '-5px' }}>{importStatus}</div>}
            <textarea 
              className="input-field" 
              style={{ height: '180px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6' }} 
              value={formData.lyrics || ''} 
              onChange={e => setFormData({ ...formData, lyrics: e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '12px 30px', borderRadius: '14px' }}>Zrušit</button>
          <button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="btn-primary" 
            style={{ padding: '12px 40px', background: 'var(--color-gold)', color: '#000', borderRadius: '14px', fontWeight: 900 }}
          >
            {isSaving ? "UKLÁDÁM..." : "💾 ULOŽIT PÍSEŇ"}
          </button>
        </div>
      </div>

      {showGallery && (
        <BackgroundGalleryModal 
          isOpen={showGallery}
          allBackgrounds={allBackgrounds}
          onSelect={async (url) => {
            setFormData({ ...formData, backgroundUrl: url });
            await updateSongBackground(song.id, url);
            setShowGallery(false);
          }}
          onClose={() => setShowGallery(false)}
          onRemove={(url) => onRemoveBackground(url)}
        />
      )}
    </div>
  );
}
