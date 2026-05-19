// Placeholder until Phase 5 wires the deep evaluation pipeline.
import Link from 'next/link';

export default function Evaluate() {
  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold">Evaluate</h1>
      <p className="text-ink-400 mono text-sm">
        Deep evaluation lands in Phase 5. For now, triage candidates from the inbox.
      </p>
      <Link href="/" className="mono inline-block text-sm px-3 py-1.5 border border-ink-300 text-ink-100 hover:bg-ink-700">← back to inbox</Link>
    </main>
  );
}
