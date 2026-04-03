"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Něco se pokazilo. Zkuste to znovu.");
      } else {
        setSuccess(true);
        setTimeout(() => { window.location.href = "/login"; }, 1500);
      }
    } catch {
      setError("Připojení selhalo. Zkontrolujte internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '2rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--color-teal)', marginBottom: '0.5rem', fontSize: '2rem' }}>Registrace</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Založit si administrátorský profil Karacho.</p>

        {error && (
          <div style={{ background: 'rgba(255,0,0,0.1)', color: '#ff6b6b', padding: '12px', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,0,0,0.3)' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background: 'rgba(0,200,100,0.1)', color: '#4ade80', padding: '12px', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(0,200,100,0.3)' }}>
            Účet vytvořen! Přesměrovávám na přihlášení...
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            name="name" type="text" placeholder="Vaše Jméno" required 
            style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', fontSize: '15px' }} 
          />
          <input 
            name="email" type="email" placeholder="vas@email.cz" required 
            style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', fontSize: '15px' }} 
          />
          <input 
            name="password" type="password" placeholder="Bezpečné heslo (min. 6 znaků)" minLength={6} required 
            style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', fontSize: '15px' }} 
          />

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary" 
            style={{ marginTop: '0.5rem', padding: '12px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Registruji..." : "Zaregistrovat"}
          </button>
        </form>

        <div style={{ marginTop: '2rem', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Již máte účet? <Link href="/login" style={{ color: 'var(--color-gold)', textDecoration: 'none' }}>Přihlásit se</Link>
        </div>
      </div>
    </div>
  );
}
