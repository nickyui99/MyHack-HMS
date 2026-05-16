import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useActiveCase } from '@/lib/activeCase';
import { stageForPath } from '@/lib/stages';
import type { PatientCase } from '@/lib/types';
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
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-ink-subtle">
            Patient
          </span>
          <PatientPicker cases={cases} active={active} onPick={setActiveId} />
        </div>
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

function PatientPicker({
  cases,
  active,
  onPick,
}: {
  cases: PatientCase[];
  active: PatientCase;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-1.5 text-[13px] font-medium text-ink shadow-soft transition hover:bg-cream/60 focus:outline-none focus:ring-2 focus:ring-teal-300/70"
      >
        <span className="truncate">
          {active.patientName}
          <span className="ml-1.5 text-ink-muted">
            · {active.age}{active.sex} · {active.diagnosis}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 shrink-0 text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 w-[min(22rem,80vw)] origin-top-left animate-rise rounded-3xl border border-line bg-paper p-1.5 shadow-pop"
        >
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {cases.map((c) => {
              const selected = c.id === active.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onPick(c.id);
                      setOpen(false);
                    }}
                    className={[
                      'flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition',
                      selected
                        ? 'bg-cream ring-1 ring-teal-300/70'
                        : 'hover:bg-cream/60',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                        selected
                          ? 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-soft'
                          : 'bg-cream text-ink-muted',
                      ].join(' ')}
                    >
                      {c.patientName
                        .split(' ')
                        .slice(0, 2)
                        .map((s) => s[0])
                        .join('')
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {c.patientName}
                      </span>
                      <span className="block truncate text-[11px] text-ink-subtle">
                        {c.age}{c.sex} · {c.diagnosis}
                      </span>
                    </span>
                    {selected && (
                      <svg
                        viewBox="0 0 24 24"
                        className="mt-1 h-4 w-4 shrink-0 text-teal-600"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
