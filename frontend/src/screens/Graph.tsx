import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import StageHero from '@/components/StageHero';
import SourceBadge, { ErrorState, FallbackBanner } from '@/components/SourceBadge';
import OutcomeModal from '@/components/OutcomeModal';
import { loadActors, loadRelationships, setRelationshipState } from '@/data/source';
import { useApi } from '@/lib/useApi';
import { useMutation } from '@/lib/useMutation';
import type { Actor, Relationship, RelationshipState, RelationshipType } from '@/lib/types';
import { dateShort, initials } from '@/lib/format';
import { stages } from '@/lib/stages';
import { useActiveCase } from '@/lib/activeCase';

const STATES: ('All' | RelationshipState)[] = ['All', 'proposed', 'confirmed', 'active', 'completed', 'blocked'];

// Workflow lanes — left-to-right reads as the patient's journey.
const LANES: { key: RelationshipType; number: string; title: string; subtitle: string; accent: string }[] = [
  { key: 'gp_referral',   number: '01', title: 'Referral',      subtitle: 'GP → Specialist',          accent: '#3d5a35' },
  { key: 'surgical_team', number: '02', title: 'Surgical Team', subtitle: 'Surgeon + OT roles',       accent: '#1d3a8a' },
  { key: 'allied_health', number: '03', title: 'Allied Health', subtitle: 'Post-op recovery team',    accent: '#9c3d1d' },
];

const STATE_STYLE: Record<RelationshipState, { fg: string; bg: string; dot: string; label: string }> = {
  proposed:  { fg: '#5a5347', bg: '#f5f1e8', dot: '#928a7d', label: 'Proposed' },
  confirmed: { fg: '#0f766e', bg: '#e6f4f1', dot: '#0f766e', label: 'Confirmed' },
  active:    { fg: '#059669', bg: '#e6f5ec', dot: '#059669', label: 'Active' },
  completed: { fg: '#1e1b30', bg: '#ece9f2', dot: '#1e1b30', label: 'Completed' },
  blocked:   { fg: '#b91c1c', bg: '#fde8e8', dot: '#e11d48', label: 'Blocked' },
};

export default function Graph() {
  const { active } = useActiveCase();
  const [rstate, setRstate] = useState<typeof STATES[number]>('All');
  const [selectedRel, setSelectedRel] = useState<string | null>(null);

  const relsFetcher  = useCallback(() => loadRelationships({ case_id: active.id }), [active.id]);
  const actorsFetcher = useCallback(() => loadActors(), []);
  const rels = useApi(relsFetcher, [active.id]);
  const acts = useApi(actorsFetcher, []);

  const relationships: Relationship[] = rels.data?.data ?? [];
  const actors: Actor[] = acts.data?.data ?? [];
  const source = rels.data?.source;
  const actorById = useMemo(() => new Map(actors.map((a) => [a.id, a])), [actors]);

  const visible = useMemo(
    () => relationships.filter((r) => rstate === 'All' || r.state === rstate),
    [relationships, rstate],
  );

  // Bucket relationships by lane.
  const byLane = useMemo(() => {
    const m = new Map<RelationshipType, Relationship[]>();
    LANES.forEach((l) => m.set(l.key, []));
    visible.forEach((r) => m.get(r.type)?.push(r));
    return m;
  }, [visible]);

  const stateMut = useMutation(setRelationshipState);
  const [outcomeFor, setOutcomeFor] = useState<Relationship | null>(null);

  const transition = async (rel: Relationship, next: RelationshipState) => {
    await stateMut.run(rel.id, next);
    await rels.refetch();
  };

  const selected = visible.find((r) => r.id === selectedRel) ?? null;
  const selectedActor = selected ? actorById.get(selected.actorB) : undefined;

  const loading = rels.loading || acts.loading;
  const error = rels.error || acts.error;

  const totalDone = relationships.filter((r) => r.state === 'completed').length;
  const totalActive = relationships.filter((r) => r.state === 'active' || r.state === 'confirmed').length;

  return (
    <>
      <StageHero
        stage={stages.graph}
        signals={[`${relationships.length}`, `${totalActive}`, `${totalDone} completed`]}
      />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="paper overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 text-[11px]">
            <Select label="State" value={rstate} onChange={(v) => setRstate(v as RelationshipState | 'All')} options={STATES} />
            <div className="ml-auto flex items-center gap-3 text-ink-muted">
              {source && <SourceBadge source={source} />}
              {(['proposed', 'active', 'completed', 'blocked'] as RelationshipState[]).map((s) => (
                <Legend key={s} dot={STATE_STYLE[s].dot}>{STATE_STYLE[s].label}</Legend>
              ))}
            </div>
          </div>

          {source && (
            <div className="px-3 pt-3"><FallbackBanner source={source} onRetry={() => rels.refetch()} /></div>
          )}
          {loading && (
            <div className="grid h-[480px] place-items-center text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
              Loading workflow…
            </div>
          )}
          {error && <div className="p-4"><ErrorState error={error} onRetry={() => { rels.refetch(); acts.refetch(); }} /></div>}

          {!loading && !error && (
            <ConnectedWorkflow
              active={active}
              byLane={byLane}
              actorById={actorById}
              selectedRel={selectedRel}
              onSelect={setSelectedRel}
            />
          )}

          <div className="flex items-center justify-between border-t border-line bg-canvas/60 px-4 py-2 text-[11px] text-ink-muted">
            <span>
              <span className="font-semibold text-ink">{visible.length}</span> relationships in view ·{' '}
              <span className="font-semibold text-ink">{relationships.length}</span> total
            </span>
            <span className="text-ink-subtle">Click any card to inspect · advance state from the panel</span>
          </div>
        </div>

        <aside className="space-y-4">
          <InspectorCard
            selectedRel={selected}
            selectedActor={selectedActor}
            sourceActor={selected ? actorById.get(selected.actorA) : undefined}
            patientName={active.patientName}
            onTransition={transition}
            onRecordOutcome={(rel) => setOutcomeFor(rel)}
            mutationLoading={stateMut.loading}
            mutationError={stateMut.error}
          />
          <ProgressCard relationships={relationships} />
        </aside>
      </div>

      {outcomeFor && (
        <OutcomeModal
          open={!!outcomeFor}
          onClose={() => setOutcomeFor(null)}
          caseId={active.id}
          relationshipId={outcomeFor.id}
          onRecorded={() => rels.refetch()}
        />
      )}
    </>
  );
}

// ── Connected horizontal workflow ──────────────────────────────────────
//
// Each lane is a column of cards. After layout, we measure every card's
// position relative to the wrapper and draw SVG bezier curves in an
// absolute overlay connecting cards across adjacent columns.

type ActiveCase = ReturnType<typeof useActiveCase>['active'];
const PATIENT_NODE_ID = '__patient__';

function ConnectedWorkflow({
  active, byLane, actorById, selectedRel, onSelect,
}: {
  active: ActiveCase;
  byLane: Map<RelationshipType, Relationship[]>;
  actorById: Map<string, Actor>;
  selectedRel: string | null;
  onSelect: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Per-card refs keyed by a stable id: PATIENT_NODE_ID or relationship id.
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  // Columns of node ids, in workflow order. Patient is its own column.
  const columns: string[][] = [
    [PATIENT_NODE_ID],
    (byLane.get('gp_referral')   ?? []).map((r) => r.id),
    (byLane.get('surgical_team') ?? []).map((r) => r.id),
    (byLane.get('allied_health') ?? []).map((r) => r.id),
  ];

  const [size, setSize]   = useState({ w: 0, h: 0 });
  const [edges, setEdges] = useState<{ from: string; to: string; d: string }[]>([]);

  // Recompute curves whenever the layout could change.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const wrect = wrap.getBoundingClientRect();
      setSize({ w: wrect.width, h: wrect.height });
      const centers = new Map<string, { x: number; y: number; w: number; h: number }>();
      cardRefs.current.forEach((el, id) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        centers.set(id, {
          x: r.left - wrect.left,
          y: r.top  - wrect.top + r.height / 2,
          w: r.width,
          h: r.height,
        });
      });
      const next: { from: string; to: string; d: string }[] = [];
      for (let i = 0; i < columns.length - 1; i++) {
        const left  = columns[i];
        const right = columns[i + 1];
        for (const a of left) {
          const A = centers.get(a);
          if (!A) continue;
          const ax = A.x + A.w;
          const ay = A.y;
          for (const b of right) {
            const B = centers.get(b);
            if (!B) continue;
            const bx = B.x;
            const by = B.y;
            const dx = Math.max(40, (bx - ax) * 0.55);
            const d  = `M ${ax} ${ay} C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}`;
            next.push({ from: a, to: b, d });
          }
        }
      }
      setEdges(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
    // Re-measure when the set of cards changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.map((c) => c.join(',')).join('|')]);

  // Also re-measure on window resize and after fonts/etc settle.
  useEffect(() => {
    const onResize = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wrect = wrap.getBoundingClientRect();
      setSize({ w: wrect.width, h: wrect.height });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Highlight curves touching the selected relationship.
  const isHot = (e: { from: string; to: string }) =>
    selectedRel != null && (e.from === selectedRel || e.to === selectedRel);

  return (
    <div className="overflow-x-auto p-4">
      <div ref={wrapRef} className="relative min-w-[920px]">
        {/* SVG overlay with connecting curves. pointer-events: none so cards stay clickable. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${Math.max(size.w, 1)} ${Math.max(size.h, 1)}`}
        >
          <defs>
            <marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#928a7d" />
            </marker>
            <marker id="wf-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--stage-deep)" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const hot = isHot(e);
            return (
              <path
                key={i}
                d={e.d}
                fill="none"
                stroke={hot ? 'var(--stage-deep)' : '#bfb6a5'}
                strokeWidth={hot ? 2 : 1.25}
                opacity={hot ? 1 : 0.75}
                markerEnd={hot ? 'url(#wf-arrow-hot)' : 'url(#wf-arrow)'}
              />
            );
          })}
        </svg>

        <div className="relative flex items-stretch gap-12">
          <LaneColumn title="Patient" subtitle="Case under coordination" number="·" accent="var(--stage-deep)" count={1} width={180}>
            <CardShell innerRef={setRef(PATIENT_NODE_ID)} selected={false} onSelect={() => onSelect('')}>
              <div className="rounded-xl p-3 text-white" style={{ background: 'var(--stage-deep)' }}>
                <div className="text-[10px] uppercase tracking-[0.16em] opacity-70">Case</div>
                <div className="mt-1 text-[13px] font-semibold leading-snug">{active.patientName}</div>
                <div className="mt-0.5 text-[11px] opacity-80">{active.age}{active.sex} · {active.diagnosis}</div>
              </div>
            </CardShell>
          </LaneColumn>

          {LANES.map((lane) => {
            const items = byLane.get(lane.key) ?? [];
            return (
              <LaneColumn
                key={lane.key}
                title={lane.title}
                subtitle={lane.subtitle}
                number={lane.number}
                accent={lane.accent}
                count={items.length}
                width={220}
              >
                {items.length === 0 ? (
                  <div className="grid h-[120px] place-items-center rounded-xl border border-dashed text-center text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle"
                       style={{ borderColor: 'color-mix(in oklab, var(--stage-deep) 16%, transparent)' }}>
                    No relationships yet
                  </div>
                ) : (
                  items.map((r) => (
                    <CardShell
                      key={r.id}
                      innerRef={setRef(r.id)}
                      selected={selectedRel === r.id}
                      onSelect={() => onSelect(r.id)}
                    >
                      <RelCardInner rel={r} actor={actorById.get(r.actorB)} accent={lane.accent} />
                    </CardShell>
                  ))
                )}
              </LaneColumn>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LaneColumn({
  title, subtitle, number, accent, count, width, children,
}: {
  title: string; subtitle: string; number: string; accent: string;
  count: number; width: number; children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2" style={{ width }}>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="section-label" style={{ color: accent }}>{number} · {title}</div>
          <div className="mt-0.5 text-[11px] text-ink-muted">{subtitle}</div>
        </div>
        <span className="rounded-full border border-line bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function CardShell({
  innerRef, selected, onSelect, children,
}: {
  innerRef: (el: HTMLDivElement | null) => void;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={innerRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      className={`cursor-pointer rounded-xl transition ${
        selected ? 'ring-2 ring-ink' : ''
      }`}
    >
      {children}
    </div>
  );
}

function RelCardInner({
  rel, actor, accent,
}: {
  rel: Relationship;
  actor: Actor | undefined;
  accent: string;
}) {
  const s = STATE_STYLE[rel.state];
  return (
    <div className="rounded-xl border border-line bg-paper px-2.5 py-2 text-[12px] shadow-soft">
      <div className="flex items-center gap-2">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
          style={{ background: accent }}
        >
          {actor ? initials(actor.name) : '··'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-ink">{actor?.name ?? 'Unknown actor'}</div>
          <div className="truncate text-[10.5px] text-ink-muted">{actor?.type ?? '—'}</div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{ color: s.fg, background: s.bg }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
          {s.label}
        </span>
        <span className="font-mono text-[10px] text-ink-subtle">w {rel.weight.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ── Inspector & progress ───────────────────────────────────────────────

const NEXT_STATES: Partial<Record<RelationshipState, { state: RelationshipState; label: string }[]>> = {
  proposed:  [{ state: 'confirmed', label: 'Approve' }, { state: 'blocked', label: 'Block' }],
  confirmed: [{ state: 'active', label: 'Activate' }],
  active:    [{ state: 'completed', label: 'Complete + outcome' }],
};

function InspectorCard({
  selectedRel, selectedActor, sourceActor, patientName,
  onTransition, onRecordOutcome, mutationLoading, mutationError,
}: {
  selectedRel: Relationship | null;
  selectedActor: Actor | undefined;
  sourceActor: Actor | undefined;
  patientName: string;
  onTransition: (rel: Relationship, next: RelationshipState) => void;
  onRecordOutcome: (rel: Relationship) => void;
  mutationLoading: boolean;
  mutationError: Error | undefined;
}) {
  if (!selectedRel) {
    return (
      <div className="paper p-4">
        <div className="section-label" style={{ color: 'var(--stage-deep)' }}>Inspector</div>
        <div className="mt-1 text-[12px] text-ink-muted">
          Select any card in the workflow to see its details and move it through state transitions.
        </div>
      </div>
    );
  }

  const next = NEXT_STATES[selectedRel.state] ?? [];
  const s = STATE_STYLE[selectedRel.state];

  return (
    <div className="paper p-4">
      <div className="section-label" style={{ color: 'var(--stage-deep)' }}>Inspector</div>

      <div className="display mt-1 text-lg font-medium tracking-tightish text-ink">
        {selectedActor?.name ?? 'Unknown actor'}
      </div>
      <div className="text-[12px] text-ink-muted">
        {selectedActor?.type ?? '—'} · {selectedActor?.hospital ?? 'NULL'}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <Stat label="State"   value={s.label} />
        <Stat label="Weight"  value={selectedRel.weight.toFixed(2)} />
        <Stat label="Outcome" value={selectedActor?.outcomeScore === null || selectedActor?.outcomeScore === undefined ? 'NULL' : `${selectedActor.outcomeScore.toFixed(1)} / 5`} />
        <Stat label="APC"     value={dateShort(selectedActor?.apcExpiry ?? null)} />
      </div>

      <div className="mt-3 text-[11px] text-ink-muted">
        Flow: <span className="font-medium text-ink">{sourceActor?.name ?? patientName}</span>{' '}
        → <span className="font-medium text-ink">{selectedActor?.name ?? '—'}</span>
      </div>

      {mutationError && (
        <div className="mt-2 text-[11px] text-rose-700">Error: {mutationError.message}</div>
      )}

      {next.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {next.map((t) => (
            <button
              key={t.state}
              onClick={() =>
                t.state === 'completed'
                  ? onRecordOutcome(selectedRel)
                  : onTransition(selectedRel, t.state)
              }
              disabled={mutationLoading}
              className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-ink transition hover:bg-cream/60 disabled:opacity-50"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressCard({ relationships }: { relationships: Relationship[] }) {
  const lanes = LANES.map((l) => {
    const items = relationships.filter((r) => r.type === l.key);
    const done = items.filter((r) => r.state === 'completed').length;
    return { ...l, total: items.length, done };
  });

  return (
    <div className="paper p-4">
      <div className="section-label">Stage progress</div>
      <ul className="mt-3 space-y-2.5">
        {lanes.map((l) => {
          const pct = l.total === 0 ? 0 : Math.round((l.done / l.total) * 100);
          return (
            <li key={l.key}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="font-medium text-ink">{l.number} · {l.title}</span>
                <span className="font-mono text-ink-muted">{l.done}/{l.total}</span>
              </div>
              <div className="bar-track mt-1">
                <div
                  className="bar-fill"
                  style={{ width: `${pct}%`, background: l.accent }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Small bits ─────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-cream/40 px-2.5 py-1.5">
      <div className="section-label">{label}</div>
      <div className="text-[13px] text-ink">{value}</div>
    </div>
  );
}

function Select<T extends string>({
  label, value, onChange, options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
}) {
  return (
    <label className="flex items-center gap-1.5 uppercase tracking-[0.14em] text-ink-subtle">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="field field-sm normal-case tracking-normal"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Legend({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
      <span className="text-[10px]">{children}</span>
    </span>
  );
}
