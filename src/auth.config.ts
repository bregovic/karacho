import type { NextAuthConfig } from "next-auth";

/**
 * Lehká konfigurace BEZ Prismy a bcryptu – používá ji `middleware.ts`, které
 * běží v Edge runtime a databázový klient by v něm neprošel. Provider
 * s Prismou je až v `auth.ts` (Node runtime).
 *
 * Přístupová pravidla jsou schválně na jednom místě: bez middleware se každá
 * stránka musela bránit sama a tři admin stránky se bránit zapomněly.
 */

/** Cesty jen pro ADMIN – katalog, technické konfigurace, timing editor. */
const ADMIN_PREFIXES = ["/admin", "/designer"];
/** Cesty jen pro přihlášené (profil s osobními údaji a historií). */
const USER_PREFIXES = ["/profile"];

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const p = request.nextUrl.pathname;
      // Host v baru se nepřihlašuje – katalog, přehrávač, join i renderer
      // musí zůstat veřejné, jinak se nikdo nezazpívá.
      if (ADMIN_PREFIXES.some((x) => p.startsWith(x)))
        return auth?.user?.role === "ADMIN";
      if (USER_PREFIXES.some((x) => p.startsWith(x))) return !!auth?.user;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        (token as Record<string, unknown>).role = (user as { role?: string }).role;
        (token as Record<string, unknown>).id = (user as { id?: string }).id;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        const t = token as Record<string, unknown>;
        session.user.role = t.role as typeof session.user.role;
        session.user.id = t.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
