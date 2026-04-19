'use client';

import { useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { updateSessionState, advanceSessionQueue } from '@/app/actions/session-actions';

export default function GlobalMiniPlayer() {
  const { joinCode, sessionData, refreshSession } = useSession();

  if (!joinCode || !sessionData || (!sessionData.currentSong && (!sessionData.queue || sessionData.queue.length === 0))) {
    return null;
  }

  const currentSong = sessionData.currentSong;
  const queueItems = sessionData.queue || [];

  const remoteControl = async (action: 'PLAY' | 'PAUSE' | 'NEXT') => {
    if (!joinCode) return;
    if (action === 'NEXT') {
      await advanceSessionQueue(joinCode);
    } else {
      await updateSessionState(joinCode, { status: action === 'PLAY' ? 'PLAYING' : 'PAUSED' });
    }
    refreshSession();
  };

  const openQueue = () => {
    window.dispatchEvent(new CustomEvent('open-queue-manager'));
  };

  return (
    <div className="mini-player-bar" style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      width: '100%',
      transition: 'all 0.3s',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Horní řada: Play + Název + Tlačítka */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        
        {/* Symbol vlevo */}
        <div 
          onClick={() => remoteControl(sessionData.status === 'PLAYING' ? 'PAUSE' : 'PLAY')}
          style={{ cursor: 'pointer', fontSize: '18px', color: '#ffcc00', width: '24px' }}
        >
          {sessionData.status === 'PLAYING' ? '⏸' : '▶'}
        </div>

        {/* Název uprostřed */}
        <div 
          style={{ flex: 1, cursor: 'pointer', overflow: 'hidden' }}
          onClick={openQueue}
        >
          <div style={{ fontSize: '13px', fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentSong?.title || 'Ticho v baru'}
          </div>
        </div>

        {/* Tlačítka vpravo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <a 
            href={`/player/${currentSong?.id}?mode=watch&code=${joinCode}`}
            className="player-btn"
            title="Sledovat (Mirror)"
          >
            📺
          </a>
          <button 
            onClick={() => remoteControl('NEXT')}
            className="player-btn"
            title="Další"
          >
            ⏭️
          </button>
          <button 
            onClick={() => remoteControl(sessionData.status === 'PLAYING' ? 'PAUSE' : 'PLAY')}
            className="player-btn play-main"
          >
            {sessionData.status === 'PLAYING' ? '⏸' : '▶'}
          </button>
        </div>
      </div>

      {/* Spodní řada: Následuje */}
      {queueItems.length > 0 && (
        <div style={{ 
          marginTop: '2px', 
          fontSize: '10px', 
          opacity: 0.5, 
          display: 'flex', 
          gap: '4px',
          paddingLeft: '36px'
        }}>
          <span style={{ fontWeight: 900, textTransform: 'uppercase', color: '#ffcc00' }}>Následuje:</span>
          <span style={{ fontWeight: 600 }}>{queueItems[0].song?.title}</span>
        </div>
      )}

      <style jsx>{`
        .player-btn {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          text-decoration: none;
          font-size: 12px;
          transition: all 0.2s;
        }
        .player-btn:hover { background: rgba(255,255,255,0.12); }
        .play-main { background: #ffcc00; color: #000; border: none; }
        
        @media (max-width: 850px) {
          .mini-player-bar { 
             margin: 0.5rem 0 0 0;
             max-width: none;
             width: 100%;
             background: rgba(255,255,255,0.03);
             padding: 8px 12px;
             border-radius: 12px;
             border: 1px solid rgba(255,255,255,0.05);
          }
        }
      `}</style>
    </div>
  );
}
