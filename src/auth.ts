import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "@/server/auth/config";
import { env } from "@/config/env";

/**
 * Root NextAuth instance. Import { auth } anywhere on the server to read the
 * session; { handlers } is mounted by the /api/auth/[...nextauth] route.
 *
 * Google is enabled only when both env vars are present, so the app runs
 * without it during early development (Open Question: is Google login required?).
 */
const providers = [...authConfig.providers];
if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      // Always show Google's account chooser. Without it Google silently
      // reuses whichever account the browser is signed into — in the installed
      // PWA that meant logging out and back in always returned the same Gmail,
      // with no way to pick another.
      authorization: { params: { prompt: "select_account" } },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
});
