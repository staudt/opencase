import type { RunStats, RunItemDetail } from '@/lib/api';

export const STATUS_META: Record<string, { label: string; color: string }> = {
  passed: { label: 'Passed', color: '#22c55e' },
  failed: { label: 'Failed', color: '#ef4444' },
  blocked: { label: 'Blocked', color: '#f59e0b' },
  skipped: { label: 'Skipped', color: '#6b7280' },
  retest: { label: 'Retest', color: '#8b5cf6' },
  untested: { label: 'Untested', color: '#d1d5db' },
};

export const RESULT_STATUS_KEYS = ['passed', 'failed', 'blocked', 'skipped', 'retest', 'untested'] as const;

export interface DerivedMetrics {
  tested: number;
  completionPct: number;
  passRate: number;
  failRate: number;
}

export function computeDerivedMetrics(stats: RunStats): DerivedMetrics {
  const tested = stats.total - stats.untested;
  return {
    tested,
    completionPct: stats.total > 0 ? (tested / stats.total) * 100 : 0,
    passRate: tested > 0 ? (stats.passed / tested) * 100 : 0,
    failRate: tested > 0 ? (stats.failed / tested) * 100 : 0,
  };
}

export interface AssigneeStats {
  userId: string | null;
  name: string;
  email: string;
  avatarUrl: string | null;
  total: number;
  tested: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  retest: number;
  untested: number;
}

export function computeAssigneeStats(items: RunItemDetail[]): AssigneeStats[] {
  const map = new Map<string | null, AssigneeStats>();

  for (const item of items) {
    const key = item.assignedTo?.id ?? null;

    if (!map.has(key)) {
      map.set(key, {
        userId: key,
        name: item.assignedTo?.name ?? 'Unassigned',
        email: item.assignedTo?.email ?? '',
        avatarUrl: item.assignedTo?.avatarUrl ?? null,
        total: 0,
        tested: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
        skipped: 0,
        retest: 0,
        untested: 0,
      });
    }

    const entry = map.get(key)!;
    entry.total++;

    if (item.result) {
      const status = item.result.status as keyof AssigneeStats;
      if (status in entry && status !== 'untested') {
        (entry[status] as number)++;
      }
      entry.tested++;
    } else {
      entry.untested++;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.userId === null) return 1;
    if (b.userId === null) return -1;
    return a.name.localeCompare(b.name);
  });
}
