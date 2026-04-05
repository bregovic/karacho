'use client';

import { useSession } from '@/context/SessionContext';
import { useState, useEffect } from 'react';

export default function HeaderSessionInfo() {
  const { joinCode, createOrJoin, leaveSession } = useSession();
  const [showQR, setShowQR] = useState(false);

  // Automatické vytvoření relace při prvním načtení (pokud žádná není)
  useEffect(() => {
    if (!joinCode) {
       createOrJoin();
    }
  }, [joinCode]);

  const handleCopy = () => {
    const url = `${window.location.origin}/join/${joinCode}`;
    navigator.clipboard.writeText(url);
    alert("Odkaz ke sdílení zkopírován! ✅");
  };

  if (!joinCode) {
    return (
      <div style={{ color: 'var(--color-gold)', fontSize: '10px', fontWeight: 'bold' }}>
        🔄 INICIALIZACE...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'relative' }}>
        <button 
          onClick={() => setShowQR(!showQR)}
          style={{ 
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', 
            textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px'
          }}
        >
          <span style={{ 
            fontSize: '18px', fontWeight: 900, color: 'var(--color-gold)', 
            letterSpacing: '0.15em', filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.5))' 
          }}>
            # {joinCode}
          </span>
          <span style={{ fontSize: '10px', opacity: 0.6, color: 'white', fontWeight: 700, letterSpacing: '0.05em' }}>OVLÁDANÍ MOBILEM</span>
        </button>

        {showQR && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: '1.5rem',
            background: 'white', padding: '2.5rem', borderRadius: '32px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.9)', zIndex: 10000,
            width: '320px', textAlign: 'center', color: '#111'
          }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '20px', fontWeight: 900 }}>Dálkové ovládání</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '13px', opacity: 0.7 }}>Naskenuj a ovládej celou show</p>
            
            <div style={{ background: '#f8f8f8', padding: '1.5rem', borderRadius: '24px', marginBottom: '1.5rem' }}>
              <img 
                src={`https://chart.googleapis.com/chart?cht=qr&chs=250x250&chl=${encodeURIComponent(window.location.origin + '/join/' + joinCode)}`}
                alt="QR Code" 
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleCopy} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'var(--color-gold)', border: 'none', color: 'black', fontWeight: '900', fontSize: '14px', cursor: 'pointer' }}>Kopírovat odkaz</button>
              <button 
                onClick={() => { leaveSession(); setShowQR(false); }} 
                style={{ background: '#eee', border: 'none', padding: '14px', borderRadius: '16px', color: '#666', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
              >
                Opustit
              </button>
            </div>
            
            <button onClick={() => setShowQR(false)} style={{ marginTop: '1.5rem', background: 'none', border: 'none', color: '#999', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}>Zavřít panel</button>
          </div>
        )}
    </div>
  );
}
