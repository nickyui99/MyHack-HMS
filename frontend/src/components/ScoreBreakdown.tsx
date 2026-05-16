import type { ScoreBreakdown as Score } from '@/lib/types';
import { pct } from '@/lib/format';

interface Props {
  score: Score;
  compact?: boolean;
}

export default function ScoreBreakdown({ score, compact }: Props) {
  const rows: { label: string; value: number; gradient: string }[] = [
    {
      label: 'Vector similarity',
      value: score.vectorSimilarity,
      gradient: 'linear-gradient(90deg, #5eead4, #14b8a6)',
    },
    {
      label: 'Rule compliance',
      value: score.ruleCompliance,
      gradient: 'linear-gradient(90deg, #6ee7b7, #059669)',
    },
    {
      label: 'Outcome weight',
      value: score.outcomeWeight,
      gradient: 'linear-gradient(90deg, #a78bfa, #7c3aed)',
    },
  ];
  if (score.historicalPairBonus !== undefined && score.historicalPairBonus > 0) {
    rows.push({
      label: 'Historical-pair bonus',
      value: score.historicalPairBonus * 5,
      gradient: 'linear-gradient(90deg, #fcd34d, #f59e0b)',
    });
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {rows.map((r) => {
        const v = Math.min(1, r.value);
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-ink-subtle">
              <span>{r.label}</span>
              <span className="font-mono text-[11px] text-ink tabular">{pct(v, 0)}</span>
            </div>
            <div className="bar-track mt-1">
              <div
                className="bar-fill"
                style={{
                  background: r.gradient,
                  width: `${v * 100}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
