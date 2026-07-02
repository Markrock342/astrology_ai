import { redirect } from "next/navigation";

/**
 * Design decision: no separate register page — the single sign-in surface
 * (Google + email) auto-creates the account on first use. Kept as a redirect
 * so any old links / bookmarks still land on the right place.
 */
export default function RegisterPage() {
  redirect("/login");
}
