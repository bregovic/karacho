'use client';

import { useSession } from '@/context/SessionContext';
import { useState, useEffect } from 'react';

export default function HeaderSessionInfo() {
  const { joinCode, createOrJoin, leaveSession } = useSession();
  const [showQR, setShowQR] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!joinCode) {
       createOrJoin();
    } else {
       // Nastavíme URL pouze na klientovi, aby se předešlo hydratačním nesrovnalostem
       setUrl(`${window.location.origin}/join/${joinCode}`);
    }
  }, [joinCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    alert("Odkaz ke sdílení zkopírován! ✅");
  };

  if (!joinCode) return null;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <button 
            onClick={() => setShowQR(true)}
            style={{ 
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', 
              textAlign: 'left', display: 'flex', flexDirection: 'column'
            }}
          >
            <span style={{ 
              fontSize: '22px', fontWeight: 900, color: 'var(--color-gold)', 
              letterSpacing: '0.15em', filter: 'drop-shadow(0 0 15px rgba(255,215,0,0.45))' 
            }}>
              # {joinCode}
            </span>
          </button>
      </div>

      {showQR && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          zIndex: 999999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowQR(false)}>
          
          <div style={{
            background: 'white', padding: '3rem', borderRadius: '40px',
            maxWidth: '380px', width: '100%', textAlign: 'center', color: '#111',
            boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
            animation: 'modalFadeIn 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '24px', fontWeight: 900 }}>Dálkové ovládání</h3>
            <p style={{ margin: '0 0 2rem', fontSize: '14px', opacity: 0.6 }}>Naskenuj mobilem a ovládej celou show</p>
            
            <div style={{ background: '#f0f0f0', padding: '2rem', borderRadius: '28px', marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
              {/* QR kód (api.qrserver.com je spolehlivější alternativa) */}
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
                onClick={() => { leaveSession(); setShowQR(false); }} 
                style={{ background: '#eee', border: 'none', padding: '16px', borderRadius: '16px', color: '#666', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
              >
                Opustit
              </button>
            </div>
            
            <button onClick={() => setShowQR(false)} style={{ marginTop: '2rem', background: 'none', border: 'none', color: '#999', fontSize: '14px', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}>Zavřít panel</button>
          </div>
          
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes modalFadeIn {
              from { transform: scale(0.9); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}} />
        </div>
      )}
    </>
  );
}
