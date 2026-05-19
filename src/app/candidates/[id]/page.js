import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCandidateById, getSourcesMap } from '../../../lib/db.js';
import { ScoreBadge, CategoryChip, StatusChip } from '../../../components/ScoreBadge.jsx';
import { StatusActions } from '../../../components/StatusActions.jsx';
import { evaluateCandidate } from '../../actions.js';

export const dynamic = 'force-dynamic';

function fmtCurrency(n) {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
}

export default async function CandidateDetail({ params }) {
  const row = await getCandidateById(params.id);
  if (!row) notFound();

  const sourcesMap = await getSourcesMap();
  const sourceName = sourcesMap[row.source_id] || row.source_id;

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
      <header className="flex items-center justify-between mono text-sm">
        <Link href="/" className="text-ink-400 hover:text-ink-100">← back to inbox</Link>
        <span className="text-ink-500 truncate max-w-md">{row.id}</span>
      </header>

      <section className="border border-ink-600 bg-ink-800 p-6 space-y-4">
        <div className="flex items-start gap-5">
          <ScoreBadge score={row.discovery_score} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{row.niche_canonical || row.niche_raw}</h1>
            {row.niche_canonical && row.niche_raw && row.niche_canonical !== row.niche_raw && (
              <p className="text-xs mono text-ink-500 mt-1">raw: {row.niche_raw}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <CategoryChip category={row.discovery_category} />
              <StatusChip status={row.status} />
              <span className="mono text-[10px] uppercase tracking-wider border border-ink-600 text-ink-400 px-1.5 h-5 inline-flex items-center">
                {sourceName}
              </span>
            </div>
          </div>
        </div>

        {row.fit_reasoning && (
          <div className="text-sm leading-relaxed text-ink-200 border-l-2 border-ink-600 pl-4">
            {row.fit_reasoning}
          </div>
        )}

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mono pt-2">
          <Field label="score" value={row.discovery_score ?? '—'} />
          <Field label="est. arpu" value={row.estimated_arpu_usd ? `$${row.estimated_arpu_usd}` : '—'} />
          <Field label="reported rev" value={row.revenue_amount_usd_monthly ? `${fmtCurrency(row.revenue_amount_usd_monthly)}/mo` : '—'} />
          <Field label="geo" value={row.geographic_hint ?? '—'} />
          <Field label="status" value={row.status} />
          <Field label="found" value={fmtDate(row.found_at)} />
          <Field label="posted" value={fmtDate(row.posted_at)} />
          <Field label="scored" value={fmtDate(row.scored_at)} />
        </dl>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
        <div className="space-y-4">
          {row.revenue_signal && (
            <Block title="revenue signal">
              <p className="text-sm mono text-ink-200">{row.revenue_signal}</p>
            </Block>
          )}

          <Block title="source context">
            <p className="text-sm text-ink-200 whitespace-pre-wrap leading-relaxed">{row.raw_context}</p>
          </Block>

          <Block title="raw payload">
            <pre className="text-xs mono text-ink-300 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(row.raw_payload, null, 2)}
            </pre>
          </Block>
        </div>

        <aside className="space-y-3">
          <Block title="actions">
            <StatusActions id={row.id} status={row.status} sourceUrl={row.source_url} compact />
          </Block>
          <Block title="evaluate">
            {row.evaluation_id ? (
              <Link href={`/evaluations/${row.evaluation_id}`}
                className="mono block text-xs px-2 py-1.5 border border-emerald-500 text-emerald-300 bg-emerald-900/20 hover:bg-emerald-900/40 text-center">
                open evaluation →
              </Link>
            ) : (
              <form action={evaluateCandidate} className="space-y-2">
                <input type="hidden" name="candidate_id" value={row.id} />
                <input
                  type="text"
                  name="metro"
                  required
                  placeholder={row.geographic_hint || 'metro (e.g. DFW, national)'}
                  defaultValue={row.geographic_hint || ''}
                  className="mono w-full bg-ink-900 border border-ink-600 px-2 py-1.5 text-xs text-ink-100 focus:border-ink-300 focus:outline-none"
                />
                <button type="submit"
                  className="mono w-full text-xs px-2 py-1.5 border border-emerald-500 text-emerald-300 bg-emerald-900/20 hover:bg-emerald-900/40">
                  run evaluation
                </button>
                <p className="mono text-[10px] text-ink-500 leading-tight">
                  30 to 90 seconds. uses outscraper + dataforseo + trends + sonnet.
                </p>
              </form>
            )}
          </Block>
        </aside>
      </section>
    </main>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="text-ink-100 truncate">{String(value)}</dd>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div className="border border-ink-600 bg-ink-800">
      <h2 className="text-[10px] uppercase tracking-wider text-ink-400 mono px-4 py-2 border-b border-ink-600">{title}</h2>
      <div className="p-4">{children}</div>
    </div>
  );
}
