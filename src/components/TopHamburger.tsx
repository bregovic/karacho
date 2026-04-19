'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

interface TopHamburgerProps {
  isAdmin: boolean;
  isAuthenticated: boolean;
}

export default function TopHamburger({ isAdmin, isAuthenticated }: TopHamburgerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { leaveSession, localMode, toggleLocalMode, joinCode, sessionData } = useSession();
  const { showToast } = useToast();
  const router = useRouter();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    setIsOpen(false);
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // Detekce iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
         showToast("PWA na iOS nainstalujete přes: Sdílet -> Přidat na plochu 📲", "info");
      } else {
         showToast("Aplikace je již nainstalována nebo ji prohlížeč nepodporuje.", "info");
      }
    }
  };

  const openRequestModal = () => {
    window.dispatchEvent(new CustomEvent('open-request-song-modal'));
    setIsOpen(false);
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
          backdropFilter: 'blur(10px)', transition: 'all 0.2s',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
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

            {/* PWA INSTALL */}
            <div 
              onClick={handleInstallClick}
              style={{ padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,215,0,0.03)' }}
              className="menu-item"
            >
              <span style={{ fontSize: '18px' }}>📱</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-gold)' }}>Mobilní aplikace</span>
            </div>

            {/* GLOBÁLNÍ PŘEPÍNAČ REŽIMU (ZPĚVNÍK / KARAOKE) */}
            <div 
              onClick={() => { toggleLocalMode(); setIsOpen(false); }}
              style={{ 
                padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: localMode === 'CHORDS' ? 'rgba(0, 255, 170, 0.08)' : 'rgba(255,255,255,0.02)' 
              }} 
              className="menu-item"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <span style={{ fontSize: '18px' }}>{localMode === 'CHORDS' ? '📖' : '🎤'}</span>
                 <span style={{ fontSize: '14px', fontWeight: 700 }}>
                   {localMode === 'CHORDS' ? 'Režim: ZPĚVNÍK 🎸' : 'Režim: KARAOKE 🎤'}
                 </span>
              </div>
              <div style={{ width: '36px', height: '20px', background: localMode === 'CHORDS' ? '#00ffaa' : 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', transition: 'all 0.3s' }}>
                 <div style={{ position: 'absolute', top: '2px', left: localMode === 'CHORDS' ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'all 0.3s' }}></div>
              </div>
            </div>

            {joinCode && (
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

            {joinCode && (
              <div style={{ padding: '8px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.05)', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>SHOW: <span style={{ color: '#00ffaa', fontWeight: 800 }}>{joinCode}</span></span>
                <span style={{ color: sessionData?.sessionMode === 'CHORDS' ? '#ffcc00' : 'var(--color-teal)', fontWeight: 800 }}>
                  {sessionData?.sessionMode === 'CHORDS' ? '🎸 REŽIM AKORDY' : '🎤 REŽIM KARAOKE'}
                </span>
              </div>
            )}

            {isAdmin && joinCode && (
              <div 
                onClick={async () => {
                  const currentMode = sessionData?.sessionMode || 'KARAOKE';
                  const newMode = currentMode === 'KARAOKE' ? 'CHORDS' : 'KARAOKE';
                  const { updateSessionMode } = await import('@/app/actions/session-actions');
                  await updateSessionMode(joinCode, newMode);
                  setIsOpen(false);
                }}
                style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)' }} 
                className="menu-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <span style={{ fontSize: '18px' }}>🔄</span>
                   <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Přepnout režim celé relace</span>
                </div>
              </div>
            )}
            
            {isAdmin && (
              <Link href="/admin" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => setIsOpen(false)}>
                <div style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }} className="menu-item">
                  <span style={{ fontSize: '18px' }}>⚙️</span>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>Administrace</span>
                </div>
              </Link>
            )}

            {isAuthenticated ? (
              <div 
                onClick={() => { setIsOpen(false); signOut({ callbackUrl: '/' }); }}
                style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }} 
                className="menu-item"
              >
                <span style={{ fontSize: '18px' }}>🚪</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Odhlásit se</span>
              </div>
            ) : (
              <Link href="/api/auth/signin" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => setIsOpen(false)}>
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
