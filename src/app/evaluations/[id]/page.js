import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getEvaluation,
  getDimensionScores,
  getBuildPlan,
  getEvaluationData
} from '../../../lib/db.js';
import { ScoreGauge } from '../../../components/ScoreGauge.jsx';
import { DimensionBar } from '../../../components/DimensionBar.jsx';
import { BuildPlan } from '../../../components/BuildPlan.jsx';
import { rerunEvaluation } from '../../actions.js';

export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  pending: 'border-ink-500 text-ink-300',
  running: 'border-amber-500 text-amber-300',
  complete: 'border-emerald-500 text-emerald-300',
  failed: 'border-rose-500 text-rose-300'
};

function Block({ title, children, action = null }) {
  return (
    <section className="border border-ink-600 bg-ink-800">
      <div className="flex items-center justify-between px-4 py-2 border-b border-ink-600">
        <h2 className="text-[10px] uppercase tracking-wider text-ink-400 mono">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default async function EvaluationDetail({ params }) {
  const evalRow = await getEvaluation(params.id);
  if (!evalRow) notFound();

  const [dimensions, plan, allData] = await Promise.all([
    getDimensionScores(params.id),
    getBuildPlan(params.id),
    getEvaluationData(params.id)
  ]);

  const dataBySource = {};
  for (const d of allData) dataBySource[d.source] = d.payload;

  const stillRunning = evalRow.status === 'pending' || evalRow.status === 'running';

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
      {stillRunning && <meta httpEquiv="refresh" content="5" />}
      <header className="flex items-center justify-between mono text-sm">
        <Link href="/evaluations" className="text-ink-400 hover:text-ink-100">← evaluation history</Link>
        <div className="flex items-center gap-4">
          {!stillRunning && (
            <form action={rerunEvaluation} className="flex items-center gap-1">
              <input type="hidden" name="evaluation_id" value={evalRow.id} />
              <input
                type="text"
                name="metro"
                defaultValue={evalRow.metro}
                placeholder="metro"
                className="mono text-[11px] uppercase tracking-wider px-2 h-6 w-28 bg-ink-900 border border-ink-600 text-ink-100 focus:outline-none focus:border-emerald-500"
                title="Edit to re-run in a different city (e.g. phoenix, houston, national)"
              />
              <button
                type="submit"
                className="mono text-[11px] uppercase tracking-wider px-2 h-6 border border-emerald-500 text-emerald-300 hover:bg-emerald-900/30"
                title="Create a new evaluation. Edit the metro above to try a different city."
              >
                re-run
              </button>
            </form>
          )}
          <span className="text-ink-500 truncate max-w-md">{evalRow.id}</span>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{evalRow.niche}</h1>
            <p className="mt-1 text-base text-ink-300">{evalRow.metro}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`mono inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 h-5 border ${STATUS_TONE[evalRow.status] || 'border-ink-600 text-ink-400'}`}>
                {evalRow.status}
              </span>
              {evalRow.completed_at && (
                <span className="mono text-[10px] text-ink-500 inline-flex items-center h-5">
                  completed {new Date(evalRow.completed_at).toISOString().slice(0, 16).replace('T', ' ')}
                </span>
              )}
            </div>
          </div>
          {evalRow.status === 'complete' && (
            <ScoreGauge total={evalRow.total_score} recommendation={evalRow.recommendation} />
          )}
        </div>
      </section>

      {stillRunning && (
        <div className="border border-amber-500 bg-amber-900/20 p-6 text-center space-y-2">
          <p className="text-amber-200 mono text-sm">
            evaluation is {evalRow.status}. the railway worker picks up pending evals roughly once a minute, then takes 30 to 90 seconds to finish.
          </p>
          <p className="text-amber-200/70 mono text-xs">this page auto-refreshes every 5 seconds.</p>
        </div>
      )}

      {evalRow.status === 'failed' && (
        <div className="border border-rose-500 bg-rose-900/20 p-6">
          <h2 className="text-sm font-semibold text-rose-200 mono uppercase tracking-wider">failed</h2>
          <p className="mt-2 text-sm text-rose-200">{evalRow.error || 'no error message captured'}</p>
        </div>
      )}

      {dimensions.length > 0 && (
        <Block title="dimension scores">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dimensions.map(d => <DimensionBar key={d.id} row={d} />)}
          </div>
        </Block>
      )}

      {plan && (
        <Block title="build plan">
          <BuildPlan plan={plan} />
        </Block>
      )}

      {!plan && evalRow.total_score !== null && evalRow.total_score < 60 && evalRow.status === 'complete' && (
        <Block title="why no build plan">
          <p className="text-sm text-ink-300">
            Total score {evalRow.total_score} did not clear the 60-point threshold. No build plan was generated.
            The rubric calls this a {evalRow.recommendation} verdict.
          </p>
        </Block>
      )}

      <Block title="raw data sources">
        <ul className="mono text-xs space-y-1">
          {Object.keys(dataBySource).length === 0 && <li className="text-ink-500">(no payloads stored)</li>}
          {Object.keys(dataBySource).map(src => (
            <li key={src} className="text-ink-300">
              <span className="text-ink-100">{src}</span>: {
                Array.isArray(dataBySource[src])
                  ? `${dataBySource[src].length} items`
                  : `${Object.keys(dataBySource[src] || {}).length} keys`
              }
            </li>
          ))}
        </ul>
      </Block>

      {evalRow.normalized_niche && (
        <Block title="normalized">
          <pre className="mono text-xs text-ink-300 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify({ niche: evalRow.normalized_niche, metro: evalRow.normalized_metro }, null, 2)}
          </pre>
        </Block>
      )}
    </main>
  );
}
