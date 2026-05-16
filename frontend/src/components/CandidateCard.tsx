import type { MatchCandidate } from '@/lib/types';
import { dateShort, initials, isApcExpiring, nullable, score100 } from '@/lib/format';
import ScoreBreakdown from './ScoreBreakdown';
import ComplianceBadge from './ComplianceBadge';
import Disclosure from './Disclosure';

interface Props {
  candidate: MatchCandidate;
  rank: number;
  selected?: boolean;
  onSelect?: () => void;
  onConfirm?: () => void;
  confirming?: boolean;
  confirmed?: boolean;
  ctaLabel?: string;
  variant?: 'featured' | 'row' | 'tile';
}

export default function CandidateCard({
  candidate,
  rank,
  selected = false,
  onSelect,
  onConfirm,
  confirming = false,
  confirmed = false,
  ctaLabel = 'Confirm',
  variant = 'row',
}: Props) {
  const common = { candidate, rank, selected, onSelect, onConfirm, confirming, confirmed, ctaLabel };
  if (variant === 'featured') return <FeaturedCard {...common} />;
  if (variant === 'tile') return <TileCard {...common} />;
  return <RowCard {...common} />;
}

interface VariantProps {
  candidate: MatchCandidate;
  rank: number;
  selected: boolean;
  onSelect?: () => void;
  onConfirm?: () => void;
  confirming: boolean;
  confirmed: boolean;
  ctaLabel: string;
}

function ctaHandler(selected: boolean, onSelect?: () => void, onConfirm?: () => void) {
  // If onConfirm is provided, two-step flow: first click selects, second click confirms.
  // Otherwise the button just toggles selection.
  if (!onConfirm) return onSelect;
  return selected ? onConfirm : onSelect;
}

function ctaText(
  selected: boolean,
  ctaLabel: string,
  onConfirm: (() => void) | undefined,
  confirming: boolean,
  confirmed: boolean,
) {
  if (confirmed) return 'Sent ✓';
  if (confirming) return 'Sending…';
  if (onConfirm) return selected ? ctaLabel : 'Select';
  return selected ? 'Selected ✓' : ctaLabel;
}

// ── Variant: row ─────────────────────────────────────────────────
function RowCard({
  candidate, rank, selected, onSelect, onConfirm, confirming, confirmed, ctaLabel,
}: VariantProps) {
  const { actor, score, compliance, rationale } = candidate;
  const blocked = !compliance.apcValid;
  const total = score100(score.total / 100);
  const expiring = isApcExpiring(actor.apcExpiry);

  return (
    <article
      className={[
        'paper paper-hover relative grid grid-cols-[auto_1fr_auto] gap-5 p-5 transition',
        selected ? 'ring-2 ring-teal-300/70' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className="display mt-1 text-2xl font-medium leading-none text-ink-subtle tabular">
          {String(rank).padStart(2, '0')}
        </span>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-100 to-teal-200 text-sm font-semibold text-teal-800 shadow-soft">
          {initials(actor.name)}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="display truncate text-lg font-medium tracking-tightish text-ink">
            {actor.name}
          </h3>
          <span className="text-[12px] text-ink-subtle">
            {actor.type}{actor.subspecialty ? ` · ${actor.subspecialty}` : ''}
          </span>
        </div>
        <div className="mt-0.5 text-[12px] text-ink-muted">
          {nullable(actor.hospital)} · {nullable(actor.department)}
        </div>

        <div className="mt-2.5">
          <Disclosure label="Profile details">
            <div className="flex flex-wrap gap-1.5">
              <span className="chip chip-butter">
                {nullable(actor.outcomeScore, (n) => `${n.toFixed(1)} / 5`)}
              </span>
              <span className="chip">{nullable(actor.caseCount, (n) => `${n} cases`)}</span>
              <span className="chip">{nullable(actor.capacityPct, (n) => `${n}% load`)}</span>
              <span className={`chip ${expiring ? 'chip-warn' : ''}`}>
                APC {dateShort(actor.apcExpiry)}
              </span>
              {score.historicalPairBonus && score.historicalPairBonus > 0 && (
                <span className="chip chip-coral">Historical pair</span>
              )}
            </div>
          </Disclosure>
        </div>

        <p className="mt-3 max-w-[58ch] text-[13.5px] leading-relaxed text-ink-muted">
          {rationale}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ComplianceBadge c={compliance} />
          <span className={`chip ${blocked ? 'chip-danger' : 'chip-ok'}`}>
            {blocked ? '⛔ Blocked by Compliance' : '✓ Cleared by Compliance'}
          </span>
        </div>
      </div>

      <div className="flex w-56 shrink-0 flex-col justify-between gap-3">
        <div
          className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-cream/60 to-paper p-4"
        >
          <div className="flex items-baseline justify-between">
            <span className="section-label">Match score</span>
            <span
              className={[
                'display text-3xl font-semibold tabular leading-none',
                blocked ? 'text-rose-700' : total >= 90 ? 'text-emerald-700' : 'text-ink',
              ].join(' ')}
            >
              {blocked ? '—' : total}
            </span>
          </div>
          <div className="mt-3">
            <ScoreBreakdown score={score} compact />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn-ghost">Profile</button>
          {blocked ? (
            <button className="btn-secondary">Override</button>
          ) : (
            <button
              className={selected && !confirmed ? 'btn-primary' : 'btn-secondary'}
              onClick={ctaHandler(selected, onSelect, onConfirm)}
              disabled={confirming || confirmed}
            >
              {ctaText(selected, ctaLabel, onConfirm, confirming, confirmed)}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Variant: featured ────────────────────────────────────────────
function FeaturedCard({
  candidate, selected, onSelect, onConfirm, confirming, confirmed, ctaLabel,
}: VariantProps) {
  const { actor, score, compliance, rationale } = candidate;
  const total = score100(score.total / 100);

  return (
    <article className="paper paper-hover relative overflow-hidden p-7 animate-rise">
      {/* Decorative blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full blur-3xl"
        style={{ background: 'var(--stage-soft)', opacity: 0.7 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -bottom-20 h-52 w-52 rounded-full blur-3xl"
        style={{ background: 'var(--stage-mid)', opacity: 0.18 }}
      />

      <div className="relative flex items-start gap-6">
        <div
          className="grid h-20 w-20 place-items-center rounded-3xl text-2xl font-semibold shadow-soft"
          style={{ background: 'var(--stage-soft)', color: 'var(--stage-ink)' }}
        >
          {initials(actor.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="eyebrow" style={{ color: 'var(--stage-deep)' }}>
            Top match · the model picked this one
          </div>
          <h2 className="display mt-1 text-3xl font-medium tracking-tighter text-ink">
            {actor.name}
          </h2>
          <div className="mt-1 text-[13px] text-ink-muted">
            {actor.type}{actor.subspecialty ? ` · ${actor.subspecialty}` : ''} · {nullable(actor.hospital)}
          </div>
          <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-ink">
            {rationale}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <ComplianceBadge c={compliance} />
            <span className="chip chip-butter">
              {nullable(actor.outcomeScore, (n) => `${n.toFixed(1)} / 5`)} · {nullable(actor.caseCount, (n) => `${n} cases`)}
            </span>
            {score.historicalPairBonus && score.historicalPairBonus > 0 && (
              <span className="chip chip-coral">Historical pair bonus</span>
            )}
          </div>
        </div>

        <div className="hidden w-56 shrink-0 flex-col items-end gap-3 md:flex">
          <div className="text-right">
            <div className="section-label">Match score</div>
            <div
              className="display text-6xl font-semibold leading-none tabular"
              style={{ color: 'var(--stage-deep)' }}
            >
              {total}
            </div>
          </div>
          <div className="w-full">
            <ScoreBreakdown score={score} compact />
          </div>
          <button
            className={selected && !confirmed ? 'btn-stage w-full' : 'btn-secondary w-full'}
            onClick={ctaHandler(selected, onSelect, onConfirm)}
            disabled={confirming || confirmed}
          >
            {ctaText(selected, ctaLabel, onConfirm, confirming, confirmed)}
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Variant: tile ────────────────────────────────────────────────
function TileCard({
  candidate, selected, onSelect, ctaLabel, confirmed,
}: VariantProps) {
  const { actor, score, compliance } = candidate;
  const blocked = !compliance.apcValid;
  const total = score100(score.total / 100);

  return (
    <button
      onClick={onSelect}
      className={[
        'group block w-full rounded-2xl border bg-paper p-3.5 text-left shadow-soft transition-all duration-200',
        selected
          ? 'ring-2 ring-offset-0'
          : 'hover:-translate-y-0.5 hover:shadow-pop',
        blocked ? 'opacity-90' : '',
      ].join(' ')}
      style={{
        borderColor: selected ? 'var(--stage-deep)' : undefined,
        ['--tw-ring-color' as 'color']: selected ? ('var(--stage-mid)' as unknown as string) : undefined,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-100 to-teal-200 text-[11px] font-semibold text-teal-800">
          {initials(actor.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-ink">{actor.name}</div>
          <div className="truncate text-[11px] text-ink-subtle">{nullable(actor.hospital)}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-ink-subtle">Score</div>
          <div
            className={[
              'display text-base font-semibold leading-none tabular',
              blocked ? 'text-rose-700' : total >= 92 ? 'text-emerald-700' : 'text-ink',
            ].join(' ')}
          >
            {blocked ? '—' : total}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ComplianceBadge c={compliance} />
        {score.historicalPairBonus && score.historicalPairBonus > 0 && (
          <span className="chip chip-coral">pair</span>
        )}
      </div>
      <div className="mt-2 text-right text-[11px] text-ink-subtle">
        {confirmed
          ? '— Sent —'
          : selected
            ? '— Selected —'
            : <span className="opacity-0 group-hover:opacity-100">{ctaLabel} →</span>}
      </div>
    </button>
  );
}
