import { SignUpForm } from "@/components/auth/signup-form";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <SignUpForm next={next} />;
}
