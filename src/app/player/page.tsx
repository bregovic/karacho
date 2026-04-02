import Link from 'next/link';

export default function PlayerPage() {
  return (
    <div style={{ padding: '2rem', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--color-teal)' }}>Karaoke Player</h1>
        <Link href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>Zpět domů</Link>
      </header>
      
      <div className="glass-panel" style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '800px', aspectRatio: '16/9', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
           <h2 style={{ color: 'var(--text-secondary)' }}>Video / Animace písničky</h2>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary">Přehrát / Pauza</button>
          <button className="btn-secondary">Předchozí stopa</button>
          <button className="btn-secondary">Následující stopa</button>
        </div>
      </div>
    </div>
  );
}
