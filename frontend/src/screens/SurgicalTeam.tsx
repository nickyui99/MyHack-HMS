import { useCallback, useEffect, useMemo, useState } from 'react';
import StageHero from '@/components/StageHero';
import CandidateCard from '@/components/CandidateCard';
import SourceBadge, { ErrorState, FallbackBanner, SkeletonList } from '@/components/SourceBadge';
import Disclosure from '@/components/Disclosure';
import { createRelationship, runSurgicalMatch } from '@/data/source';
import { useApi } from '@/lib/useApi';
import { useMutation } from '@/lib/useMutation';
import { useActiveCase } from '@/lib/activeCase';
import { REQUESTER_ACTOR_ID } from '@/lib/env';
import type { MatchCandidate, SurgicalRole } from '@/lib/types';
import { initials } from '@/lib/format';
import { stages } from '@/lib/stages';

const ROLES: SurgicalRole[] = ['Lead Surgeon', 'Anaesthetist', 'Perfusionist', 'Scrub Nurse'];

export default function SurgicalTeam() {
  const { active } = useActiveCase();
  const fetcher = useCallback(() => runSurgicalMatch(active.id), [active.id]);
  const { data, loading, error, refetch } = useApi(fetcher, [active.id]);
  const byRole = data?.data;
  const source = data?.source;

  const [picks, setPicks] = useState<Record<SurgicalRole, string | null>>({
    'Lead Surgeon': null,
    Anaesthetist: null,
    Perfusionist: null,
    'Scrub Nurse': null,
  });

  // Auto-pick the top of each role when data arrives, unless user has chosen.
  useEffect(() => {
    if (!byRole) return;
    setPicks((p) => {
      const next = { ...p };
      ROLES.forEach((r) => {
        if (next[r] === null && byRole[r] && byRole[r].length > 0) {
          next[r] = byRole[r][0].actor.id;
        }
      });
      return next;
    });
  }, [byRole]);

  const teamScore = useMemo(() => {
    if (!byRole) return 0;
    let total = 0, count = 0;
    ROLES.forEach((role) => {
      const picked = picks[role];
      if (!picked) return;
      const cand = byRole[role]?.find((c) => c.actor.id === picked);
      if (cand) { total += cand.score.total; count += 1; }
    });
    return count === 0 ? 0 : Math.round(total / count);
  }, [picks, byRole]);

  const teamMut = useMutation(async () => {
    const created = [] as Awaited<ReturnType<typeof createRelationship>>[];
    for (const role of ROLES) {
      const id = picks[role];
      if (!id) continue;
      const rel = await createRelationship({
        type: 'surgical_team',
        actor_a: REQUESTER_ACTOR_ID,
        actor_b: id,
        department: role,
        case_id: active.id,
        justification: `Surgical team assembly · ${role}`,
      });
      created.push(rel);
    }
    return created;
  });

  const completeness = ROLES.filter((r) => picks[r]).length;
  const pairBonus = byRole
    ? ROLES.some(
        (r) =>
          (byRole[r]?.find((c) => c.actor.id === picks[r])?.score.historicalPairBonus ?? 0) > 0,
      )
    : false;

  return (
    <>
      <StageHero
        stage={stages.surgical}
        signals={['18 specialists', '63 combos · 5 viable', 'OT-3 · 07:00, 17 May']}
      />

      {/* OT briefing strip */}
      <div className="mb-6">
        <Disclosure size="lg" label="OT briefing" hint="Procedure · slot · score">
          <div
            className="relative grid grid-cols-1 gap-3 overflow-hidden rounded-2xl border p-4 sm:grid-cols-4"
            style={{
              borderColor: 'color-mix(in oklab, var(--stage-deep) 18%, transparent)',
              background: 'color-mix(in oklab, var(--stage-soft) 55%, white)',
            }}
          >
            <BriefingTile label="Procedure" value="CABG ×3" sub="Off-pump, sternotomy" />
            <BriefingTile label="OT slot" value="07:00 — 12:00" sub="IJN · OT-3" />
            <BriefingTile label="Team status" value={`${completeness}/4 roles`}
              sub={completeness === 4 ? 'Ready to confirm' : 'Awaiting assignment'} />
            <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-soft" style={{ background: `linear-gradient(135deg, ${stages.surgical.colors.deep}, ${stages.surgical.colors.ink})` }}>
              <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
              <div className="relative">
                <div className="section-label text-white/60">Combination score</div>
                <div className="display mt-1 flex items-baseline gap-2 leading-none">
                  <span className="text-4xl font-semibold tabular">{teamScore}</span>
                  <span className="text-white/55 text-xs">/ 100</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pairBonus && <span className="chip border-white/20 bg-white/15 text-white">pair bonus</span>}
                  <span className="chip border-white/20 bg-white/15 text-white">{ROLES.length} roles</span>
                </div>
              </div>
            </div>
          </div>
        </Disclosure>
      </div>

      {/* 4-column command center */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="display text-xl font-medium tracking-tightish text-ink">
            Assemble the team for {active.patientName}
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {active.diagnosis}
            {active.acuity ? ` · ${active.acuity}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {source && <SourceBadge source={source} />}
          <span className="font-mono text-[11px] text-ink-subtle">
            POST /match/surgical-team
          </span>
        </div>
      </div>

      {loading && <SkeletonList rows={2} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {source && <FallbackBanner source={source} onRetry={refetch} />}

      {!loading && !error && byRole && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((role) => (
            <RoleColumn
              key={role}
              role={role}
              candidates={byRole[role] ?? []}
              picked={picks[role]}
              onPick={(id) => setPicks((p) => ({ ...p, [role]: id }))}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-paper p-5 shadow-soft">
        <div className="flex-1 text-[12.5px] text-ink-muted">
          The historical-pair bonus rewards teams whose members have worked together on
          cardiac cases in the last 12 months. Approved teams write {completeness} relationships
          into the graph (POST /relationships, one per role).
          {teamMut.error && (
            <div className="mt-2 text-rose-700">Error: {teamMut.error.message}</div>
          )}
          {teamMut.data && (
            <div className="mt-2 text-emerald-700">
              Created {teamMut.data.length} relationship{teamMut.data.length === 1 ? '' : 's'} ·
              states: {teamMut.data.map((r) => r.state).join(', ')}
            </div>
          )}
        </div>
        <button
          className="btn-stage"
          onClick={() => teamMut.run()}
          disabled={teamMut.loading || completeness === 0 || Boolean(teamMut.data)}
        >
          {teamMut.loading
            ? 'Creating…'
            : teamMut.data
              ? 'Team confirmed ✓'
              : `Confirm team · create ${completeness} relationship${completeness === 1 ? '' : 's'}`}
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  );
}

function BriefingTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-paper/90 p-3 shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="section-label" style={{ color: 'var(--stage-deep)' }}>{label}</div>
      <div className="display mt-1 text-xl font-medium leading-none text-ink">{value}</div>
      <div className="mt-1 text-[11px] text-ink-muted">{sub}</div>
    </div>
  );
}

function RoleColumn({
  role, candidates, picked, onPick,
}: {
  role: SurgicalRole;
  candidates: MatchCandidate[];
  picked: string | null;
  onPick: (id: string) => void;
}) {
  if (candidates.length === 0) {
    return (
      <div
        className="flex flex-col gap-2 rounded-3xl border border-dashed border-line p-3 text-center"
      >
        <div className="section-label">{role}</div>
        <div className="text-[12px] text-ink-subtle">No candidates returned</div>
      </div>
    );
  }
  const top = candidates[0];
  const rest = candidates.slice(1);
  const isPickedTop = picked === top.actor.id;
  const pickedCand = candidates.find((c) => c.actor.id === picked);

  return (
    <div
      className="flex flex-col gap-2 rounded-3xl border p-3 shadow-soft"
      style={{
        background: 'color-mix(in oklab, var(--stage-soft) 45%, white)',
        borderColor: 'color-mix(in oklab, var(--stage-deep) 14%, transparent)',
      }}
    >
      <div className="flex items-center justify-between px-1">
        <div className="section-label">{role}</div>
        {pickedCand && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular"
            style={{ background: 'var(--stage-soft)', color: 'var(--stage-ink)' }}
          >
            {pickedCand.score.total}
          </span>
        )}
      </div>

      <CandidateCard
        variant="tile"
        candidate={top}
        rank={1}
        selected={isPickedTop}
        onSelect={() => onPick(top.actor.id)}
        ctaLabel="Assign"
      />

      {rest.length > 0 && (
        <>
          <div className="px-1 pt-1 text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
            Alternates
          </div>
          <div className="space-y-2">
            {rest.map((c) => (
              <button
                key={c.actor.id}
                onClick={() => onPick(c.actor.id)}
                className={[
                  'flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition',
                  picked === c.actor.id
                    ? 'border-ink/40 bg-paper shadow-soft'
                    : 'border-line bg-paper/60 hover:bg-paper',
                ].join(' ')}
              >
                <div className="grid h-7 w-7 place-items-center rounded-full bg-cream text-[10px] font-semibold text-teal-800">
                  {initials(c.actor.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-ink">{c.actor.name}</div>
                  <div className="truncate text-[10.5px] text-ink-subtle">{c.actor.hospital ?? 'NULL'}</div>
                </div>
                <span className={[
                  'display text-[14px] font-semibold tabular',
                  !c.compliance.apcValid ? 'text-rose-700' : 'text-ink',
                ].join(' ')}>
                  {!c.compliance.apcValid ? '—' : c.score.total}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
