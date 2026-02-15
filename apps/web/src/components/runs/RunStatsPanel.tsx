import type { RunStats, RunItemDetail } from '@/lib/api';
import { RunProgressBar } from './RunProgressBar';
import { RunCompletionRing } from './RunCompletionRing';
import {
  STATUS_META,
  RESULT_STATUS_KEYS,
  computeDerivedMetrics,
  computeAssigneeStats,
  type AssigneeStats,
} from './run-stats-utils';

interface RunStatsPanelProps {
  stats: RunStats;
  items: RunItemDetail[];
}

export function RunStatsPanel({ stats, items }: RunStatsPanelProps) {
  const derived = computeDerivedMetrics(stats);
  const assigneeStats = computeAssigneeStats(items);
  const showAssigneeTable =
    assigneeStats.length > 1 || (assigneeStats.length === 1 && assigneeStats[0].userId !== null);

  return (
    <div className="bg-card rounded-lg border">
      {/* Top section: ring + metrics + status bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
        {/* Column 1: Completion ring */}
        <div className="flex justify-center md:justify-start items-center">
          <RunCompletionRing stats={stats} />
        </div>

        {/* Column 2: Summary metrics */}
        <div className="space-y-3">
          <MetricCard
            label="Completion"
            value={`${Math.round(derived.completionPct)}%`}
            subtext={`${derived.tested} of ${stats.total} tested`}
          />
          <MetricCard
            label="Pass Rate"
            value={derived.tested > 0 ? `${Math.round(derived.passRate)}%` : '—'}
            subtext={derived.tested > 0 ? `${stats.passed} of ${derived.tested} passed` : 'No results yet'}
          />
          <MetricCard
            label="Fail Rate"
            value={derived.tested > 0 ? `${Math.round(derived.failRate)}%` : '—'}
            subtext={derived.tested > 0 ? `${stats.failed} of ${derived.tested} failed` : 'No results yet'}
          />
        </div>

        {/* Column 3: Status breakdown bars */}
        <div className="space-y-2.5">
          {RESULT_STATUS_KEYS.map((key) => {
            const count = stats[key];
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            const meta = STATUS_META[key];
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className="w-16 text-muted-foreground text-xs">{meta.label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  {count > 0 && (
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: meta.color }}
                    />
                  )}
                </div>
                <span className="w-6 text-right text-xs font-medium">{count}</span>
                <span className="w-10 text-right text-xs text-muted-foreground">
                  {Math.round(pct)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Middle section: progress bar + stat dots */}
      <div className="border-t px-6 py-4">
        <div className="mb-3">
          <RunProgressBar stats={stats} />
        </div>
        <div className="flex items-center gap-4 text-sm">
          {RESULT_STATUS_KEYS.map((key) => (
            <span key={key} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_META[key].color }}
              />
              <span>{stats[key]} {STATUS_META[key].label}</span>
            </span>
          ))}
          <span className="ml-auto font-medium">{stats.total} total</span>
        </div>
      </div>

      {/* Bottom section: per-assignee breakdown */}
      {showAssigneeTable && (
        <AssigneeBreakdownTable assigneeStats={assigneeStats} />
      )}
    </div>
  );
}

function MetricCard({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <div className="p-3 rounded-md bg-muted/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}

function AssigneeBreakdownTable({ assigneeStats }: { assigneeStats: AssigneeStats[] }) {
  const statusKeys = ['passed', 'failed', 'blocked', 'skipped', 'retest', 'untested'] as const;

  return (
    <div className="border-t px-6 py-4">
      <h4 className="text-sm font-medium text-muted-foreground mb-3">By Assignee</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left py-2 pr-4 font-medium">Assignee</th>
              <th className="text-left py-2 pr-2 font-medium w-32">Progress</th>
              <th className="text-right py-2 px-2 font-medium">Total</th>
              {statusKeys.map((key) => (
                <th key={key} className="text-right py-2 px-2 font-medium">
                  {STATUS_META[key].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assigneeStats.map((a) => {
              const testedPct = a.total > 0 ? (a.tested / a.total) * 100 : 0;
              return (
                <tr key={a.userId ?? 'unassigned'} className="border-t">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center flex-shrink-0">
                        {a.userId ? a.name.charAt(0).toUpperCase() : '?'}
                      </span>
                      <span className={a.userId ? '' : 'text-muted-foreground italic'}>
                        {a.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        {testedPct > 0 && (
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${testedPct}%`, backgroundColor: '#22c55e' }}
                          />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {Math.round(testedPct)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-2 font-medium">{a.total}</td>
                  {statusKeys.map((key) => {
                    const count = a[key];
                    return (
                      <td
                        key={key}
                        className="text-right py-2 px-2"
                        style={count > 0 ? { color: STATUS_META[key].color } : undefined}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
