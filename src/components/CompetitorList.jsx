export function CompetitorList({ competitors }) {
  if (!competitors || competitors.length === 0) {
    return <p className="text-xs mono text-ink-500">no competitor data</p>;
  }
  return (
    <table className="w-full mono text-xs">
      <thead>
        <tr className="text-left text-ink-500 uppercase tracking-wider border-b border-ink-700">
          <th className="py-2 pr-3">domain</th>
          <th className="py-2 pr-3 w-12">da</th>
          <th className="py-2">weakness</th>
        </tr>
      </thead>
      <tbody>
        {competitors.map((c, i) => (
          <tr key={i} className="border-b border-ink-800 last:border-b-0">
            <td className="py-2 pr-3 text-ink-100">
              {c.domain ? (
                <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-300">
                  {c.domain} ↗
                </a>
              ) : '—'}
            </td>
            <td className="py-2 pr-3 text-ink-200">{c.da ?? '—'}</td>
            <td className="py-2 text-ink-300">{c.weakness || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
