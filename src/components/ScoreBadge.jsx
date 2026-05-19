// Color-coded score badge. Thresholds match docs/discovery-rubric.md:
//   70+ digest-worthy, 50-69 inbox-worthy, <50 hidden by default.

export function ScoreBadge({ score, size = 'md' }) {
  if (score === null || score === undefined) {
    return (
      <span className={`mono inline-flex items-center justify-center border border-ink-600 bg-ink-800 text-ink-400 ${size === 'lg' ? 'h-12 px-4 text-2xl' : 'h-7 px-2 text-xs'}`}>
        unscored
      </span>
    );
  }

  let tone = 'border-ink-600 bg-ink-800 text-ink-300';
  if (score >= 70) tone = 'border-emerald-500 bg-emerald-900/40 text-emerald-200';
  else if (score >= 50) tone = 'border-amber-500 bg-amber-900/40 text-amber-200';
  else tone = 'border-ink-500 bg-ink-800 text-ink-400';

  const sizeClass = size === 'lg'
    ? 'h-14 min-w-[3.5rem] px-3 text-3xl font-bold'
    : 'h-7 min-w-[2.5rem] px-2 text-sm font-semibold';

  return (
    <span className={`mono inline-flex items-center justify-center border ${tone} ${sizeClass}`}>
      {score}
    </span>
  );
}

export function CategoryChip({ category }) {
  if (!category) return null;
  const map = {
    proven_winner: { label: 'proven win', tone: 'border-emerald-500 text-emerald-300' },
    revenue_mention: { label: 'revenue mention', tone: 'border-sky-500 text-sky-300' },
    opportunity_signal: { label: 'opportunity', tone: 'border-ink-500 text-ink-300' }
  };
  const m = map[category] || { label: category, tone: 'border-ink-500 text-ink-300' };
  return (
    <span className={`mono inline-flex items-center h-5 px-1.5 text-[10px] uppercase tracking-wider border ${m.tone}`}>
      {m.label}
    </span>
  );
}

export function StatusChip({ status }) {
  if (!status || status === 'new') return null;
  const map = {
    queued_for_eval: { label: 'queued', tone: 'border-sky-500 text-sky-300' },
    evaluated: { label: 'evaluated', tone: 'border-emerald-500 text-emerald-300' },
    archived: { label: 'archived', tone: 'border-ink-500 text-ink-400' },
    building: { label: 'building', tone: 'border-amber-500 text-amber-300' }
  };
  const m = map[status] || { label: status, tone: 'border-ink-500 text-ink-400' };
  return (
    <span className={`mono inline-flex items-center h-5 px-1.5 text-[10px] uppercase tracking-wider border ${m.tone}`}>
      {m.label}
    </span>
  );
}
