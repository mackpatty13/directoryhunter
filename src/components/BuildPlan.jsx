import { CompetitorList } from './CompetitorList.jsx';

function Chips({ items }) {
  if (!items || items.length === 0) return <p className="mono text-xs text-ink-500">—</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s, i) => (
        <span key={i} className="mono text-xs px-2 py-0.5 border border-ink-600 text-ink-200">{s}</span>
      ))}
    </div>
  );
}

function Block({ title, children }) {
  return (
    <section className="border border-ink-600 bg-ink-800">
      <h3 className="text-[10px] uppercase tracking-wider text-ink-400 mono px-4 py-2 border-b border-ink-600">{title}</h3>
      <div className="p-4">{children}</div>
    </section>
  );
}

function fmtCurrency(n) {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

export function BuildPlan({ plan }) {
  const revLow = fmtCurrency(plan.estimated_revenue_low);
  const revHigh = fmtCurrency(plan.estimated_revenue_high);
  return (
    <div className="space-y-4">
      <Block title="recommended model">
        <p className="text-base">
          <span className="font-semibold uppercase text-emerald-300">{plan.recommended_model}</span>
        </p>
        {plan.model_reasoning && <p className="mt-2 text-sm text-ink-300">{plan.model_reasoning}</p>}
      </Block>

      <Block title="revenue estimate (12 month run rate, monthly)">
        <p className="mono text-2xl">
          <span className="text-ink-100">{revLow}</span>
          <span className="text-ink-500 mx-2">to</span>
          <span className="text-ink-100">{revHigh}</span>
          <span className="text-ink-500 text-sm ml-2">per month</span>
        </p>
        {plan.revenue_basis && <p className="mt-3 text-sm text-ink-300 leading-relaxed">{plan.revenue_basis}</p>}
      </Block>

      <Block title="target metros">
        <Chips items={plan.target_metros} />
      </Block>

      <Block title="primary keywords">
        <Chips items={plan.primary_keywords} />
      </Block>

      <Block title="secondary keywords (long-tail)">
        <Chips items={plan.secondary_keywords} />
      </Block>

      <Block title="top competitors">
        <CompetitorList competitors={plan.top_competitors} />
      </Block>

      {plan.first_30_days_plan && (
        <Block title="30-day plan">
          <pre className="text-sm text-ink-200 whitespace-pre-wrap leading-relaxed">{plan.first_30_days_plan}</pre>
        </Block>
      )}

      {plan.stop_signs && plan.stop_signs.length > 0 && (
        <Block title="stop signs (kill if you see these)">
          <ul className="space-y-1.5 text-sm text-amber-200">
            {plan.stop_signs.map((s, i) => <li key={i} className="flex gap-2"><span>⚠</span><span>{s}</span></li>)}
          </ul>
        </Block>
      )}
    </div>
  );
}
