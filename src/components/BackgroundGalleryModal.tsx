'use client';
import { useState } from 'react';

interface BackgroundGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  onRemove?: (url: string) => void;
  allBackgrounds: string[];
}

export default function BackgroundGalleryModal({ isOpen, onClose, onSelect, onRemove, allBackgrounds }: BackgroundGalleryModalProps) {
  const [search, setSearch] = useState('');
  const [newUrl, setNewUrl] = useState('');

  if (!isOpen) return null;

  // Filtrování existujících obrázků
  const filtered = allBackgrounds.filter(url => 
    url.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUrl.trim()) {
      onSelect(newUrl.trim());
      setNewUrl('');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(15px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      
      <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', maxHeight: '85vh', overflowY: 'auto', padding: '2.5rem', border: '1px solid var(--color-teal)', position: 'relative' }} onClick={e => e.stopPropagation()}>
        
        {/* HLAVIČKA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
           <div>
              <h2 style={{ color: 'var(--color-gold)', margin: 0 }}>🖼️ Galerie Pozadí</h2>
              <p style={{ color: '#888', margin: '4px 0 0 0', fontSize: '13px' }}>Vyberte si atmosféru pro vaši karaoke show</p>
           </div>
           <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#666', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>

        {/* NÁSTROJE: Vyhledávání & Přidání */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
           
           <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
              <input 
                type="text" 
                placeholder="Rychlé vyhledávání v galerii..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '12px 12px 12px 40px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '12px', outline: 'none' }}
              />
           </div>

           <form onSubmit={handleAddNew} style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="Vložit URL nového obrázku..." 
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                style={{ flex: 1, padding: '12px', background: 'rgba(0,177,64,0.05)', border: '1px solid rgba(0,177,64,0.2)', color: 'white', borderRadius: '12px', outline: 'none' }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0 20px', borderRadius: '12px', background: 'var(--color-teal)' }}>➕ PŘIDAT</button>
           </form>

        </div>

        {/* MŘÍŽKA OBRÁZKŮ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
           {filtered.length > 0 ? (
             filtered.map((url, i) => (
               <div 
                 key={i} 
                 onClick={() => onSelect(url)}
                 className="gallery-item-anim"
                 style={{ 
                    cursor: 'pointer', borderRadius: '14px', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.08)',
                    aspectRatio: '16/9', position: 'relative', transition: 'all 0.3s ease', background: '#111'
                 }}
               >
                  <img src={url} alt={`Bkg ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }} />
                  <div className="item-overlay" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', opacity: 0, transition: 'opacity 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                     <button 
                       onClick={(e) => { e.stopPropagation(); onSelect(url); }} 
                       style={{ background: 'var(--color-teal)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
                     >
                       POUŽÍT ✅
                     </button>
                     {!url.startsWith('/backgrounds/') && onRemove && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); if(confirm('Opravdu chcete tento obrázek z galerie zapomenout?')) onRemove(url); }}
                         style={{ background: 'rgba(255,0,0,0.4)', border: 'none', color: 'white', width: '35px', height: '35px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}
                         title="Odstranit z galerie"
                       >
                         🗑️
                       </button>
                     )}
                  </div>
               </div>
             ))
           ) : (
             <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: '#555' }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🖼️</span>
                Žádné obrázky neodpovídají hledání.
             </div>
           )}
        </div>

        <style jsx>{`
          .gallery-item-anim:hover {
            border-color: var(--color-gold) !important;
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          }
          .gallery-item-anim:hover .item-overlay {
            opacity: 1 !important;
          }
          .gallery-item-anim:hover img {
            transform: scale(1.1);
          }
        `}</style>
      </div>
    </div>
  );
}
