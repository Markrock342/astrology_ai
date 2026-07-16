/**
 * Whether the public landing (`/`) should redirect a logged-in user to the app.
 * Preview mode must win so admin "ดูตัวอย่าง" can show the draft landing.
 */
export function shouldRedirectLoggedInFromLanding(input: {
  isLoggedIn: boolean;
  isPreview: boolean;
}): boolean {
  return input.isLoggedIn && !input.isPreview;
}
