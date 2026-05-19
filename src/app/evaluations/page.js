import Link from 'next/link';
import { listEvaluations } from '../../lib/db.js';
import { HistoryTable } from '../../components/HistoryTable.jsx';

export const dynamic = 'force-dynamic';

export default async function EvaluationsHistoryPage() {
  const rows = await listEvaluations({ limit: 200 });
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evaluation history</h1>
          <p className="mt-1 text-sm mono text-ink-400">{rows.length} evaluation{rows.length === 1 ? '' : 's'}</p>
        </div>
        <nav className="flex gap-2 mono text-sm">
          <Link href="/" className="px-3 py-1.5 border border-ink-600 text-ink-300 hover:bg-ink-700">inbox</Link>
          <Link href="/evaluate" className="px-3 py-1.5 border border-ink-600 text-ink-300 hover:bg-ink-700">evaluate</Link>
          <Link href="/evaluations" className="px-3 py-1.5 border border-ink-300 text-ink-100">history</Link>
        </nav>
      </header>
      <HistoryTable rows={rows} />
    </main>
  );
}
