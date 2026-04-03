import { db } from '@/lib/db';
import { createSong, deleteSong } from '@/app/admin/actions';
import { auth } from '@/auth';
import AudioUploader from '@/components/AudioUploader';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const forceDynamic = true;

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  const songs = await db.song.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: '2rem', color: 'var(--color-gold)' }}>Katalog písní & Správa vývojového cyklu</h1>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <h2>Založit novou píseň do databáze</h2>
        <form action={createSong} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <input name="title" placeholder="Název skladby (např. Slavíci z Madridu)" required style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} />
          <input name="artist" placeholder="Interpret (např. Waldemar Matuška)" style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} />
          <textarea name="lyrics" placeholder="Vložte text písně, který se má předat do Studia a renderovny..." style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', minHeight: '150px' }} />
          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>➕ Přidat píseň do katalogu</button>
        </form>
      </div>

      <h2>Tvé písně na Cloudu</h2>
      
      {songs.length === 0 ? (
         <p style={{ color: 'var(--text-secondary)' }}>Katalog je prázdný.</p>
      ) : (
         <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1.5rem' }}>
          {songs.map((song) => {
            
            // Stavový progress automatizace
            const hasAudio = !!song.audioUrl;
            const hasJson = !!song.jsonUrl;
            const hasVideo = !!song.videoUrl;

            return (
              <div key={song.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.5rem' }}>{song.artist ? `${song.artist} - ` : ''}<span style={{ color: 'var(--color-teal)' }}>{song.title}</span></h3>
                  
                  <form action={async () => {
                      'use server';
                      await deleteSong(song.id);
                    }}>
                    <button type="submit" style={{ background: 'transparent', border: '1px solid rgba(255,0,0,0.5)', color: '#ff4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                      Smazat
                    </button>
                  </form>
                </div>

                {/* Vývojový Cloud Cyklus Písně - Pipeline */}
                <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    
                    {/* FÁZE 1: Audio */}
                    <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '1rem' }}>
                        <h4 style={{ color: hasAudio ? 'var(--color-teal)' : 'var(--text-secondary)', marginBottom: '8px' }}>1. Audio stopa</h4>
                        {hasAudio ? (
                           <div style={{ color: '#0f0', fontSize: '13px' }}>✓ R2 Cloud: {song.audioUrl?.split('/').pop()}</div>
                        ) : (
                           <AudioUploader songId={song.id} />
                        )}
                    </div>

                    {/* FÁZE 2: Designer */}
                    <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '1rem', opacity: hasAudio ? 1 : 0.4 }}>
                        <h4 style={{ color: hasJson ? 'var(--color-teal)' : 'var(--text-secondary)', marginBottom: '8px' }}>2. Časování (Studio)</h4>
                        {hasJson ? (
                           <div style={{ color: '#0f0', fontSize: '13px' }}>✓ Klíčování Hotovo</div>
                        ) : (
                           <div>
                              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>Čeká na zklíčování ve Studiu.</span>
                              <Link href={`/designer?songId=${song.id}`}>
                                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={!hasAudio}>Otevřít ve Studiu</button>
                              </Link>
                           </div>
                        )}
                    </div>

                    {/* FÁZE 3: Renderování */}
                    <div style={{ flex: 1, opacity: hasJson ? 1 : 0.4 }}>
                        <h4 style={{ color: hasVideo ? 'var(--color-teal)' : 'var(--text-secondary)', marginBottom: '8px' }}>3. Video Export</h4>
                        {hasVideo ? (
                          <div style={{ color: '#0f0', fontSize: '13px' }}>✓ Vyrenderováno (R2 Cloud)</div>
                        ) : (
                          <div>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>Čeká kompilaci videa.</span>
                            <Link href={`/renderer?songId=${song.id}`}>
                               <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={!hasJson}>Odeslat do Renderovny</button>
                            </Link>
                          </div>
                        )}
                    </div>

                </div>
              </div>
            );
          })}
         </div>
      )}
    </div>
  );
}
