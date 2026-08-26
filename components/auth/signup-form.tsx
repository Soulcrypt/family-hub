import { AuthForm } from "@/components/auth/auth-form";

/** See components/auth/login-form.tsx's identical doc comment. */
export function SignUpForm({ next }: { next?: string }) {
  return <AuthForm mode="signUp" next={next} />;
}
