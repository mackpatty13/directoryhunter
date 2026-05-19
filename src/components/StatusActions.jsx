import { setStatus } from '../app/actions.js';

// Server component. Each button posts a form to the setStatus server action,
// which revalidates the inbox and detail paths after the update.

function StatusButton({ id, status, label, tone = 'default' }) {
  const tones = {
    default: 'border-ink-500 text-ink-200 hover:bg-ink-700',
    primary: 'border-emerald-500 text-emerald-300 hover:bg-emerald-900/30',
    warn: 'border-amber-500 text-amber-300 hover:bg-amber-900/30',
    muted: 'border-ink-600 text-ink-400 hover:bg-ink-700'
  };
  return (
    <form action={setStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`mono w-full text-xs px-2 py-1.5 border ${tones[tone] ?? tones.default} text-left whitespace-nowrap`}>
        {label}
      </button>
    </form>
  );
}

export function StatusActions({ id, status, sourceUrl, compact = false }) {
  return (
    <div className={`flex flex-col gap-1 ${compact ? '' : 'min-w-[150px]'}`}>
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="mono text-xs px-2 py-1.5 border border-ink-500 text-ink-200 hover:bg-ink-700 text-left whitespace-nowrap">
          open source ↗
        </a>
      )}
      {status !== 'queued_for_eval' && status !== 'building' && (
        <StatusButton id={id} status="queued_for_eval" label="queue for eval" tone="primary" />
      )}
      {status !== 'building' && (
        <StatusButton id={id} status="building" label="mark building" tone="warn" />
      )}
      {status !== 'archived' && (
        <StatusButton id={id} status="archived" label="archive" tone="muted" />
      )}
      {status === 'archived' && (
        <StatusButton id={id} status="new" label="unarchive" tone="default" />
      )}
    </div>
  );
}
