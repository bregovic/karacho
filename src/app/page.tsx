import { db } from "@/lib/db";
import Link from "next/link";
import { auth } from "@/auth";

export const forceDynamic = true;

export default async function Home() {
  const session = await auth();
  const isAdmin = !!session?.user;

  // Veřejnosti ukážeme jen písně, které už mají Video nebo nějakou stopu.
  // Ale adminovi ukážeme všechny i rozpracované.
  const songs = await db.song.findMany({
    where: isAdmin ? undefined : { videoUrl: { not: null } },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Veřejný katalog písní */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
         <h1 style={{ fontSize: '3rem', color: 'var(--text-primary)' }}>Vyberte si <span style={{ color: 'var(--color-teal)' }}>Karacho.</span></h1>
         <p style={{ color: 'var(--text-secondary)' }}>Katalog hotových karaoke skladeb připravených k přehrání.</p>
      </div>

      {songs.length === 0 ? (
         <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem' }}>
            {isAdmin ? "Katalog je zatím prázdný. Běžte do administrace přidat první píseň." : "Zatím zde nejsou žádné publikované skladby."}
         </div>
      ) : (
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
           {songs.map((song: any) => (
              <div key={song.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'transform 0.2s', cursor: 'pointer' }}>
                <h3 style={{ fontSize: '1.4rem' }}>
                  {song.artist ? <span style={{ opacity: 0.7, fontSize: '1.1rem', display: 'block' }}>{song.artist}</span> : null}
                  {song.title}
                </h3>
                
                <div style={{ flex: 1 }}></div>

                {song.videoUrl ? (
                   <Link href={`/player?songId=${song.id}`} style={{ textDecoration: 'none' }}>
                     <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                       ▶ Přehrát Karaoke
                     </button>
                   </Link>
                ) : (
                   <button className="btn-secondary" disabled style={{ width: '100%', opacity: 0.5 }}>
                     Připravuje se...
                   </button>
                )}

                {isAdmin && (
                  <Link href="/admin" style={{ textDecoration: 'none', textAlign: 'center', fontSize: '12px', color: 'var(--color-gold)', marginTop: '8px', display: 'block' }}>
                    ⚙️ Upravit v Administraci
                  </Link>
                )}
              </div>
           ))}
         </div>
      )}
    </div>
  );
}
