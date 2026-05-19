// One row per scoring dimension. Visual bar + score / max + reasoning.

const LABELS = {
  market_size: 'Market size',
  competition_strength: 'Competition strength',
  buyer_intent: 'Buyer intent',
  maps_disorganization: 'Maps disorganization',
  geographic_distribution: 'Geographic distribution',
  ai_overview_resistance: 'AI Overview resistance'
};

function tone(ratio) {
  if (ratio >= 0.7) return 'bg-emerald-500';
  if (ratio >= 0.5) return 'bg-amber-500';
  if (ratio >= 0.25) return 'bg-orange-500';
  return 'bg-rose-500';
}

export function DimensionBar({ row }) {
  const max = row.max_score || 1;
  const ratio = row.score / max;
  const pct = Math.max(2, Math.round(ratio * 100));
  return (
    <div className="border border-ink-600 bg-ink-800 p-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{LABELS[row.dimension] || row.dimension}</h3>
        <span className="mono text-xs text-ink-400">
          <span className="text-ink-100">{row.score}</span> / {max}
        </span>
      </div>
      <div className="h-2 w-full bg-ink-700 overflow-hidden">
        <div className={`h-full ${tone(ratio)}`} style={{ width: `${pct}%` }} />
      </div>
      {row.reasoning && (
        <p className="text-xs text-ink-300 leading-relaxed pt-1">{row.reasoning}</p>
      )}
      {row.evidence && Object.keys(row.evidence).length > 0 && (
        <ul className="mono text-[11px] text-ink-500 pl-3 space-y-0.5">
          {Object.entries(row.evidence).slice(0, 6).map(([k, v]) => (
            <li key={k}>{k}: <span className="text-ink-300">{String(v).slice(0, 120)}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
