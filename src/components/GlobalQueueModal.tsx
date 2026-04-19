'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { advanceSessionQueue } from '@/app/actions/session-actions';

export default function GlobalQueueModal() {
  const { joinCode, sessionData, refreshSession } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-queue-manager', handleOpen);
    return () => window.removeEventListener('open-queue-manager', handleOpen);
  }, []);

  if (!isOpen || !sessionData) return null;

  const currentSong = sessionData.currentSong;
  const queueItems = sessionData.queue || [];

  const handleRemoveFromQueue = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!joinCode) return;
    const { removeFromSessionQueue } = await import('@/app/actions/session-actions');
    await removeFromSessionQueue(joinCode, id);
    refreshSession();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120000, 
      background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem'
    }} onPointerDown={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}>
      
      <div style={{
        width: '100%', maxWidth: '600px', maxHeight: '85vh', background: '#111', 
        borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', animation: 'slideUpModal 0.4s ease-out'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>Správa fronty</h2>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '10px 18px', borderRadius: '14px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Zavřít</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2.5rem 3rem' }}>
           <div style={{ marginBottom: '2.5rem' }}>
              <span style={{ fontSize: '11px', opacity: 0.5, fontWeight: 900, textTransform: 'uppercase' }}>Právě hraje:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', background: 'rgba(255,215,0,0.05)', padding: '1.5rem', borderRadius: '24px', border: '1px solid rgba(255,215,0,0.1)' }}>
                 <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: '#ffcc00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🎤</div>
                 <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 900, fontSize: '18px', color: '#ffcc00', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSong?.title || 'Ticho'}</div>
                    <div style={{ fontSize: '14px', opacity: 0.6 }}>{currentSong?.artist || 'Neznámý interpret'}</div>
                 </div>
              </div>
           </div>

           <div>
              <span style={{ fontSize: '11px', opacity: 0.5, fontWeight: 900, textTransform: 'uppercase' }}>Následuje:</span>
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                 {queueItems.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.4 }}>Fronta je prázdná.</div>
                 ) : (
                    queueItems.map((item: any, idx: number) => (
                       <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem 1.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>{idx + 1}</div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                             <div style={{ fontWeight: 800, fontSize: '15px' }}>{item.song?.title}</div>
                             <div style={{ fontSize: '13px', opacity: 0.5 }}>{item.song?.artist}</div>
                          </div>
                          <button onClick={(e) => handleRemoveFromQueue(item.id, e)} style={{ background: 'none', border: 'none', color: '#ff4b2b', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes slideUpModal { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
