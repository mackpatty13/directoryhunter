import Link from 'next/link';
import { ScoreBadge, CategoryChip, StatusChip } from './ScoreBadge.jsx';
import { StatusActions } from './StatusActions.jsx';

function fmtCurrency(n) {
  if (n === null || n === undefined) return null;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 3600 * 1000));
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function CandidateCard({ row }) {
  const niche = row.niche_canonical || row.niche_raw;
  const rev = fmtCurrency(row.revenue_amount_usd_monthly);
  const arpu = row.estimated_arpu_usd ? `$${row.estimated_arpu_usd}` : null;

  return (
    <article className="border border-ink-600 bg-ink-800 hover:border-ink-500 transition-colors">
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        <div className="flex-shrink-0">
          <ScoreBadge score={row.discovery_score} size="lg" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <Link href={`/candidates/${row.id}`} className="text-xl font-semibold text-ink-100 hover:text-emerald-300 truncate">
              {niche}
            </Link>
            <CategoryChip category={row.discovery_category} />
            <StatusChip status={row.status} />
          </div>

          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs mono text-ink-400">
            <span>src: <span className="text-ink-200">{row.source_id}</span></span>
            {row.geographic_hint && <span>geo: <span className="text-ink-200">{row.geographic_hint}</span></span>}
            {arpu && <span>arpu: <span className="text-ink-200">{arpu}</span></span>}
            {rev && <span>rev: <span className="text-ink-200">{rev}/mo</span></span>}
            {fmtDate(row.posted_at || row.found_at) && (
              <span>found: <span className="text-ink-200">{fmtDate(row.found_at)}</span></span>
            )}
          </div>

          {row.fit_reasoning && (
            <p className="mt-3 text-sm text-ink-300 leading-relaxed line-clamp-3">
              {row.fit_reasoning}
            </p>
          )}

          {row.revenue_signal && (
            <p className="mt-2 text-xs mono text-ink-400 truncate">
              signal: <span className="text-ink-200">{row.revenue_signal}</span>
            </p>
          )}
        </div>

        <div className="flex-shrink-0">
          <StatusActions id={row.id} status={row.status} sourceUrl={row.source_url} />
        </div>
      </div>
    </article>
  );
}
