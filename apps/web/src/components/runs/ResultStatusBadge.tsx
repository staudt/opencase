const STATUS_COLORS: Record<string, string> = {
  passed: '#22c55e',
  failed: '#ef4444',
  blocked: '#f59e0b',
  skipped: '#6b7280',
  retest: '#8b5cf6',
  untested: '#d1d5db',
};

const STATUS_LABELS: Record<string, string> = {
  passed: 'Passed',
  failed: 'Failed',
  blocked: 'Blocked',
  skipped: 'Skipped',
  retest: 'Retest',
  untested: 'Untested',
};

export function ResultStatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#d1d5db';
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export function RunStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    archived: 'bg-gray-100 text-gray-700',
  };
  const labels: Record<string, string> = {
    active: 'Active',
    completed: 'Completed',
    archived: 'Archived',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {labels[status] ?? status}
    </span>
  );
}
