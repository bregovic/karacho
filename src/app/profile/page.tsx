import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  // Načtení všech uživatelů pro admina
  const allUsers = isAdmin 
    ? await db.user.findMany({ orderBy: { name: 'asc' } })
    : [];

  async function promoteToAdmin(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    if (!email) return;

    await db.user.update({
      where: { email },
      data: { role: "ADMIN" }
    });
    revalidatePath("/profile");
  }

  return (
    <div style={{ padding: 'clamp(1rem, 4vw, 2.5rem)', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'black', fontWeight: 600 }}>
             {session.user.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 style={{ margin: 0 }}>{session.user.name}</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0' }}>{session.user.email}</p>
            <span style={{ display: 'inline-block', background: isAdmin ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)', color: isAdmin ? 'black' : 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, marginTop: '8px' }}>
              {isAdmin ? 'ADMINISTRÁTOR' : 'Uživatel / Artist'}
            </span>
          </div>
        </div>

        {isAdmin && (
           <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Rychlá administrace</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  <Link href="/admin" style={{ textDecoration: 'none' }}>
                    <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--color-teal)', transition: 'transform 0.2s', cursor: 'pointer' }}>
                       <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎶</div>
                       <h3 style={{ margin: 0, color: 'var(--color-teal)' }}>Správa Písní</h3>
                       <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>Editace katalogu, přidávání MP3, klíčování a spouštění renderu.</p>
                    </div>
                  </Link>

                  <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--color-gold)' }}>
                     <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚡</div>
                     <h3 style={{ margin: 0, color: 'var(--color-gold)' }}>Export & Studio</h3>
                     <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>Přejít přímo do Designera nebo sledovat frontu renderu.</p>
                  </div>
              </div>
           </div>
        )}
      </div>

      {isAdmin && (
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Správa přístupů (Admins)</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Přidejte dalšího administrátora zadáním jeho registrovaného emailu.</p>
          
          <form action={promoteToAdmin} style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem' }}>
            <input 
              name="email" 
              type="email" 
              placeholder="email@example.cz" 
              required 
              style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px' }} 
            />
            <button type="submit" className="btn-primary" style={{ padding: '10px 20px' }}>Povýšit na Admina</button>
          </form>

          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Tým Karacho</h3>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
            {allUsers.map((u) => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{u.name}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px', marginLeft: '10px' }}>{u.email}</span>
                </div>
                <span style={{ fontSize: '11px', background: u.role === 'ADMIN' ? 'rgba(255, 184, 0, 0.1)' : 'rgba(255,255,255,0.05)', color: u.role === 'ADMIN' ? 'var(--color-gold)' : 'var(--text-secondary)', padding: '2px 10px', borderRadius: '12px', fontWeight: 600 }}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
