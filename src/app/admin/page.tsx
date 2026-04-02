import Link from 'next/link';
import { db } from '@/lib/db';
import { createSong } from './actions';

export default async function AdminPage() {
  const songs = await db.song.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--color-teal)' }}>Admin Rozhraní</h1>
        <Link href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>Zpět domů</Link>
      </header>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Formulář pro přidání */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--color-gold)' }}>Přidat novou píseň</h2>
          <form action={createSong} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Název písně *</label>
              <input name="title" required type="text" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: '#fff' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Interpret / Autor</label>
              <input name="author" type="text" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: '#fff' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Max znaků na řádek (blok)</label>
              <input name="maxBlockChars" type="number" defaultValue={40} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: '#fff' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Plný text písně (Lyrics)</label>
              <textarea name="lyrics" rows={6} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontFamily: 'inherit', resize: 'vertical' }}></textarea>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>Uložit do databáze</button>
          </form>
        </div>

        {/* Seznam písní */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--color-gold)' }}>Katalog písní ({songs.length})</h2>
          {songs.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Zatím zde nejsou žádné písně.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {songs.map(song => (
                <div key={song.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ color: '#fff', marginBottom: '4px' }}>{song.title}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{song.author} • Limit: {song.maxBlockChars} znaků</p>
                  </div>
                  <Link href={`/designer?songId=${song.id}`} className="btn-secondary" style={{ padding: '8px 16px', textDecoration: 'none', fontSize: '14px' }}>
                    Otevřít v Designeru
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
