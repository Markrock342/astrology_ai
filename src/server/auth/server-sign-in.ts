import { signIn } from "@/auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

/**
 * Programmatic credentials sign-in from a Route Handler.
 * NextAuth v5 may throw NEXT_REDIRECT even with redirect:false — treat that as success.
 */
export async function signInCredentials(
  email: string,
  password: string,
): Promise<"ok" | "invalid"> {
  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    // In Route Handlers, success is often a redirect URL string, not { ok, error }.
    if (typeof result === "string") return "ok";

    if (
      result &&
      typeof result === "object" &&
      "error" in result &&
      (result as { error?: string }).error
    ) {
      return "invalid";
    }

    return "ok";
  } catch (err) {
    if (isRedirectError(err)) return "ok";
    throw err;
  }
}
