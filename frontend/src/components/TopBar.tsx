import { useLocation } from 'react-router-dom';
import { useActiveCase } from '@/lib/activeCase';
import { stageForPath } from '@/lib/stages';
import HealthBadge from './HealthBadge';

export default function TopBar() {
  const { pathname } = useLocation();
  const stage = stageForPath(pathname);
  const { active, cases, setActiveId } = useActiveCase();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 bg-paper/95 px-8 backdrop-blur">
      <div className="flex items-center gap-4 text-sm">
        {/* Stage announcement — larger and colored so it's actually noticeable */}
        <div
          className="flex items-center gap-2.5 rounded-2xl px-3.5 py-1.5 shadow-soft"
          style={{
            background: 'var(--stage-soft)',
            color: 'var(--stage-ink)',
          }}
        >
          <span
            className="display grid h-7 w-7 place-items-center rounded-lg text-sm font-semibold tabular leading-none"
            style={{ background: 'var(--stage-deep)', color: 'white' }}
          >
            {stage.number === '—' ? '∞' : stage.number}
          </span>
          <span className="display text-[14px] font-semibold tracking-tight">
            {stage.title}
          </span>
        </div>

        <span className="hidden h-6 w-px bg-line sm:block" />

        {/* Active case dropdown — lets you switch patients */}
        <label className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-ink-subtle">
            Patient
          </span>
          <span className="relative">
            <select
              value={active.id}
              onChange={(e) => setActiveId(e.target.value)}
              className="appearance-none rounded-xl border border-line bg-paper px-3 py-1.5 pr-8 text-[13px] font-medium text-ink hover:bg-cream/60 focus:outline-none focus:ring-2 focus:ring-teal-300/70"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.patientName} · {c.age}{c.sex} · {c.diagnosis}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <HealthBadge />

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
        </div>
      </div>
    </header>
  );
}
