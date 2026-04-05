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
          await createOrJoin(code);
          router.push('/'); // Přesměrování na hlavní katalog po joinu
        } catch (err) {
          console.error("Join failed:", err);
          alert("Nepodařilo se připojit k relaci. Zkontrolujte kód.");
          router.push('/');
        }
      }
    };
    doJoin();
  }, [code]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000', color: '#fff' }}>
      <div className="hero-logo-wrap" style={{ marginBottom: '2rem' }}>
        <img src="/logo.png" alt="Karacho" style={{ width: '80px', borderRadius: '16px' }} />
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-gold)' }}>PŘIPOJOVÁNÍ...</h1>
      <p style={{ opacity: 0.7 }}>Vstupujete do karaoke relace {code}</p>
      
      <style jsx>{`
        .hero-logo-wrap {
          animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
