import { useCallback, useState } from 'react';
import StageHero from '@/components/StageHero';
import SourceBadge, { ErrorState, SkeletonList } from '@/components/SourceBadge';
import Disclosure from '@/components/Disclosure';
import { runAlliedMatch } from '@/data/source';
import { useApi } from '@/lib/useApi';
import { stages } from '@/lib/stages';
import { initials } from '@/lib/format';
import { useActiveCase } from '@/lib/activeCase';
import ComplianceBadge from '@/components/ComplianceBadge';
import type { MatchCandidate } from '@/lib/types';

const milestones = [
  { week: 'Day 0',  label: 'Discharge',     services: ['Pharmacy'] },
  { week: 'Week 1', label: 'Wound + meds',  services: ['Pharmacy', 'Physiotherapy'] },
  { week: 'Week 2', label: 'Rehab start',   services: ['Physiotherapy', 'Nutrition'] },
  { week: 'Week 4', label: 'Diet review',   services: ['Nutrition'] },
  { week: 'Week 8', label: 'Outcome check', services: ['Physiotherapy', 'Nutrition'] },
];

const SERVICE_SLOTS = [
  { title: 'Physiotherapy', type: 'Physiotherapist', duration: '6-week programme · 2× weekly', goal: 'METs ≥ 5 by week 6, walking 2 km' },
  { title: 'Nutrition',     type: 'Dietitian',       duration: '4-week meal plan + f/u',       goal: 'HbA1c ≤ 7.0, Na <2 g/day' },
  { title: 'Pharmacy',      type: 'Pharmacist',      duration: 'Discharge + 2-week review',    goal: 'Anti-coag titrated, no DDIs' },
] as const;

export default function AlliedHealth() {
  const { active } = useActiveCase();
  const fetcher = useCallback(() => runAlliedMatch(active.id), [active.id]);
  const { data, loading, error, refetch } = useApi(fetcher, [active.id]);
  const candidates = data?.data ?? [];
  const source = data?.source;

  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({
    Physiotherapy: true,
    Nutrition: true,
    Pharmacy: true,
  });

  // Pick the best candidate per service type from the returned ranking.
  const bestByType = new Map<string, MatchCandidate>();
  for (const c of candidates) {
    if (!bestByType.has(c.actor.type)) bestByType.set(c.actor.type, c);
  }

  return (
    <>
      <StageHero
        stage={stages.allied}
        signals={['3 / 3 services', '8-week recovery', 'Target outcome 4.7 / 5']}
      />

      <div className="mb-7">
      <Disclosure size="lg" label="Recovery journey" hint="8-week timeline">
      <section className="paper paper-hover relative overflow-hidden p-6">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: 'var(--stage-soft)', opacity: 0.6 }} />
        <div aria-hidden className="pointer-events-none absolute -left-16 -bottom-24 h-56 w-56 rounded-full blur-3xl" style={{ background: 'var(--stage-mid)', opacity: 0.18 }} />
        <div className="relative">
          <div className="flex items-baseline justify-between">
            <h2 className="display text-xl font-medium tracking-tightish text-ink">
              Recovery journey
            </h2>
            <span className="text-[11px] text-ink-subtle font-mono">
              Bed 14 · IJN Ward 4B · expected discharge 19 May
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-[13px] text-ink-muted">
            The Allied Health Agent stitches a continuous 8-week pathway from each
            service. Each node here is a scheduled hand-off backed by a relationship
            edge in the graph.
          </p>

          <div className="relative mt-6">
            <div className="absolute left-0 right-0 top-[18px] h-px" style={{ background: 'var(--stage-deep)', opacity: 0.35 }} />
            <ol className="relative grid grid-cols-5 gap-2">
              {milestones.map((m, idx) => (
                <li key={m.week} className="flex flex-col items-center text-center">
                  <span
                    className="relative z-10 grid h-10 w-10 place-items-center rounded-full text-[11px] font-semibold tabular shadow-soft transition hover:-translate-y-0.5"
                    style={{
                      background: idx === 0 ? 'var(--stage-deep)' : 'white',
                      color: idx === 0 ? 'white' : 'var(--stage-ink)',
                      border: idx === 0 ? 'none' : '1.5px solid var(--stage-deep)',
                    }}
                  >
                    {idx === 0 ? 'D0' : `W${idx === 4 ? '8' : idx === 3 ? '4' : idx}`}
                  </span>
                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    {m.week}
                  </div>
                  <div className="text-[12px] font-medium text-ink">{m.label}</div>
                  <div className="mt-1 flex flex-wrap justify-center gap-1">
                    {m.services.map((s) => (
                      <span key={s} className="chip-stage chip">{s}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      </Disclosure>
      </div>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="display text-xl font-medium tracking-tightish text-ink">
            Discharge plan for {active.patientName}
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {active.diagnosis}
            {active.region ? ` · ${active.region}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {source && <SourceBadge source={source} />}
          <span className="font-mono text-[11px] text-ink-subtle">
            POST /match/allied-health
          </span>
        </div>
      </div>

      {loading && <SkeletonList rows={2} />}
      {error && <ErrorState error={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SERVICE_SLOTS.map((s) => {
            const cand = bestByType.get(s.type);
            return cand ? (
              <ServiceCard
                key={s.title}
                title={s.title}
                duration={s.duration}
                goal={s.goal}
                candidate={cand}
                confirmed={confirmed[s.title]}
                onToggle={() => setConfirmed((c) => ({ ...c, [s.title]: !c[s.title] }))}
              />
            ) : (
              <div key={s.title} className="paper p-5">
                <div className="section-label">{s.title}</div>
                <div className="mt-2 text-[12px] text-ink-subtle">
                  No candidate available from the matching service.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

interface ServiceCardProps {
  title: string;
  duration: string;
  goal: string;
  candidate: MatchCandidate;
  confirmed: boolean;
  onToggle: () => void;
}

function ServiceCard({ title, duration, goal, candidate, confirmed, onToggle }: ServiceCardProps) {
  const { actor, score, compliance } = candidate;
  return (
    <article className="paper paper-hover relative flex flex-col gap-4 p-5">
      <div className="absolute right-4 top-4">
        <span className={`chip ${confirmed ? 'chip-ok' : ''}`}>
          {confirmed ? '✓ Scheduled' : 'Pending'}
        </span>
      </div>

      <div>
        <div className="section-label">{title}</div>
        <div className="display mt-1 text-lg font-medium tracking-tightish text-ink">
          {actor.name}
        </div>
        <div className="text-[12px] text-ink-muted">{actor.hospital ?? 'NULL'}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <Field label="Duration" value={duration} />
        <Field label="Outcome goal" value={goal} />
      </div>

      <div className="rounded-lg border border-line bg-cream/40 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-paper text-[11px] font-semibold text-teal-800 shadow-soft">
              {initials(actor.name)}
            </div>
            <div>
              <div className="text-[12.5px] font-medium text-ink">
                {actor.outcomeScore === null ? 'NULL' : `${actor.outcomeScore.toFixed(1)} / 5`}
                {' · '}
                {actor.caseCount === null ? 'NULL' : `${actor.caseCount} cases`}
              </div>
              <ComplianceBadge c={compliance} />
            </div>
          </div>
          <div className="text-right">
            <div className="section-label">Score</div>
            <div className="display text-2xl font-semibold leading-none text-ink tabular">
              {Math.round(score.total)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button className="btn-ghost text-[12px]">Reschedule</button>
        <button
          onClick={onToggle}
          className={confirmed ? 'btn-secondary' : 'btn-stage'}
        >
          {confirmed ? 'Unschedule' : 'Schedule'}
        </button>
      </div>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="section-label">{label}</div>
      <div className="text-[12.5px] text-ink">{value}</div>
    </div>
  );
}
