// Big score badge for the eval result page. Color tied to the recommendation
// tier from docs/evaluation-rubric.md (80+ build, 60-79 validate, 40-59 risky,
// <40 skip).

const TIER = {
  build: { label: 'BUILD', tone: 'border-emerald-500 bg-emerald-900/40 text-emerald-200' },
  validate: { label: 'VALIDATE', tone: 'border-amber-500 bg-amber-900/40 text-amber-200' },
  risky: { label: 'RISKY', tone: 'border-orange-500 bg-orange-900/40 text-orange-200' },
  skip: { label: 'SKIP', tone: 'border-rose-500 bg-rose-900/40 text-rose-200' }
};

export function ScoreGauge({ total, recommendation }) {
  const tier = TIER[recommendation] || TIER.skip;
  return (
    <div className={`mono border ${tier.tone} px-6 py-4 inline-flex items-center gap-4`}>
      <span className="text-5xl font-bold leading-none">{total ?? '—'}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-xs uppercase tracking-widest opacity-70">total / 100</span>
        <span className="text-base font-semibold tracking-wider">{tier.label}</span>
      </div>
    </div>
  );
}
