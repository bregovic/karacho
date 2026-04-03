import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { auth, signIn, signOut } from "@/auth";

const font = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Karacho Karaoke Platform",
  description: "Modern, playful karaoke platform for web, TV, and mobile.",
  icons: [
    { rel: 'icon', url: '/logo.png', type: 'image/png' },
    { rel: 'apple-touch-icon', url: '/logo.png' },
  ]
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="cs">
      <body className={font.className} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <nav style={{ padding: '0.75rem 2rem', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1000 }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            
            {session?.user ? (
              <>
                <a href="/admin" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, fontSize: '15px' }}>Administrace</a>
                <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }}></div>
                <form action={async () => { "use server"; await signOut(); }} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{session.user.name}</span>
                  <button type="submit" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {session.user.image && <img src={session.user.image} alt="Avatar" style={{ width: 20, height: 20, borderRadius: '50%' }} />}
                    Odhlásit
                  </button>
                </form>
              </>
            ) : (
              <a href="/login" style={{ textDecoration: 'none' }}>
                <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>Přihlášení</button>
              </a>
            )}
            
          </div>
        </nav>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
