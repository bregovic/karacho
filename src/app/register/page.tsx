import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {

  async function handleRegister(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password || !name) return;

    // Kontrola existence
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
       redirect("/register?error=EmailTaken");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      }
    });

    redirect("/login?success=Registered");
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '2rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--color-teal)', marginBottom: '0.5rem', fontSize: '2rem' }}>Registrace</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Založit si administrátorský profil Karacho.</p>

        <form action={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            name="name" type="text" placeholder="Vaše Jméno" required 
            style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} 
          />
          <input 
            name="email" type="email" placeholder="vas@email.cz" required 
            style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} 
          />
          <input 
            name="password" type="password" placeholder="Bezpečné heslo" minLength={6} required 
            style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} 
          />

          <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', padding: '12px' }}>Zaregistrovat</button>
        </form>

        <div style={{ marginTop: '2rem', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Již máte účet? <Link href="/login" style={{ color: 'var(--color-gold)', textDecoration: 'none' }}>Přihlásit se</Link>
        </div>
      </div>
    </div>
  );
}
