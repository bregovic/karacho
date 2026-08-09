import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Plošná ochrana rout. Kdo kam smí, řeší callback `authorized`
// v auth.config.ts – middleware jede v Edge runtime, takže bez Prismy.
export default NextAuth(authConfig).auth;

export const config = {
  // Statika a auth endpointy se nekontrolují (jinak by nešlo se přihlásit).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|jpeg|svg|webp|mp3|mp4|ico)$).*)"],
};
