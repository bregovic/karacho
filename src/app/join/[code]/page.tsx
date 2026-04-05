'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from '@/context/SessionContext';

export default function JoinPage() {
  const { code } = useParams();
  const { createOrJoin } = useSession();
  const router = useRouter();

  useEffect(() => {
    const doJoin = async () => {
      if (code && typeof code === 'string') {
        try {
          const joinedCode = await createOrJoin(code);
          console.log("Successfully joined:", joinedCode);
          // Malý delay pro jistotu, že context stihl zareagovat
          setTimeout(() => {
            router.push('/');
          }, 500);
        } catch (err) {
          console.error("Join failed:", err);
          alert("Nepodařilo se připojit k show. Možná už skončila?");
          router.push('/');
        }
      }
    };
    doJoin();
  }, [code]);

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
      height: '100vh', background: 'radial-gradient(circle at center, #0a0a1a 0%, #000 100%)', 
      color: '#fff', textAlign: 'center', padding: '2rem' 
    }}>
      <div className="entrance-wrap" style={{ position: 'relative', zIndex: 10 }}>
        <div className="logo-glow-wrap" style={{ marginBottom: '3rem' }}>
          <img src="/logo.png" alt="Karacho" style={{ width: '140px', borderRadius: '28px', boxShadow: '0 0 50px rgba(255,215,0,0.3)' }} />
          <div className="scanner-line"></div>
        </div>
        
        <h1 style={{ 
          fontSize: '32px', fontWeight: 900, color: 'var(--color-gold)', 
          letterSpacing: '0.1em', marginBottom: '1rem', textShadow: '0 0 20px rgba(255,215,0,0.4)' 
        }}>
          PŘIPOJOVÁNÍ...
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', opacity: 0.6 }}>
          <span style={{ fontSize: '20px' }}>🎤</span>
          <p style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Vstupujete do show # <span style={{ color: 'var(--color-gold)' }}>{code}</span></p>
        </div>

        <div className="loading-bar-wrap" style={{ marginTop: '3rem', width: '200px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', margin: '3rem auto 0' }}>
           <div className="loading-progress"></div>
        </div>
      </div>
      
      <style jsx>{`
        .entrance-wrap {
          animation: slideUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .logo-glow-wrap {
          position: relative;
          animation: float 3s infinite ease-in-out;
        }
        .scanner-line {
          position: absolute;
          top: 0; left: 0; right: 0; height: 2px;
          background: var(--color-gold);
          box-shadow: 0 0 15px var(--color-gold);
          animation: scan 2s infinite linear;
          opacity: 0.5;
        }
        .loading-progress {
          width: 40%;
          height: 100%;
          background: var(--color-gold);
          box-shadow: 0 0 15px var(--color-gold);
          animation: moveProgress 1.5s infinite ease-in-out;
        }
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes moveProgress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}
