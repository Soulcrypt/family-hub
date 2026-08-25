import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-10 px-6 text-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl">Family Hub</h1>
        <p className="text-lg text-muted-foreground">
          Meals, plans, chores and days — for everyone under one roof.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button asChild size="lg"><Link href="/signup">Get started</Link></Button>
        <Button asChild size="lg" variant="outline"><Link href="/login">I already have an account</Link></Button>
      </div>
    </main>
  );
}
