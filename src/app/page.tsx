import Link from "next/link";

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', gap: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '600px' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '1rem', color: 'var(--color-teal)' }}>Karacho</h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Modern. Playful. Synchronized. The ultimate Karaoke platform.
        </p>
      </div>

      <div className="glass-panel" style={{ display: 'flex', gap: '1.5rem', padding: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/player" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Join Session
        </Link>
        <Link href="/designer" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Timing Designer
        </Link>
        <Link href="/admin" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Admin Dashboard
        </Link>
      </div>
    </div>
  );
}
