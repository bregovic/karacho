'use client';

import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { useState, useEffect } from 'react';

export default function HeaderSessionInfo() {
  const { joinCode } = useSession();

  if (!joinCode) return null;

  const openSessionInfo = () => {
    window.dispatchEvent(new CustomEvent('open-session-modal'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <button 
          onClick={openSessionInfo}
          style={{ 
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', 
            textAlign: 'left', display: 'flex', flexDirection: 'column'
          }}
        >
          <span style={{ 
            fontSize: 'clamp(14px, 4vw, 18px)', fontWeight: 900, color: 'var(--color-gold)', 
            letterSpacing: '0.1em', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.3))' 
          }}>
            # {joinCode}
          </span>
        </button>
    </div>
  );
}
