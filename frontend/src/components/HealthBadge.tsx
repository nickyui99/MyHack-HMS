import { useEffect, useState } from 'react';
import { loadHealth, type HealthStatus } from '@/data/source';

/**
 * Polls GET /health every 30s. Shows three states:
 *   live     · backend reachable, status=ok           (green)
 *   degraded · backend reachable, non-ok status       (amber)
 *   mock     · no backend configured or unreachable   (neutral)
 */
export default function HealthBadge() {
  const [status, setStatus] = useState<HealthStatus | 'pending'>('pending');

  useEffect(() => {
    let live = true;
    const tick = async () => {
      const s = await loadHealth();
      if (live) setStatus(s);
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  const cfg: Record<typeof status, { dot: string; label: string; cls: string }> = {
    pending:  { dot: 'bg-slate-400',   label: 'checking…', cls: 'chip' },
    live:     { dot: 'bg-emerald-500', label: 'backend · live',     cls: 'chip-ok' },
    degraded: { dot: 'bg-amber-500',   label: 'backend · degraded', cls: 'chip-warn' },
    mock:     { dot: 'bg-coral-400',   label: 'mock data',          cls: 'chip-coral' },
  };
  const c = cfg[status];

  return (
    <span className={`chip ${c.cls}`} title={`/health → ${status}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
