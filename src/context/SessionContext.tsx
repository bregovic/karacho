'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSessionStatus, joinOrCreateSession } from '@/app/actions/session-actions';

interface SessionContextType {
  joinCode: string | null;
  sessionData: any | null;
  localMode: 'KARAOKE' | 'CHORDS';
  isLoading: boolean;
  isHost: boolean;
  toggleLocalMode: () => void;
  createOrJoin: (code?: string) => Promise<string>;
  leaveSession: () => void;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [localMode, setLocalMode] = useState<'KARAOKE' | 'CHORDS'>('KARAOKE');
  const [isLoading, setIsLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);

  // Načtení relace a režimu při startu
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    const saved = localStorage.getItem('karacho_session_code');
    const savedMode = localStorage.getItem('karacho_local_mode');
    const savedHost = localStorage.getItem('karacho_is_host');

    if (savedMode === 'CHORDS') setLocalMode('CHORDS');
    if (savedHost === 'true') setIsHost(true);

    if (urlCode) {
      setJoinCode(urlCode);
      localStorage.setItem('karacho_session_code', urlCode);
      loadSession(urlCode);
    } else if (saved) {
      setJoinCode(saved);
      loadSession(saved);
    } else {
      setIsLoading(false);
    }
  }, []);

  const toggleLocalMode = () => {
    setLocalMode(prev => {
      const next = prev === 'KARAOKE' ? 'CHORDS' : 'KARAOKE';
      localStorage.setItem('karacho_local_mode', next);
      return next;
    });
  };

  // Automatická synchronizace (polling) pro udržení fronty v reálném čase
  useEffect(() => {
    if (!joinCode) return;
    
    // Načteme hned, pak v intervalu
    loadSession(joinCode);
    
    const tid = setInterval(() => {
      loadSession(joinCode);
    }, 2500); // Každé 2.5s zkontrolovat stav
    
    return () => clearInterval(tid);
  }, [joinCode]);

  const loadSession = async (code: string) => {
    try {
      const data = await getSessionStatus(code);
      if (data && data.isActive) {
        setSessionData(data);
      } else if (data === null) {
        // Relace nenalezena nebo smazána
        localStorage.removeItem('karacho_session_code');
        setJoinCode(null);
        setSessionData(null);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const createOrJoin = async (code?: string) => {
    setIsLoading(true);
    try {
      const session = await joinOrCreateSession(code);
      setJoinCode(session.joinCode);
      setSessionData(session);
      localStorage.setItem('karacho_session_code', session.joinCode);
      
      if (!code) {
        localStorage.setItem('karacho_is_host', 'true');
        setIsHost(true);
      } else {
        localStorage.removeItem('karacho_is_host');
        setIsHost(false);
      }
      
      return session.joinCode;
    } finally {
      setIsLoading(false);
    }
  };

  const leaveSession = () => {
    localStorage.removeItem('karacho_session_code');
    localStorage.removeItem('karacho_is_host');
    setJoinCode(null);
    setSessionData(null);
    setIsHost(false);
  };

  const refreshSession = async () => {
    if (joinCode) await loadSession(joinCode);
  };

  return (
    <SessionContext.Provider value={{ joinCode, sessionData, localMode, isLoading, isHost, toggleLocalMode, createOrJoin, leaveSession, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
