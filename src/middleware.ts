import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Plošná ochrana rout. Kdo kam smí, řeší callback `authorized`
// v auth.config.ts – middleware jede v Edge runtime, takže bez Prismy.
export default NextAuth(authConfig).auth;

export const config = {
  // Statika a auth endpointy se nekontrolují (jinak by nešlo se přihlásit).
  //
  // `api/upload` je vynechané schválně: když middleware (proxy) na routu sedí,
  // Next si tělo požadavku bufferuje do paměti a od `proxyClientMaxBodySize`
  // (výchozí 10 MB) ho **mlčky uřízne**. Route handler pak dostane useknutý
  // multipart a `req.formData()` spadne na „Failed to parse body as FormData".
  // Projevilo se to u MP3 nad 10 MB. Autorizaci si /api/upload dělá sám
  // (`auth()` hned na začátku), middleware tu stejně jen vracelo `true`.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/upload|.*\\.(?:png|jpg|jpeg|svg|webp|mp3|mp4|ico)$).*)"],
};
