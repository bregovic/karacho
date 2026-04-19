import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { auth, signOut } from "@/auth";
import AuthProvider from "@/components/AuthProvider";
import { SessionProvider } from "@/context/SessionContext";
import HeaderSessionInfo from "@/components/HeaderSessionInfo";
import GlobalEscape from "@/components/GlobalEscape";
import TopHamburger from "@/components/TopHamburger";
import GlobalRequestModal from "@/components/GlobalRequestModal";
import GlobalMiniPlayer from "@/components/GlobalMiniPlayer";

const font = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Karacho Karaoke Platform",
  description: "Modern, playful karaoke platform for web, TV, and mobile.",
  manifest: "/manifest.json",
  themeColor: "#ffd700",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Karacho",
  },
};

import { ToastProvider } from "@/context/ToastContext";

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
          <ToastProvider>
            <SessionProvider>
            <GlobalEscape />
            <GlobalRequestModal />
            <nav style={{ 
              padding: '1rem clamp(1rem, 3vw, 4rem)', 
              background: 'rgba(0,0,0,0.6)', 
              backdropFilter: 'blur(30px)', 
              borderBottom: '1px solid rgba(255,255,255,0.08)', 
              display: 'flex', 
              flexWrap: 'wrap',
              justifyContent: 'space-between', 
              alignItems: 'center', 
              position: 'sticky', 
              top: 0, 
              zIndex: 1000 
            }}>
              {/* VLEVO: Logo + ID */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                  <img src="/logo.png" alt="Karacho Logo" className="header-logo-img" />
                </a>
                <div style={{ marginLeft: '4px' }} className="header-session-info-wrap">
                  <HeaderSessionInfo />
                </div>
              </div>

              {/* STŘED: Přehrávač (na mobilu se zalomí pod) */}
              <div className="header-player-wrapper" style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 'min(100%, 300px)' }}>
                <GlobalMiniPlayer />
              </div>

              {/* VPRAVO: Hamburger */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <TopHamburger 
                  isAdmin={session?.user?.role === 'ADMIN'} 
                  isAuthenticated={!!session?.user} 
                />
              </div>
            </nav>

            <style>{`
              .header-logo-img { width: auto; height: 54px; border-radius: 12px; transition: all 0.3s; }
              .header-title { fontSize: 30px; fontWeight: 900; color: var(--color-gold); letterSpacing: -0.06em; textShadow: 0 0 20px rgba(255,215,0,0.2); transition: all 0.3s; }
              
              @media (max-width: 600px) {
                .header-logo-img { height: 44px; border-radius: 10px; }
                .header-title { fontSize: 22px; }
                .hide-mobile { display: none; }
                .header-session-info-wrap { transform: scale(0.85); transform-origin: left; }
                .header-player-wrapper { display: none !important; }
                nav { flex-wrap: nowrap !important; }
              }
            `}</style>
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {children}
            </main>
          </SessionProvider>
        </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
