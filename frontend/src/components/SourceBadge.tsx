import type { Source } from '@/data/source';

interface Props {
  source: Source;
  className?: string;
}

/**
 * Tiny indicator that tells the user where the rendered data came from.
 * - 'api'      → fresh from backend
 * - 'fallback' → API call failed, mock used (orange)
 * - 'mock'     → no API configured, mock used (neutral)
 */
export default function SourceBadge({ source, className = '' }: Props) {
  const cfg = {
    api:      { cls: 'chip-ok',    label: 'live · api' },
    fallback: { cls: 'chip-warn',  label: 'api unreachable · mock' },
    mock:     { cls: 'chip',       label: 'demo · mock data' },
  }[source];
  return <span className={`chip ${cfg.cls} ${className}`}>{cfg.label}</span>;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="paper p-5 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-line/70" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded-full bg-line/70" />
              <div className="h-3 w-1/4 rounded-full bg-line/50" />
              <div className="h-3 w-3/4 rounded-full bg-line/40" />
            </div>
            <div className="h-20 w-44 shrink-0 rounded-2xl bg-line/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Wide banner shown above content when the data source fell back to mocks —
 * makes broken wiring visible instead of silently degrading.
 */
export function FallbackBanner({ source, onRetry }: { source: Source; onRetry?: () => void }) {
  if (source !== 'fallback') return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-[12px] text-amber-900">
      <span>
        <span className="font-semibold">Backend unreachable</span> — showing demo data. Mutations will not persist.
      </span>
      {onRetry && (
        <button onClick={onRetry} className="text-[12px] font-medium underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="paper p-6 text-center">
      <div className="section-label text-rose-700">Couldn't load data</div>
      <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-4">
          Try again
        </button>
      )}
    </div>
  );
}
