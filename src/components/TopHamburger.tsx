'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

interface TopHamburgerProps {
  isAdmin: boolean;
  isAuthenticated: boolean;
}

export default function TopHamburger({ isAdmin, isAuthenticated }: TopHamburgerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Funkce pro otevření globálního request modalu (pomocí custom eventu)
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
