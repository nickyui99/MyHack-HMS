import type { ReactNode } from 'react';
import type { StageDef } from '@/lib/stages';
import StageIcon from './StageIcon';

interface Props {
  stage: StageDef;
  signals: [string, string, string];
  decoration?: ReactNode;
  cta?: { label: string; onClick?: () => void };
}

export default function StageHero({ stage, signals, cta }: Props) {
  return (
    <section
      className="relative mb-7 overflow-hidden rounded-3xl border bg-paper shadow-soft animate-rise"
      style={{ borderColor: 'color-mix(in oklab, var(--stage-deep) 18%, transparent)' }}
    >
      {/* Decorative blobs (static) */}
      <Blob className="-right-24 -top-24 h-72 w-72" tint="var(--stage-mid)" opacity={0.22} />
      <Blob className="-left-32 -bottom-32 h-80 w-80" tint="var(--stage-soft)" opacity={0.6} />

      <div className="relative px-8 py-6">
        <div className="flex items-center gap-3">
          <span
            className="display grid h-14 w-14 place-items-center rounded-2xl text-[30px] font-medium leading-none tabular shadow-soft"
            style={{
              background: 'var(--stage-soft)',
              color: 'var(--stage-ink)',
            }}
          >
            {stage.number}
          </span>
          <div className="leading-tight">
            <div
              className="display text-base font-semibold tracking-tight"
              style={{ color: 'var(--stage-deep)' }}
            >
              {stage.family === 'Network' ? 'Network View' : `Stage ${stage.number}`} · CareLink
            </div>
            <h1 className="display text-[34px] font-semibold leading-[1.05] tracking-tighter text-ink">
              {stage.title}
            </h1>
          </div>
          <span className="ml-auto rounded-2xl p-2.5" style={{ background: 'var(--stage-soft)', color: 'var(--stage-deep)' }}>
            <StageIcon name={stage.icon} className="h-7 w-7" />
          </span>
        </div>

        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink">
          {stage.subtitle}
        </p>

        {/* Stats laid out horizontally below the subtitle so the hero collapses
            to its natural content height instead of leaving a tall empty
            column where 'The question' / 'The mechanism' used to live. */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stage.signalLabels.map((label, i) => (
            <div
              key={label}
              className="rounded-2xl border bg-paper/90 px-4 py-3 shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:shadow-pop"
              style={{
                borderColor: 'color-mix(in oklab, var(--stage-deep) 14%, transparent)',
              }}
            >
              <div className="section-label" style={{ color: 'var(--stage-deep)' }}>
                {label}
              </div>
              <div className="display mt-1 text-2xl font-medium tracking-tightish tabular text-ink">
                {signals[i]}
              </div>
            </div>
          ))}
        </div>

        {cta && (
          <div className="mt-5">
            <button className="btn-stage" onClick={cta.onClick}>
              {cta.label}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Blob({
  className = '',
  tint,
  opacity = 0.4,
}: {
  className?: string;
  tint: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{ background: tint, opacity }}
    />
  );
}

