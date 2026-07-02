import { BrandLogo } from "@/components/brand-logo";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <BrandLogo size={44} className="mb-10" />
      <SignInForm />
    </main>
  );
}
