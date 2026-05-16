import { useLocation } from 'react-router-dom';
import { activeCase } from '@/data/cases';
import { stageForPath } from '@/lib/stages';
import HealthBadge from './HealthBadge';

export default function TopBar() {
  const { pathname } = useLocation();
  const stage = stageForPath(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 bg-paper/95 px-8 backdrop-blur">
      <div className="flex items-center gap-3 text-sm">
        <span className="chip chip-stage">
          {stage.family} {stage.number !== '—' ? `· ${stage.number}` : ''}
        </span>
        <span className="hidden h-5 w-px bg-line sm:block" />
        <span className="flex flex-wrap items-center gap-2">
          <span className="live-dot" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
            Active case
          </span>
          <span className="display text-base font-medium text-ink">
            {activeCase.patientName}
          </span>
          <span className="text-ink-subtle">·</span>
          <span className="text-ink-muted">{activeCase.diagnosis}</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <HealthBadge />

        <button className="btn-ghost">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-3.5-3.5" />
          </svg>
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-1 hidden rounded-md border border-line bg-cream px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle sm:inline">⌘K</kbd>
        </button>

        <div className="h-6 w-px bg-line" />

        <div className="flex items-center gap-2 rounded-full p-1 transition hover:bg-cream/70">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-semibold text-white shadow-soft">
            AH
          </div>
          <div className="hidden pr-1 text-left text-sm leading-tight md:block">
            <div className="font-medium text-ink">Dr Amirul Hakim</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              GP · Klinik Sihat Puchong
            </div>
          </div>
          <svg viewBox="0 0 24 24" className="mr-1.5 h-3.5 w-3.5 text-ink-subtle" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>
    </header>
  );
}
