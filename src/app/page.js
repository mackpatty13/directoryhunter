export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Directory Hunter</h1>
      <p className="mt-3 text-ink-300">
        Phase 1 scaffold. The discovery inbox lands in Phase 4.
      </p>

      <section className="mt-12 border border-ink-600 p-6">
        <h2 className="text-sm uppercase tracking-widest text-ink-400">Build status</h2>
        <ul className="mt-4 space-y-2 mono text-sm">
          <li>[x] Phase 1: scaffold, db schema, first scanner</li>
          <li>[ ] Phase 2: storage + Haiku scoring</li>
          <li>[ ] Phase 3: remaining scanners</li>
          <li>[ ] Phase 4: discovery UI</li>
          <li>[ ] Phase 5: evaluation pipeline</li>
          <li>[ ] Phase 6: Outscraper sampler + digest</li>
          <li>[ ] Phase 7: Vercel + Railway deploy</li>
        </ul>
      </section>
    </main>
  );
}
