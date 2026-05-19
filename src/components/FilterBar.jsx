// Server component. The form is plain HTML, submits to the same route with
// search params, no client state. Server re-renders with the new filters.

function field(label, name, children) {
  return (
    <label className="flex flex-col gap-1 text-xs mono uppercase tracking-wider text-ink-400">
      {label}
      {children}
    </label>
  );
}

const inputCls = 'mono bg-ink-900 border border-ink-600 px-2 py-1.5 text-sm text-ink-100 focus:border-ink-300 focus:outline-none';

export function FilterBar({ filters, facets }) {
  const sourceOptions = Object.entries(facets.sources)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({ id, n }));

  return (
    <form method="get" action="/" className="border border-ink-600 bg-ink-800 p-4 flex flex-wrap gap-3 items-end">
      {field('search', 'q',
        <input type="text" name="q" defaultValue={filters.q ?? ''} placeholder="niche, source, snippet"
          className={`${inputCls} w-56`} />
      )}

      {field('status', 'status',
        <select name="status" defaultValue={filters.status ?? 'active'} className={inputCls}>
          <option value="active">active (hide archived)</option>
          <option value="new">new only</option>
          <option value="queued_for_eval">queued</option>
          <option value="building">building</option>
          <option value="archived">archived</option>
          <option value="all">all</option>
        </select>
      )}

      {field('min score', 'minScore',
        <select name="minScore" defaultValue={filters.minScore ?? ''} className={inputCls}>
          <option value="">any</option>
          <option value="70">70+ (digest)</option>
          <option value="50">50+ (inbox)</option>
          <option value="40">40+</option>
        </select>
      )}

      {field('source', 'source',
        <select name="source" defaultValue={filters.source ?? ''} className={inputCls}>
          <option value="">all sources</option>
          {sourceOptions.map(s => (
            <option key={s.id} value={s.id}>{s.id} ({s.n})</option>
          ))}
        </select>
      )}

      {field('category', 'category',
        <select name="category" defaultValue={filters.category ?? ''} className={inputCls}>
          <option value="">all categories</option>
          <option value="proven_winner">proven_winner</option>
          <option value="revenue_mention">revenue_mention</option>
          <option value="opportunity_signal">opportunity_signal</option>
        </select>
      )}

      <div className="flex gap-2">
        <button type="submit" className="mono text-sm px-3 py-1.5 border border-ink-300 text-ink-100 hover:bg-ink-700">apply</button>
        <a href="/" className="mono text-sm px-3 py-1.5 border border-ink-600 text-ink-300 hover:bg-ink-700">reset</a>
      </div>
    </form>
  );
}
