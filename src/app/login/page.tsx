import { signIn } from "@/auth";
import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  
  async function handleLogin(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", formData);
    } catch (error) {
      if (error instanceof AuthError) {
         redirect("/login?error=CredentialsSignin");
      }
      throw error;
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '2rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--color-teal)', marginBottom: '0.5rem', fontSize: '2rem' }}>Přihlášení</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Do administrátorského profilu Karacho.</p>

        {searchParams?.error && (
            <div style={{ background: 'rgba(255,0,0,0.1)', color: '#ff4444', padding: '12px', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,0,0,0.3)' }}>
              Neplatný email nebo heslo. Zkuste to znovu.
            </div>
        )}

        <form action={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            name="email" type="email" placeholder="vas@email.cz" required 
            style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} 
          />
          <input 
            name="password" type="password" placeholder="Heslo" required 
            style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }} 
          />
          
          {/* Default NextAuth redirection route behavior */}
          <input type="hidden" name="redirectTo" value="/admin" />

          <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', padding: '12px' }}>Přihlásit do Studia</button>
        </form>

        <div style={{ marginTop: '2rem', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Nemáte účet? <Link href="/register" style={{ color: 'var(--color-gold)', textDecoration: 'none' }}>Zaregistrovat se</Link>
        </div>
      </div>
    </div>
  );
}
