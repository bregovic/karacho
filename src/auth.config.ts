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
      let povoleno = true;
      if (ADMIN_PREFIXES.some((x) => p.startsWith(x))) povoleno = auth?.user?.role === "ADMIN";
      else if (USER_PREFIXES.some((x) => p.startsWith(x))) povoleno = !!auth?.user;
      if (povoleno) return true;

      /*
       * Přesměrování na přihlášení si skládáme sami. Výchozí z Auth.js bere
       * adresu z `request.url`, a ta je za proxy Railway interní
       * („https://0.0.0.0:8080/…") – po přihlášení by to vedlo do prázdna.
       * Veřejnou adresu nese `x-forwarded-host`; zpáteční cesta jde jen
       * relativně, aby přes ni nešlo poslat uživatele na cizí web.
       */
      const h = request.headers;
      const host = h.get("x-forwarded-host") ?? h.get("host") ?? request.nextUrl.host;
      const proto = (h.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")).split(",")[0];
      const zpet = p + request.nextUrl.search;
      return Response.redirect(`${proto}://${host}/login?callbackUrl=${encodeURIComponent(zpet)}`, 307);
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
