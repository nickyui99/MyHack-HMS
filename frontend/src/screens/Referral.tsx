import { useCallback, useEffect, useMemo, useState } from 'react';
import StageHero from '@/components/StageHero';
import CandidateCard from '@/components/CandidateCard';
import FilterBar from '@/components/FilterBar';
import SourceBadge, { ErrorState, SkeletonList } from '@/components/SourceBadge';
import { runReferralMatch } from '@/data/source';
import { useApi } from '@/lib/useApi';
import { activeCase } from '@/data/cases';
import { stages } from '@/lib/stages';

export default function Referral() {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [panelFilter, setPanelFilter] = useState('All panels');
  const [region, setRegion] = useState('All regions');

  const fetcher = useCallback(() => runReferralMatch(activeCase.id), []);
  const { data, loading, error, refetch } = useApi(fetcher, []);

  const candidates = data?.data ?? [];
  const source = data?.source;

  // Default the selection to the top candidate when data first arrives.
  useEffect(() => {
    if (selected === null && candidates.length > 0) {
      setSelected(candidates[0].actor.id);
    }
  }, [candidates, selected]);

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

  return (
    <>
      <StageHero
        stage={stages.referral}
        signals={['1,284', '14 min', '92% panel-confirmed']}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="display text-xl font-medium tracking-tightish text-ink">
              The Referral Agent recommends
            </h2>
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
            <>
              <div className="mb-3 mt-7 flex items-baseline justify-between">
                <h3 className="display text-base font-medium text-ink">Alternates · ranked</h3>
                <span className="text-[11px] text-ink-subtle">{alternates.length} more</span>
              </div>

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
            </>
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

          <ReasoningCard />
          <PipelineCard />
        </aside>
      </div>
    </>
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
