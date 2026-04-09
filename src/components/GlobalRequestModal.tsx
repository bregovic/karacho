'use client';

import { useState, useEffect } from 'react';
import { requestSong, checkDuplicateSong } from '@/app/admin/actions';
import { useToast } from '@/context/ToastContext';

export default function GlobalRequestModal() {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqArtist, setReqArtist] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsOpen(true);
      if (e.detail?.title) setReqTitle(e.detail.title);
    };
    window.addEventListener('open-request-song-modal', handleOpen);
    return () => window.removeEventListener('open-request-song-modal', handleOpen);
  }, []);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle || !reqArtist) return;
    
    const dup = await checkDuplicateSong(reqTitle, reqArtist);
    if (dup) {
      if (dup.state === 'ACTIVE') {
        showToast("🎤 Tuhle písničku už v katalogu máme!", "info");
        setIsOpen(false);
        return;
      }
      if ((dup.state as string) === 'REQUESTED') {
        showToast("📝 O tuhle píseň už někdo požádal. Pracujeme na tom!", "info");
        setIsOpen(false);
        return;
      }
      showToast(`⚠️ Tato píseň už v systému je (Stav: ${dup.state}).`, "warning");
      setIsOpen(false);
      return;
    }
    
    setIsRequesting(true);
    const res = await requestSong(reqTitle, reqArtist, reqEmail);
    setIsRequesting(false);
    
    if (res.success) {
      showToast("🎉 Žádost odeslána! Zkusíme ji co nejdříve přidat.", "success");
      setIsOpen(false);
      setReqTitle('');
      setReqArtist('');
      setReqEmail('');
    } else {
      showToast("Něco se nepovedlo: " + (res.error || 'Neznámá chyba'), "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 110000, 
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
    }} onMouseUp={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}>
      <div style={{
        width: '100%', maxWidth: '400px', background: '#111', borderRadius: '32px', padding: '2.5rem',
        border: '1px solid rgba(255,215,0,0.2)', boxShadow: '0 20px 60px rgba(0,0,0,1)',
        animation: 'slideUpModal 0.3s ease-out'
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '0.5rem', color: '#ffd700' }}>Chybějící hit? 🎤</h2>
        <p style={{ opacity: 0.6, fontSize: '14px', marginBottom: '2rem' }}>Napiš nám co ti tu chybí a my to zkusíme co nejdříve připravit!</p>
        
        <form onSubmit={handleRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, opacity: 0.5, textTransform: 'uppercase' }}>Název písně</label>
            <input 
              type="text" required placeholder="např. Svařák"
              value={reqTitle} onChange={e => setReqTitle(e.target.value)}
              style={{ padding: '14px 18px', borderRadius: '16px', background: '#222', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, opacity: 0.5, textTransform: 'uppercase' }}>Interpret</label>
            <input 
              type="text" required placeholder="např. Harlej"
              value={reqArtist} onChange={e => setReqArtist(e.target.value)}
              style={{ padding: '14px 18px', borderRadius: '16px', background: '#222', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
            <button 
              type="button" onClick={() => setIsOpen(false)}
              style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', fontWeight: 800, cursor: 'pointer' }}
            >
              Zrušit
            </button>
            <button 
              type="submit" disabled={isRequesting}
              style={{ flex: 2, padding: '14px', borderRadius: '16px', background: '#ffd700', color: 'black', border: 'none', fontWeight: 900, cursor: 'pointer' }}
            >
              {isRequesting ? 'Odesílám...' : 'ODESLAT ŽÁDOST'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes slideUpModal { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
