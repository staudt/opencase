import type { RunStats } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  passed: '#22c55e',
  failed: '#ef4444',
  blocked: '#f59e0b',
  retest: '#8b5cf6',
  skipped: '#6b7280',
};

const SEGMENTS: Array<keyof RunStats> = ['passed', 'failed', 'blocked', 'retest', 'skipped'];

export function RunProgressBar({ stats }: { stats: RunStats }) {
  if (stats.total === 0) {
    return <span className="text-muted-foreground text-sm">No items</span>;
  }

  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted">
      {SEGMENTS.map((key) => {
        const count = stats[key];
        if (count === 0) return null;
        const pct = (count / stats.total) * 100;
        return (
          <div
            key={key}
            style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[key] }}
          />
        );
      })}
    </div>
  );
}
