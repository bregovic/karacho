"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Neplatný email nebo heslo. Zkuste to znovu.");
    } else {
      window.location.href = "/admin";
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '2rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--color-teal)', marginBottom: '0.5rem', fontSize: '2rem' }}>Přihlášení</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Do administrátorského profilu Karacho.</p>

        {error && (
          <div style={{ background: 'rgba(255,0,0,0.1)', color: '#ff6b6b', padding: '12px', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,0,0,0.3)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            name="email" type="email" placeholder="vas@email.cz" required 
            style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', fontSize: '15px' }} 
          />
          <input 
            name="password" type="password" placeholder="Heslo" required 
            style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', fontSize: '15px' }} 
          />

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary" 
            style={{ marginTop: '0.5rem', padding: '12px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Přihlašuji..." : "Přihlásit do Studia"}
          </button>
        </form>

        <div style={{ marginTop: '2rem', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Nemáte účet? <Link href="/register" style={{ color: 'var(--color-gold)', textDecoration: 'none' }}>Zaregistrovat se</Link>
        </div>
      </div>
    </div>
  );
}
