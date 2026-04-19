'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';

export default function GlobalSessionModal() {
  const { joinCode, isLoading, leaveSession } = useSession();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-session-modal', handleOpen);
    return () => window.removeEventListener('open-session-modal', handleOpen);
  }, []);

  useEffect(() => {
    if (joinCode) {
      setUrl(`${window.location.origin}/join/${joinCode}`);
    }
  }, [joinCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    showToast("Odkaz ke sdílení byl zkopírován! ✅");
  };

  if (!isOpen || !joinCode) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 121000, 
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }} onClick={() => setIsOpen(false)}>
      
      <div style={{
        background: 'white', padding: '3rem', borderRadius: '40px',
        maxWidth: '380px', width: '100%', textAlign: 'center', color: '#111',
        boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
        animation: 'modalFadeIn 0.3s ease-out'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '24px', fontWeight: 900 }}>Dálkové ovládání</h3>
        <p style={{ margin: '0 0 2rem', fontSize: '14px', opacity: 0.6 }}>Naskenuj mobilem a ovládej celou show</p>
        
        <div style={{ background: '#f0f0f0', padding: '2rem', borderRadius: '28px', marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
          {url && (
             <img 
               src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`}
               alt="QR Code" 
               style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '12px' }}
             />
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleCopy} style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--color-gold)', border: 'none', color: 'black', fontWeight: '900', fontSize: '15px', cursor: 'pointer' }}>Kopírovat</button>
          <button 
            onClick={() => { leaveSession(); setIsOpen(false); }} 
            style={{ background: '#eee', border: 'none', padding: '16px', borderRadius: '16px', color: '#666', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
          >
            Opustit
          </button>
        </div>
        
        <button onClick={() => setIsOpen(false)} style={{ marginTop: '2rem', background: 'none', border: 'none', color: '#999', fontSize: '14px', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}>Zavřít panel</button>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFadeIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}} />
    </div>
  );
}
