import Link from 'next/link';
import { evaluateManual } from '../actions.js';

export const dynamic = 'force-dynamic';

export default function EvaluatePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manual evaluation</h1>
          <p className="mt-1 text-sm mono text-ink-400">type a niche and metro, run the deep pipeline</p>
        </div>
        <nav className="flex gap-2 mono text-sm">
          <Link href="/" className="px-3 py-1.5 border border-ink-600 text-ink-300 hover:bg-ink-700">inbox</Link>
          <Link href="/evaluate" className="px-3 py-1.5 border border-ink-300 text-ink-100">evaluate</Link>
          <Link href="/evaluations" className="px-3 py-1.5 border border-ink-600 text-ink-300 hover:bg-ink-700">history</Link>
        </nav>
      </header>

      <form action={evaluateManual} className="border border-ink-600 bg-ink-800 p-6 space-y-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs mono uppercase tracking-wider text-ink-400">niche</span>
          <input name="niche" required placeholder="e.g. mobile dog grooming"
            className="mono bg-ink-900 border border-ink-600 px-3 py-2 text-base text-ink-100 focus:border-ink-300 focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs mono uppercase tracking-wider text-ink-400">metro</span>
          <input name="metro" required placeholder="e.g. DFW, or national"
            className="mono bg-ink-900 border border-ink-600 px-3 py-2 text-base text-ink-100 focus:border-ink-300 focus:outline-none" />
        </label>
        <div className="flex flex-col gap-2 pt-2">
          <button type="submit"
            className="mono text-sm px-4 py-2 border border-emerald-500 text-emerald-300 bg-emerald-900/20 hover:bg-emerald-900/40">
            run evaluation
          </button>
          <p className="text-[11px] mono text-ink-500">
            this submits to Google Places + DataforSEO + Trends + Sonnet. one run takes 30 to 90 seconds and costs roughly $1 to $3 in paid api spend.
          </p>
        </div>
      </form>
    </main>
  );
}
