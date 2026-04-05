import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { auth, signOut } from "@/auth";
import AuthProvider from "@/components/AuthProvider";
import { SessionProvider } from "@/context/SessionContext";
import HeaderSessionInfo from "@/components/HeaderSessionInfo";
import GlobalEscape from "@/components/GlobalEscape";

const font = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Karacho Karaoke Platform",
  description: "Modern, playful karaoke platform for web, TV, and mobile.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="cs">
      <body className={font.className} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#000', color: '#fff' }}>
        <AuthProvider>
          <SessionProvider>
            <GlobalEscape />
            <nav style={{ 
              padding: '0.75rem clamp(1rem, 4vw, 2.5rem)', 
              background: 'rgba(0,0,0,0.3)', 
              backdropFilter: 'blur(20px)', 
              borderBottom: '1px solid rgba(255,255,255,0.05)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              position: 'sticky', 
              top: 0, 
              zIndex: 1000 
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
                  <img src="/icon.png" alt="Karacho Logo" style={{ width: '42px', height: '42px', borderRadius: '8px' }} />
                  <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--color-gold)', letterSpacing: '-0.04em' }}>KARACHO</span>
                </a>
                <HeaderSessionInfo />
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                
                {session?.user ? (
                  <>
                    {session.user.role === 'ADMIN' && (
                       <a href="/admin" style={{ color: '#fff', textDecoration: 'none', fontSize: '16px', fontWeight: 600, opacity: 0.85 }}>Admin</a>
                    )}
                    <form action={async () => { "use server"; await signOut(); }}>
                      <button type="submit" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px', fontWeight: 500, opacity: 0.85 }}>
                        Odhlásit
                      </button>
                    </form>
                  </>
                ) : (
                  <a href="/api/auth/signin" style={{ color: '#fff', textDecoration: 'none', fontSize: '16px', fontWeight: 600, opacity: 0.85 }}>Přihlásit</a>
                )}
              </div>
            </nav>
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {children}
            </main>
          </SessionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
