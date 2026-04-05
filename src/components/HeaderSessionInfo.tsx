'use client';

import { useSession } from '@/context/SessionContext';
import { useState, useEffect } from 'react';

export default function HeaderSessionInfo() {
  const { joinCode, createOrJoin, leaveSession } = useSession();
  const [showQR, setShowQR] = useState(false);

  // Při prvním načtení vytvoříme/připojíme relaci pokud není
  useEffect(() => {
    if (!joinCode) {
       // createOrJoin(); // Automatické vytváření můžeme nechat na kliknutí
    }
  }, [joinCode]);

  const handleCopy = () => {
    const url = `${window.location.origin}/join/${joinCode}`;
    navigator.clipboard.writeText(url);
    alert("Odkaz ke sdílení zkopírován! ✅");
  };

  if (!joinCode) {
    return (
      <button 
        onClick={() => createOrJoin()}
        style={{ 
          background: 'rgba(255,215,0,0.1)', color: 'var(--color-gold)', 
          border: '1px solid rgba(255,215,0,0.3)', padding: '4px 10px', 
          borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer',
          marginTop: '-4px', transition: 'all 0.2s'
        }}
      >
        🛰️ VYTVOŘIT RELACI
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'relative' }}>
        <button 
          onClick={() => setShowQR(!showQR)}
          style={{ 
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', 
            textAlign: 'left', display: 'flex', flexDirection: 'column' 
          }}
        >
          <span style={{ 
            fontSize: '11px', fontWeight: 900, color: 'var(--color-gold)', 
            letterSpacing: '0.1em', filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.3))' 
          }}>
            RELACE: {joinCode}
          </span>
          <span style={{ fontSize: '7px', opacity: 0.5, color: 'white' }}>KLIKNI PRO QR / SDÍLENÍ</span>
        </button>

        {showQR && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: '1rem',
            background: 'white', padding: '1.5rem', borderRadius: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)', zIndex: 10000,
            width: '260px', textAlign: 'center', color: '#111'
          }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '16px', fontWeight: 800 }}>Dálkové ovládání</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '11px', opacity: 0.7 }}>Naskenuj mobilem a ovládej frontu i přehrávač</p>
            
            <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '16px', marginBottom: '1rem' }}>
              {/* QR kód (zástupný přes Google Charts API pro rychlou impl) */}
              <img 
                src={`https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(window.location.origin + '/join/' + joinCode)}`}
                alt="QR Code" 
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleCopy} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'var(--color-gold)', border: 'none', color: 'black', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Kopírovat odkaz</button>
              <button 
                onClick={() => { leaveSession(); setShowQR(false); }} 
                style={{ background: '#eee', border: 'none', padding: '10px', borderRadius: '12px', color: '#666', fontSize: '12px', cursor: 'pointer' }}
              >
                Opustit
              </button>
            </div>
            
            <button onClick={() => setShowQR(false)} style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#999', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer' }}>Zavřít</button>
          </div>
        )}
    </div>
  );
}
