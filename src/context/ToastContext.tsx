'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Automaticky odstranit po 4 sekundách
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Render Area */}
      <div style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        pointerEvents: 'none'
      }}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{
            padding: '1rem 1.5rem',
            background: 'rgba(20, 20, 20, 0.85)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: `1px solid ${getStatusColor(toast.type, 0.3)}`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            color: 'white',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            pointerEvents: 'auto'
          }} className="toast-item">
            <span style={{ fontSize: '18px' }}>{getStatusIcon(toast.type)}</span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

function getStatusColor(type: ToastType, alpha: number) {
  switch (type) {
    case 'success': return `rgba(0, 255, 127, ${alpha})`;
    case 'error': return `rgba(255, 75, 43, ${alpha})`;
    case 'warning': return `rgba(255, 215, 0, ${alpha})`;
    default: return `rgba(0, 191, 255, ${alpha})`;
  }
}

function getStatusIcon(type: ToastType) {
  switch (type) {
    case 'success': return '✅';
    case 'error': return '❌';
    case 'warning': return '⚠️';
    default: return 'ℹ️';
  }
}
