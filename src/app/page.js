import Link from 'next/link';
import { listCandidates, getCandidateFacets } from '../lib/db.js';
import { CandidateCard } from '../components/CandidateCard.jsx';
import { FilterBar } from '../components/FilterBar.jsx';

export const dynamic = 'force-dynamic';

function parseFilters(searchParams) {
  const minScore = searchParams.minScore ? parseInt(searchParams.minScore, 10) : null;
  const page = searchParams.page ? Math.max(1, parseInt(searchParams.page, 10)) : 1;
  return {
    status: searchParams.status || 'active',
    minScore: Number.isFinite(minScore) ? minScore : null,
    source: searchParams.source || null,
    category: searchParams.category || null,
    q: searchParams.q || null,
    page,
    pageSize: 25
  };
}

function buildPageHref(filters, page) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (k === 'page' || k === 'pageSize') continue;
    if (v !== null && v !== undefined && v !== '') params.set(k, String(v));
  }
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

export default async function Home({ searchParams }) {
  const filters = parseFilters(searchParams ?? {});
  const [{ rows, total, totalPages }, facets] = await Promise.all([
    listCandidates(filters),
    getCandidateFacets()
  ]);

  const totalAll = facets.total;
  const archivedCount = facets.statuses.archived ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Directory Hunter</h1>
          <p className="mt-1 text-sm mono text-ink-400">
            {totalAll} candidate{totalAll === 1 ? '' : 's'} total, {archivedCount} archived
          </p>
        </div>
        <nav className="flex gap-2 mono text-sm">
          <Link href="/" className="px-3 py-1.5 border border-ink-300 text-ink-100">inbox</Link>
          <Link href="/evaluate" className="px-3 py-1.5 border border-ink-600 text-ink-300 hover:bg-ink-700">evaluate</Link>
          <Link href="/evaluations" className="px-3 py-1.5 border border-ink-600 text-ink-300 hover:bg-ink-700">history</Link>
        </nav>
      </header>

      <FilterBar filters={filters} facets={facets} />

      <div className="text-xs mono text-ink-400 flex items-center justify-between">
        <span>showing {rows.length} of {total} match{total === 1 ? '' : 'es'}</span>
        <span>page {filters.page} / {totalPages}</span>
      </div>

      <section className="space-y-3">
        {rows.length === 0 && (
          <div className="border border-ink-600 bg-ink-800 p-8 text-center text-ink-400 mono text-sm">
            nothing matches these filters
          </div>
        )}
        {rows.map(row => <CandidateCard key={row.id} row={row} />)}
      </section>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between mono text-sm pt-4">
          <Link
            href={buildPageHref(filters, Math.max(1, filters.page - 1))}
            className={`px-3 py-1.5 border ${filters.page === 1 ? 'border-ink-700 text-ink-600 pointer-events-none' : 'border-ink-500 text-ink-200 hover:bg-ink-700'}`}>
            ← prev
          </Link>
          <span className="text-ink-400">page {filters.page} of {totalPages}</span>
          <Link
            href={buildPageHref(filters, Math.min(totalPages, filters.page + 1))}
            className={`px-3 py-1.5 border ${filters.page === totalPages ? 'border-ink-700 text-ink-600 pointer-events-none' : 'border-ink-500 text-ink-200 hover:bg-ink-700'}`}>
            next →
          </Link>
        </nav>
      )}
    </main>
  );
}
