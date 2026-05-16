import { useCallback, useMemo, useState } from 'react';
import StageHero from '@/components/StageHero';
import SourceBadge, { ErrorState } from '@/components/SourceBadge';
import { loadActors, loadRelationships } from '@/data/source';
import { useApi } from '@/lib/useApi';
import type { Actor, ActorType, Relationship, RelationshipState, RelationshipType } from '@/lib/types';
import { dateShort, initials } from '@/lib/format';
import { stages } from '@/lib/stages';
import { useActiveCase } from '@/lib/activeCase';

const DEPTS = ['All', 'Cardiology', 'Cardiothoracic Surgery', 'Anaesthesia',
  'Operating Theatre', 'Rehabilitation', 'Nutrition', 'Pharmacy', 'Primary Care'];
const STATES: ('All' | RelationshipState)[] = ['All', 'proposed', 'confirmed', 'active', 'completed', 'blocked'];
const RTYPES: ('All' | RelationshipType)[] = ['All', 'gp_referral', 'surgical_team', 'allied_health'];

const W = 720;
const H = 480;

const POS: Record<string, { x: number; y: number }> = {
  'case-zainal': { x: W / 2, y: H / 2 },
  'a-gp-01':     { x: 110, y: 100 },
  'a-card-01':   { x: 180, y: H / 2 },
  'a-cts-01':    { x: W - 200, y: H / 2 },
  'a-anae-01':   { x: W - 120, y: 130 },
  'a-perf-01':   { x: W - 80,  y: H / 2 + 40 },
  'a-nurse-01':  { x: W - 130, y: H - 110 },
  'a-physio-01': { x: 180, y: H - 100 },
  'a-diet-01':   { x: W / 2 - 60, y: H - 50 },
  'a-pharm-01':  { x: W / 2 + 90, y: H - 50 },
};

/** Deterministic circular fallback layout for actor IDs not in POS. */
function autoPos(id: string, index: number, total: number): { x: number; y: number } {
  if (POS[id]) return POS[id];
  // Distribute around the patient on a ring; pick radius based on index parity
  // so two concentric rings reduce overlap for larger graphs.
  const ring = index % 2 === 0 ? 180 : 230;
  const theta = (index / Math.max(total, 1)) * Math.PI * 2;
  return {
    x: W / 2 + Math.cos(theta) * ring,
    y: H / 2 + Math.sin(theta) * ring * 0.7,
  };
}

const COLOR_BY_TYPE: Record<ActorType, string> = {
  GP: '#0ea5e9',
  Cardiologist: '#2563eb',
  'Cardiothoracic Surgeon': '#1d4ed8',
  Anaesthetist: '#7c3aed',
  Perfusionist: '#9333ea',
  'Scrub Nurse': '#c026d3',
  Physiotherapist: '#059669',
  Dietitian: '#16a34a',
  Pharmacist: '#0891b2',
  Coordinator: '#64748b',
};

const STATE_STYLE: Record<RelationshipState, { stroke: string; dash: string }> = {
  proposed:  { stroke: '#928a7d', dash: '4 4' },
  confirmed: { stroke: '#0f766e', dash: '0' },
  active:    { stroke: '#059669', dash: '0' },
  completed: { stroke: '#1e1b30', dash: '0' },
  blocked:   { stroke: '#e11d48', dash: '2 3' },
};

export default function Graph() {
  const { active } = useActiveCase();
  const [dept, setDept] = useState('All');
  const [rstate, setRstate] = useState<typeof STATES[number]>('All');
  const [rtype, setRtype] = useState<typeof RTYPES[number]>('All');
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>('a-cts-01');

  const relsFetcher = useCallback(
    () => loadRelationships({ case_id: active.id }),
    [active.id],
  );
  const actorsFetcher = useCallback(() => loadActors(), []);

  const rels = useApi(relsFetcher, []);
  const acts = useApi(actorsFetcher, []);

  const relationships = rels.data?.data ?? [];
  const actors = acts.data?.data ?? [];
  const source = rels.data?.source;
  const actorById = useMemo(() => new Map(actors.map((a) => [a.id, a])), [actors]);

  const visibleEdges = useMemo(
    () =>
      relationships.filter(
        (r: Relationship) =>
          (dept === 'All' || r.department === dept) &&
          (rstate === 'All' || r.state === rstate) &&
          (rtype === 'All' || r.type === rtype),
      ),
    [relationships, dept, rstate, rtype],
  );

  const visibleNodes = useMemo(() => {
    const ids = new Set<string>(['case-zainal']);
    visibleEdges.forEach((r) => { ids.add(r.actorA); ids.add(r.actorB); });
    return ids;
  }, [visibleEdges]);

  // Stable id → position for every visible actor (real UUIDs included).
  const visibleActorIds = useMemo(
    () => actors.filter((a) => visibleNodes.has(a.id)).map((a) => a.id),
    [actors, visibleNodes],
  );
  const positionFor = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    map.set('case-zainal', POS['case-zainal']);
    visibleActorIds.forEach((id, i) => map.set(id, autoPos(id, i, visibleActorIds.length)));
    return map;
  }, [visibleActorIds]);

  const selectedActor: Actor | undefined =
    selectedNode && selectedNode !== 'case-zainal'
      ? actorById.get(selectedNode)
      : undefined;
  const selectedEdges = relationships.filter(
    (r) => selectedNode && (r.actorA === selectedNode || r.actorB === selectedNode),
  );

  const loading = rels.loading || acts.loading;
  const error = rels.error || acts.error;

  return (
    <>
      <StageHero
        stage={stages.graph}
        signals={[`${visibleNodes.size}`, `${visibleEdges.length}`, '0.28 (sparse · expected)']}
      />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="paper overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 text-[11px]">
            <Select label="Department" value={dept} onChange={setDept} options={DEPTS} />
            <Select label="State"      value={rstate} onChange={(v) => setRstate(v as RelationshipState | 'All')} options={STATES} />
            <Select label="Type"       value={rtype} onChange={(v) => setRtype(v as RelationshipType | 'All')} options={RTYPES} />
            <div className="ml-auto flex items-center gap-3 text-ink-muted">
              {source && <SourceBadge source={source} />}
              <Legend swatch={STATE_STYLE.proposed.stroke} dash>Proposed</Legend>
              <Legend swatch={STATE_STYLE.confirmed.stroke}>Confirmed</Legend>
              <Legend swatch={STATE_STYLE.active.stroke}>Active</Legend>
              <Legend swatch={STATE_STYLE.blocked.stroke} dash>Blocked</Legend>
            </div>
          </div>

          {loading && (
            <div className="grid h-[480px] place-items-center text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
              Loading graph…
            </div>
          )}
          {error && <div className="p-4"><ErrorState error={error} onRetry={() => { rels.refetch(); acts.refetch(); }} /></div>}

          {!loading && !error && (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="block h-[480px] w-full"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--stage-soft) 70%, white) 0%, white 70%)',
              }}
            >
              <defs>
                <pattern id="dot" width="22" height="22" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.6" fill="#cfc4ad" />
                </pattern>
              </defs>
              <rect width={W} height={H} fill="url(#dot)" />

              {visibleEdges.map((r) => {
                const a = positionFor.get(r.actorA) ?? POS['case-zainal'];
                const b = positionFor.get(r.actorB) ?? POS['case-zainal'];
                const s = STATE_STYLE[r.state];
                const isHover = hoverEdge === r.id;
                return (
                  <g key={r.id}
                     onMouseEnter={() => setHoverEdge(r.id)}
                     onMouseLeave={() => setHoverEdge(null)}
                     className="cursor-pointer">
                    <line
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={s.stroke}
                      strokeWidth={isHover ? 3.5 : 1.2 + r.weight * 2.5}
                      strokeDasharray={s.dash}
                      opacity={isHover ? 1 : 0.85}
                    />
                    {isHover && (
                      <text
                        x={(a.x + b.x) / 2}
                        y={(a.y + b.y) / 2 - 8}
                        textAnchor="middle"
                        className="fill-ink text-[10px] font-medium"
                      >
                        {r.type.replace('_', ' ')} · w {r.weight.toFixed(2)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Patient node */}
              <g onClick={() => setSelectedNode('case-zainal')} className="cursor-pointer">
                <circle cx={POS['case-zainal'].x} cy={POS['case-zainal'].y} r="44"
                  fill="none" stroke="var(--stage-mid)" strokeWidth="2" opacity="0.35"
                  strokeDasharray="3 4" />
                <circle cx={POS['case-zainal'].x} cy={POS['case-zainal'].y} r="36"
                  fill="var(--stage-deep)" stroke="white" strokeWidth="3.5"
                  opacity={selectedNode === 'case-zainal' ? 1 : 0.95} />
                <text x={POS['case-zainal'].x} y={POS['case-zainal'].y - 2}
                  textAnchor="middle"
                  className="fill-white text-[9px] font-semibold uppercase tracking-[0.16em]">
                  Patient
                </text>
                <text x={POS['case-zainal'].x} y={POS['case-zainal'].y + 12}
                  textAnchor="middle"
                  className="fill-white text-[11px] font-semibold">
                  Zainal
                </text>
              </g>

              {actors.filter((a) => visibleNodes.has(a.id) && positionFor.has(a.id)).map((a) => {
                const p = positionFor.get(a.id)!;
                const color = COLOR_BY_TYPE[a.type] ?? '#64748b';
                const isSel = selectedNode === a.id;
                return (
                  <g key={a.id}
                     onClick={() => setSelectedNode(a.id)}
                     className="cursor-pointer">
                    <circle cx={p.x} cy={p.y} r={isSel ? 26 : 22}
                      fill="white" stroke={color} strokeWidth={isSel ? 3 : 2.2} />
                    <text x={p.x} y={p.y + 4} textAnchor="middle"
                      className="fill-ink text-[10px] font-semibold">
                      {initials(a.name)}
                    </text>
                    <text x={p.x} y={p.y + 40} textAnchor="middle"
                      className="fill-ink text-[10px]">
                      {a.name.split(' ').slice(0, 3).join(' ')}
                    </text>
                    <text x={p.x} y={p.y + 52} textAnchor="middle"
                      className="fill-ink-muted text-[9px]">
                      {a.type}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          <div className="flex items-center justify-between border-t border-line bg-canvas/60 px-4 py-2 text-[11px] text-ink-muted">
            <span>
              <span className="font-semibold text-ink">{visibleEdges.length}</span> relationships ·{' '}
              <span className="font-semibold text-ink">{visibleNodes.size}</span> entities
            </span>
            <span className="font-mono">GET /relationships, /actors</span>
          </div>
        </div>

        <aside className="space-y-4">
          <InspectorCard
            selectedActor={selectedActor}
            edges={selectedEdges}
            patientCentered={selectedNode === 'case-zainal'}
            patientName={active.patientName}
            patientId={active.id}
          />
          <DistributionCard relationships={relationships} />
        </aside>
      </div>
    </>
  );
}

function InspectorCard({
  selectedActor, edges, patientCentered, patientName, patientId,
}: {
  selectedActor: Actor | undefined;
  edges: Relationship[];
  patientCentered: boolean;
  patientName: string;
  patientId: string;
}) {
  return (
    <div className="paper p-4">
      <div className="section-label" style={{ color: 'var(--stage-deep)' }}>
        Inspector
      </div>

      {patientCentered ? (
        <>
          <div className="display mt-1 text-lg font-medium tracking-tightish text-ink">
            {patientName} · {patientId}
          </div>
          <div className="text-[12px] text-ink-muted">Patient · all relationships fan out from here</div>
        </>
      ) : selectedActor ? (
        <>
          <div className="display mt-1 text-lg font-medium tracking-tightish text-ink">
            {selectedActor.name}
          </div>
          <div className="text-[12px] text-ink-muted">
            {selectedActor.type} · {selectedActor.hospital ?? 'NULL'}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <Stat label="Outcome" value={selectedActor.outcomeScore === null ? 'NULL' : `${selectedActor.outcomeScore.toFixed(1)} / 5`} />
            <Stat label="Cases"   value={selectedActor.caseCount === null ? 'NULL' : `${selectedActor.caseCount}`} />
            <Stat label="Load"    value={selectedActor.capacityPct === null ? 'NULL' : `${selectedActor.capacityPct}%`} />
            <Stat label="APC"     value={dateShort(selectedActor.apcExpiry)} />
          </div>
        </>
      ) : null}

      <div className="mt-4">
        <div className="section-label">Edges from this node · {edges.length}</div>
        <ul className="mt-2 space-y-1.5">
          {edges.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-line bg-cream/40 px-2.5 py-1.5 text-[12px]"
            >
              <div>
                <div className="font-medium text-ink">
                  {e.type.replace('_', ' ')}
                </div>
                <div className="text-[11px] text-ink-subtle">
                  {e.department}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[11px] text-ink">w {e.weight.toFixed(2)}</div>
                <div className={`text-[10px] uppercase tracking-wider ${
                  e.state === 'blocked'   ? 'text-rose-700'
                  : e.state === 'proposed' ? 'text-ink-subtle'
                  : 'text-emerald-700'
                }`}>{e.state}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DistributionCard({ relationships }: { relationships: Relationship[] }) {
  const buckets = [
    { label: 'Confirmed', value: relationships.filter((r) => r.state === 'confirmed').length, color: '#0f766e' },
    { label: 'Proposed',  value: relationships.filter((r) => r.state === 'proposed').length,  color: '#928a7d' },
    { label: 'Active',    value: relationships.filter((r) => r.state === 'active').length,    color: '#059669' },
    { label: 'Blocked',   value: relationships.filter((r) => r.state === 'blocked').length,   color: '#e11d48' },
  ];
  const total = buckets.reduce((s, b) => s + b.value, 0) || 1;
  return (
    <div className="paper p-4">
      <div className="section-label">Relationship states</div>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full">
        {buckets.map((b) => (
          <div
            key={b.label}
            style={{ width: `${(b.value / total) * 100}%`, background: b.color }}
            title={`${b.label}: ${b.value}`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[12px]">
        {buckets.map((b) => (
          <li key={b.label} className="flex items-center gap-2 text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
            <span>{b.label}</span>
            <span className="ml-auto font-mono text-ink">{b.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

function Legend({ swatch, dash, children }: { swatch: string; dash?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width="18" height="6">
        <line x1="0" y1="3" x2="18" y2="3" stroke={swatch} strokeWidth="2" strokeDasharray={dash ? '3 3' : '0'} />
      </svg>
      <span className="text-[10px]">{children}</span>
    </span>
  );
}
