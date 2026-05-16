import { useCallback, useMemo, useState } from 'react';
import SourceBadge, { ErrorState } from '@/components/SourceBadge';
import { loadAudit } from '@/data/source';
import { useApi } from '@/lib/useApi';
import type { AuditEvent } from '@/lib/types';

const RESULTS: ('All' | AuditEvent['result'])[] = ['All', 'ok', 'blocked', 'override', 'error'];

const RESULT_STYLES: Record<AuditEvent['result'], string> = {
  ok:       'chip-ok',
  blocked:  'chip-danger',
  override: 'chip-warn',
  error:    'chip-danger',
};

export default function Audit() {
  const fetcher = useCallback(() => loadAudit(200), []);
  const { data, loading, error, refetch } = useApi(fetcher, []);
  const events = data?.data ?? [];
  const source = data?.source;

  const [filter, setFilter] = useState<typeof RESULTS[number]>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        const okFilter = filter === 'All' || e.result === filter;
        const q = query.toLowerCase();
        const okQuery =
          !q ||
          e.action.toLowerCase().includes(q) ||
          (e.detail ?? '').toLowerCase().includes(q) ||
          (e.subject ?? '').toLowerCase().includes(q) ||
          (e.actorId ?? '').toLowerCase().includes(q);
        return okFilter && okQuery;
      }),
    [events, filter, query],
  );

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs">
          <span className="eyebrow text-ink-subtle">Operations</span>
          <span className="text-ink-subtle">/</span>
          <span className="text-ink-muted">Audit Log</span>
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="display text-3xl font-semibold tracking-tighter text-ink">
              Audit Log
            </h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-ink-muted">
              Every state change, compliance decision, match run and override is
              recorded — this is the trust surface for governance reviews.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {source && <SourceBadge source={source} />}
            <span className="font-mono text-[11px] text-ink-subtle">GET /audit</span>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-3xl border border-line bg-paper p-2.5 shadow-soft">
        <div className="relative min-w-[260px] flex-1">
          <svg viewBox="0 0 24 24" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search action, subject, actor…"
            className="field w-full pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RESULTS.map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={[
                'rounded-full px-3 py-1.5 text-xs transition',
                filter === r
                  ? 'bg-ink text-canvas'
                  : 'border border-line bg-paper text-ink-muted hover:bg-cream/60',
              ].join(' ')}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading && <SkeletonRows />}
      {error && <ErrorState error={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="paper overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-cream/30 text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle">
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-line/60 last:border-0 hover:bg-cream/20">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11.5px] text-ink-muted tabular">
                    {fmtTs(e.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px] text-ink">{e.action}</span>
                  </td>
                  <td className="px-4 py-3">
                    {e.subject ? <code className="rounded bg-cream px-1.5 py-0.5 text-[11px]">{e.subject}</code> : <span className="text-ink-subtle">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {e.actorId ?? <span className="text-ink-subtle">system</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`chip ${RESULT_STYLES[e.result]}`}>{e.result}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{e.detail ?? '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-subtle">
                    No events match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function fmtTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function SkeletonRows() {
  return (
    <div className="paper overflow-hidden">
      <div className="divide-y divide-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid animate-pulse grid-cols-[140px_220px_120px_140px_90px_1fr] gap-4 px-4 py-3">
            <div className="h-3 rounded-full bg-line/70" />
            <div className="h-3 rounded-full bg-line/50" />
            <div className="h-3 rounded-full bg-line/40" />
            <div className="h-3 rounded-full bg-line/40" />
            <div className="h-4 rounded-full bg-line/50" />
            <div className="h-3 rounded-full bg-line/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
