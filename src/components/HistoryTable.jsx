import Link from 'next/link';

const TIER_TONE = {
  build: 'border-emerald-500 text-emerald-300',
  validate: 'border-amber-500 text-amber-300',
  risky: 'border-orange-500 text-orange-300',
  skip: 'border-rose-500 text-rose-300'
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
}

export function HistoryTable({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="border border-ink-600 bg-ink-800 p-8 text-center text-ink-400 mono text-sm">
        no evaluations yet. click evaluate on a candidate, or use /evaluate to start one manually.
      </div>
    );
  }
  return (
    <table className="w-full mono text-sm">
      <thead>
        <tr className="text-left text-ink-500 text-xs uppercase tracking-wider border-b border-ink-700">
          <th className="py-2 pr-3 w-14">score</th>
          <th className="py-2 pr-3">niche</th>
          <th className="py-2 pr-3">metro</th>
          <th className="py-2 pr-3 w-24">recommend</th>
          <th className="py-2 pr-3 w-20">status</th>
          <th className="py-2 pr-3 w-36">created</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} className="border-b border-ink-800 hover:bg-ink-800">
            <td className="py-2 pr-3">
              <Link href={`/evaluations/${r.id}`} className="text-ink-100 font-semibold hover:text-emerald-300">
                {r.total_score ?? '—'}
              </Link>
            </td>
            <td className="py-2 pr-3 text-ink-100">
              <Link href={`/evaluations/${r.id}`} className="hover:text-emerald-300">{r.niche}</Link>
            </td>
            <td className="py-2 pr-3 text-ink-300">{r.metro}</td>
            <td className="py-2 pr-3">
              {r.recommendation && (
                <span className={`inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 h-5 border ${TIER_TONE[r.recommendation] || 'border-ink-600 text-ink-400'}`}>
                  {r.recommendation}
                </span>
              )}
            </td>
            <td className="py-2 pr-3 text-ink-400">{r.status}</td>
            <td className="py-2 pr-3 text-ink-500">{fmtDate(r.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
