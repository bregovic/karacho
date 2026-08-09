import NextAuth, { type DefaultSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { Role } from "@prisma/client"
import { authConfig } from "@/auth.config"

// Rozšíření typů přímo v hlavním modulu next-auth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"]
  }

  interface User {
    id?: string;
    role?: Role;
  }
}

// Plný config (Node runtime). Společná pravidla i callbacky jsou v auth.config.ts,
// aby je middleware mohlo použít bez Prismy – tady se jen dolepí provider.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Heslo", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const normalizedEmail = (credentials.email as string).toLowerCase().trim();
        const user = await db.user.findUnique({
          where: { email: normalizedEmail }
        });
        
        if (!user || !user.password) return null;
        
        const isCorrect = await bcrypt.compare(credentials.password as string, user.password);
        if (!isCorrect) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      }
    })
  ],
})
