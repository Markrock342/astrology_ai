"use client";

import { LoginPanel } from "./login-panel";
import { RegisterPanel } from "./register-panel";

/** Two-panel auth surface: login (left) + register (right), stacks on mobile. */
export function AuthPanels({ googleEnabled = false }: { googleEnabled?: boolean }) {
  return (
    <div className="animate-fade-up grid w-full max-w-4xl gap-4 md:grid-cols-2 md:gap-6">
      <LoginPanel />
      <RegisterPanel googleEnabled={googleEnabled} />
    </div>
  );
}
