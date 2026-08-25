export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl">You&rsquo;re offline</h1>
      <p className="text-lg text-muted-foreground">
        Family Hub will reconnect on its own as soon as you&rsquo;re back online.
      </p>
    </main>
  );
}
