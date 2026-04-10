'use client';

import { useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

interface TopHamburgerProps {
  isAdmin: boolean;
  isAuthenticated: boolean;
}

export default function TopHamburger({ isAdmin, isAuthenticated }: TopHamburgerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { leaveSession } = useSession();
  const router = useRouter();

  // Funkce pro otevření globálního request modalu (pomocí custom eventu)
  const openRequestModal = () => {
    window.dispatchEvent(new CustomEvent('open-request-song-modal'));
    setIsOpen(false);
  };

  const joinSession = () => {
    leaveSession();
    setIsOpen(false);
    router.push('/');
  };

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          width: '42px', height: '42px', borderRadius: '12px', 
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
          color: 'white', fontSize: '20px', cursor: 'pointer', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          backdropFilter: 'blur(10px)', transition: 'all 0.2s' 
        }}
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {isOpen && (
        <div style={{ 
          position: 'absolute', top: '55px', right: 0, width: '220px', 
          background: '#0a0a0a', borderRadius: '20px', border: '1px solid rgba(255,215,0,0.2)', 
          boxShadow: '0 20px 50px rgba(0,0,0,0.9)', overflow: 'hidden', 
          zIndex: 2000, animation: 'slideDownMenu 0.3s ease-out' 
        }}>
            <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => setIsOpen(false)}>
              <div style={{ padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }} className="menu-item">
                <span style={{ fontSize: '18px' }}>🎵</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Seznam skladeb</span>
              </div>
            </Link>

            <div 
              onClick={() => {
                const code = prompt("Zadejte 5-místný kód show:");
                if (code && code.length === 5) {
                   window.location.href = `/join/${code.toUpperCase()}`;
                }
                setIsOpen(false);
              }}
              style={{ padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}
              className="menu-item"
            >
              <span style={{ fontSize: '18px' }}>🎫</span>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>Zadat kód show</span>
            </div>

            {useSession().joinCode && (
              <div 
                onClick={() => {
                  leaveSession();
                  setIsOpen(false);
                  router.push('/');
                }}
                style={{ padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff4b2b' }}
                className="menu-item"
              >
                <span style={{ fontSize: '18px' }}>🚫</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Odejít ze show</span>
              </div>
            )}

           <div 
             onClick={openRequestModal}
             style={{ padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}
             className="menu-item"
           >
             <span style={{ fontSize: '18px' }}>➕</span>
             <span style={{ fontSize: '14px', fontWeight: 700 }}>Chybějící hit?</span>
           </div>

           {isAuthenticated && (
             <Link href="/profile" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => setIsOpen(false)}>
               <div style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }} className="menu-item">
                 <span style={{ fontSize: '18px' }}>👤</span>
                 <span style={{ fontSize: '14px', fontWeight: 700 }}>Můj profil</span>
               </div>
             </Link>
           )}
           
           {isAdmin && (
             <div 
               onClick={async () => {
                 let code = useSession().joinCode;
                 if (!code) {
                   code = await useSession().createOrJoin();
                 }
                 const currentMode = useSession().sessionData?.sessionMode || 'KARAOKE';
                 const newMode = currentMode === 'KARAOKE' ? 'CHORDS' : 'KARAOKE';
                 const { updateSessionMode } = await import('@/app/actions/session-actions');
                 await updateSessionMode(code!, newMode);
                 setIsOpen(false);
               }}
               style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,215,0,0.05)' }} 
               className="menu-item"
             >
               <span style={{ fontSize: '18px' }}>{useSession().sessionData?.sessionMode === 'CHORDS' ? '🎤' : '🎸'}</span>
               <span style={{ fontSize: '14px', fontWeight: 700 }}>
                 {useSession().sessionData?.sessionMode === 'CHORDS' ? 'Přepnout na Karaoke' : 'Přepnout na Akordy'}
               </span>
             </div>
           )}
           
           {isAdmin && (
             <Link href="/admin" style={{ textDecoration: 'none', color: 'inherit' }}>
               <div style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }} className="menu-item">
                 <span style={{ fontSize: '18px' }}>⚙️</span>
                 <span style={{ fontSize: '14px', fontWeight: 700 }}>Administrace</span>
               </div>
             </Link>
           )}

           {isAuthenticated ? (
             <div 
               onClick={() => signOut({ callbackUrl: '/' })}
               style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }} 
               className="menu-item"
             >
               <span style={{ fontSize: '18px' }}>🚪</span>
               <span style={{ fontSize: '14px', fontWeight: 700 }}>Odhlásit se</span>
             </div>
           ) : (
             <Link href="/api/auth/signin" style={{ textDecoration: 'none', color: 'inherit' }}>
               <div style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }} className="menu-item">
                 <span style={{ fontSize: '18px' }}>👤</span>
                 <span style={{ fontSize: '14px', fontWeight: 700 }}>Přihlásit se</span>
               </div>
             </Link>
           )}
        </div>
      )}

      <style jsx>{`
        .menu-item:hover { background: rgba(255,215,0,0.1) !important; color: #ffd700 !important; }
        @keyframes slideDownMenu { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
