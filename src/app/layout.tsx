import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Karacho Karaoke Platform",
  description: "Modern, playful karaoke platform for web, TV, and mobile.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className={inter.className} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <nav style={{ padding: '1rem 2rem', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1000 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}>
              <img src="/logo.png" alt="Karacho Logo" style={{ height: '36px', objectFit: 'contain' }} />
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Karacho<span style={{ color: 'var(--color-teal)' }}>.</span></span>
            </a>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <a href="/admin" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, fontSize: '15px' }}>Katalog písní</a>
            <a href="/designer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, fontSize: '15px' }}>Studio</a>
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }}></div>
            {/* Zástupce pro přihlášení, než nasadíme Auth.js */}
            <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>Přihlásit se</button>
          </div>
        </nav>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
