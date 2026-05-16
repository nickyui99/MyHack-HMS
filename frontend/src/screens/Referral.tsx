import { useCallback, useEffect, useMemo, useState } from 'react';
import StageHero from '@/components/StageHero';
import CandidateCard from '@/components/CandidateCard';
import FilterBar from '@/components/FilterBar';
import SourceBadge, { ErrorState, SkeletonList } from '@/components/SourceBadge';
import Disclosure from '@/components/Disclosure';
import { loadActors, runReferralMatch } from '@/data/source';
import { useApi } from '@/lib/useApi';
import { useActiveCase } from '@/lib/activeCase';
import { stages } from '@/lib/stages';
import type { Actor } from '@/lib/types';
import { initials, nullable } from '@/lib/format';

export default function Referral() {
  const { active } = useActiveCase();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [panelFilter, setPanelFilter] = useState('All panels');
  const [region, setRegion] = useState('All regions');

  // Re-fetch when the user switches patients in the TopBar dropdown.
  const fetcher = useCallback(() => runReferralMatch(active.id), [active.id]);
  const { data, loading, error, refetch } = useApi(fetcher, [active.id]);

  // Manual picker — list every cardiologist in the backend so the user can
  // override the auto-recommendation if they have someone in mind.
  const actorFetcher = useCallback(
    () => loadActors({ type: 'Cardiologist' }),
    [],
  );
  const actorsApi = useApi(actorFetcher, []);
  const allCardiologists = actorsApi.data?.data ?? [];

  const candidates = data?.data ?? [];
  const source = data?.source;

  // Reset selection whenever a new match run comes back.
  useEffect(() => {
    if (candidates.length > 0) {
      setSelected(candidates[0].actor.id);
    } else {
      setSelected(null);
    }
  }, [candidates]);

  const visible = useMemo(() => {
    return candidates.filter((c) => {
      const s = search.toLowerCase();
      const matchSearch = !s ||
        c.actor.name.toLowerCase().includes(s) ||
        (c.actor.hospital ?? '').toLowerCase().includes(s);
      const matchPanel = panelFilter === 'All panels' || c.actor.panels.includes(panelFilter);
      const matchRegion = region === 'All regions' || c.actor.region === region;
      return matchSearch && matchPanel && matchRegion;
    });
  }, [candidates, search, panelFilter, region]);

  const featured = visible[0];
  const alternates = visible.slice(1);

  // Anyone not in the auto-recommended list — surfaced in the manual picker.
  const recommendedIds = new Set(candidates.map((c) => c.actor.id));
  const otherCardiologists = allCardiologists.filter((a) => !recommendedIds.has(a.id));

  return (
    <>
      <StageHero
        stage={stages.referral}
        signals={['1,284', '14 min', '92% panel-confirmed']}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="display text-xl font-medium tracking-tightish text-ink">
                Recommended cardiologists for {active.patientName}
              </h2>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                {active.diagnosis}
                {active.panel ? ` · ${active.panel}` : ''}
                {active.region ? ` · ${active.region}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {source && <SourceBadge source={source} />}
              <span className="font-mono text-[11px] text-ink-subtle">
                POST /match/referral
              </span>
            </div>
          </div>

          {loading && <SkeletonList rows={3} />}
          {error && <ErrorState error={error} onRetry={refetch} />}

          {!loading && !error && featured && (
            <CandidateCard
              variant="featured"
              candidate={featured}
              rank={1}
              selected={selected === featured.actor.id}
              onSelect={() => setSelected(featured.actor.id)}
              ctaLabel="Send referral"
            />
          )}

          {!loading && !error && alternates.length > 0 && (
            <div className="mt-5">
              <Disclosure
                size="lg"
                label="See other recommended cardiologists"
                hint={`${alternates.length} ranked`}
              >
                <div className="space-y-3">
                  {alternates.map((c, i) => (
                    <CandidateCard
                      key={c.actor.id}
                      candidate={c}
                      rank={i + 2}
                      selected={selected === c.actor.id}
                      onSelect={() => setSelected(c.actor.id)}
                    />
                  ))}
                </div>
              </Disclosure>
            </div>
          )}

          {!loading && !error && (
            <div className="mt-3">
              <Disclosure
                size="lg"
                label="Pick manually · choose a cardiologist yourself"
                hint={allCardiologists.length ? `${allCardiologists.length} in directory` : undefined}
              >
                {actorsApi.loading && <div className="text-[12px] text-ink-subtle">Loading…</div>}
                {actorsApi.error && (
                  <div className="text-[12px] text-rose-700">
                    Couldn't load cardiologist list.
                  </div>
                )}
                {!actorsApi.loading && !actorsApi.error && (
                  <>
                    {recommendedIds.size > 0 && (
                      <p className="mb-3 text-[12px] text-ink-muted">
                        Pick any cardiologist, including ones not auto-recommended.
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {otherCardiologists.length === 0 && allCardiologists.length === 0 && (
                        <div className="text-[12px] text-ink-subtle">No cardiologists in directory.</div>
                      )}
                      {otherCardiologists.map((a) => (
                        <ManualPickRow
                          key={a.id}
                          actor={a}
                          selected={selected === a.id}
                          onSelect={() => setSelected(a.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </Disclosure>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="paper p-4">
            <div className="section-label">Refine candidates</div>
            <div className="mt-3 flex flex-col gap-2">
              <FilterBar
                filters={[
                  { label: 'Panel', value: panelFilter, onChange: setPanelFilter,
                    options: ['All panels', 'Prudential BSN', 'AIA', 'Great Eastern', 'Allianz'] },
                  { label: 'Region', value: region, onChange: setRegion,
                    options: ['All regions', 'Klang Valley', 'Puchong'] },
                ]}
                search={{ value: search, onChange: setSearch, placeholder: 'Name or hospital…' }}
              />
            </div>
          </div>

          <Disclosure label="Why this ranking">
            <ReasoningCard />
          </Disclosure>
          <Disclosure label="Pipeline · last run">
            <PipelineCard />
          </Disclosure>
        </aside>
      </div>
    </>
  );
}

function ManualPickRow({
  actor, selected, onSelect,
}: {
  actor: Actor;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={[
        'flex items-center gap-3 rounded-xl border bg-paper px-3 py-2 text-left transition',
        selected
          ? 'border-teal-400 ring-2 ring-teal-200/70'
          : 'border-line hover:bg-cream/50',
      ].join(' ')}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-teal-200 text-[11px] font-semibold text-teal-800">
        {initials(actor.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">{actor.name}</div>
        <div className="truncate text-[11px] text-ink-subtle">
          {nullable(actor.hospital)}
        </div>
      </div>
      <span className="text-[11px] text-ink-muted">
        {selected ? 'Selected' : 'Pick'}
      </span>
    </button>
  );
}

function ReasoningCard() {
  return (
    <div className="paper p-4">
      <div className="section-label" style={{ color: 'var(--stage-deep)' }}>
        Why this ranking
      </div>
      <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink">
        <Step n={1}>
          Patient profile embedded → top-10 cardiologists retrieved from
          <span className="font-mono"> pgvector</span> on
          <span className="font-mono"> text-embedding-005</span>.
        </Step>
        <Step n={2}>
          Compliance gate filters by APC validity, panel match (Prudential BSN),
          and capacity headroom &gt; 20%.
        </Step>
        <Step n={3}>
          Outcome weights pulled from the relationship graph — last 24 months
          of similar NSTEMI referrals.
        </Step>
        <Step n={4}>
          Gemini 3.1 generates the human-readable rationale per candidate.
        </Step>
      </ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cream text-[10px] font-semibold text-ink-muted tabular">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function PipelineCard() {
  const stages = [
    { name: 'EKG reconcile', ms: 86 },
    { name: 'Vector retrieve', ms: 142 },
    { name: 'Compliance gate', ms: 38 },
    { name: 'Outcome weight', ms: 92 },
    { name: 'Gemini explain', ms: 54 },
  ];
  const max = Math.max(...stages.map((s) => s.ms));
  return (
    <div className="paper p-4">
      <div className="flex items-center justify-between">
        <span className="section-label">Pipeline · last run</span>
        <span className="font-mono text-[11px] text-ink-subtle">
          {stages.reduce((s, x) => s + x.ms, 0)} ms total
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {stages.map((s) => (
          <div key={s.name}>
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span>{s.name}</span>
              <span className="font-mono">{s.ms}ms</span>
            </div>
            <div className="bar-track mt-1">
              <div className="h-full bg-ink" style={{ width: `${(s.ms / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
