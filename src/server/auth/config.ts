import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { env } from "@/config/env";
import { ensureOAuthUser } from "@/server/auth/provisioning";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * NextAuth v5 configuration.
 *
 * Uses JWT sessions (required for the Credentials provider). Role and status
 * are copied onto the token/session so guards can authorize without an extra
 * DB round-trip. Google OAuth is wired conditionally on env being present.
 *
 * Backend task: complete `authorize`, add Google provider object if enabled,
 * and add the Prisma adapter if/when database sessions are needed.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.passwordHash) return null;
        if (user.status === "DISABLED") return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        };
      },
    }),
    // Google provider is added at runtime in `auth.ts` only when configured.
  ],
  callbacks: {
    /**
     * On OAuth (Google) sign-in, auto-create the user on first login and block
     * disabled accounts. Credentials sign-in is already validated in authorize.
     */
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const result = await ensureOAuthUser({ email: user.email, name: user.name });
        return result === "ok";
      }
      return true;
    },
    /**
     * Carry our DB user id/role/status on the token. For Google (no DB adapter,
     * JWT strategy) we resolve the user by email so token.sub is OUR user id.
     */
    async jwt({ token, user }) {
      if (user) {
        const email = user.email ?? (token.email as string | undefined);
        if (email) {
          const dbUser = await prisma.user.findUnique({ where: { email } });
          if (dbUser) {
            token.sub = dbUser.id;
            token.role = dbUser.role;
            token.status = dbUser.status;
          }
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
      }
      return session;
    },
  },
  secret: env.AUTH_SECRET,
};
