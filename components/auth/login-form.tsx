import { AuthForm } from "@/components/auth/auth-form";

/**
 * See components/auth/auth-form.tsx's doc comment: the sign-in and create-account screens
 * share one implementation (mock 4b's segmented control switches between them on one visual
 * screen) — this file stays a thin, separately-named wrapper purely so
 * app/(auth)/login/page.tsx's import (`{ LoginForm }`) and its Server Component `searchParams`
 * plumbing for `next` (see that file's own doc comment) don't need to change.
 */
export function LoginForm({ next }: { next?: string }) {
  return <AuthForm mode="signIn" next={next} />;
}
