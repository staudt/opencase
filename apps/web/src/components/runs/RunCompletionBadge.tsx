import type { RunStats } from '@/lib/api';
import { computeDerivedMetrics } from './run-stats-utils';

interface RunCompletionBadgeProps {
  stats: RunStats;
}

export function RunCompletionBadge({ stats }: RunCompletionBadgeProps) {
  const { completionPct } = computeDerivedMetrics(stats);
  const pct = Math.round(completionPct);

  return (
    <span
      className={`text-xs font-medium px-1.5 py-0.5 rounded ${
        pct === 100
          ? 'bg-green-100 text-green-700'
          : pct > 0
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-500'
      }`}
    >
      {pct}%
    </span>
  );
}
