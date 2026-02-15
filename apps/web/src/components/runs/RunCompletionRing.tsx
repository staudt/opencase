import type { RunStats } from '@/lib/api';
import { computeDerivedMetrics } from './run-stats-utils';

interface RunCompletionRingProps {
  stats: RunStats;
  size?: number;
}

export function RunCompletionRing({ stats, size = 120 }: RunCompletionRingProps) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const { completionPct } = computeDerivedMetrics(stats);
  const filled = (completionPct / 100) * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#d1d5db"
            strokeWidth={strokeWidth}
          />
          {completionPct > 0 && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#22c55e"
              strokeWidth={strokeWidth}
              strokeDasharray={`${filled} ${circumference}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold">{Math.round(completionPct)}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">Completion</span>
    </div>
  );
}
