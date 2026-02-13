import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  Trash2,
  CheckCircle2,
  Archive,
  RotateCcw,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  runApi,
  projectApi,
  type RunDetail,
  type RunItemDetail,
  type ResultDetail,
  type Project,
  type RunStats,
  ApiError,
} from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { useToast } from '@/hooks/use-toast';
import { RunProgressBar } from '@/components/runs/RunProgressBar';
import { ResultStatusBadge, RunStatusBadge } from '@/components/runs/ResultStatusBadge';

const RESULT_STATUSES = [
  { value: 'passed', label: 'Passed', color: '#22c55e' },
  { value: 'failed', label: 'Failed', color: '#ef4444' },
  { value: 'blocked', label: 'Blocked', color: '#f59e0b' },
  { value: 'skipped', label: 'Skipped', color: '#6b7280' },
  { value: 'retest', label: 'Retest', color: '#8b5cf6' },
];

export function RunDetailPage() {
  const { projectId, runId } = useParams<{ projectId: string; runId: string }>();
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [run, setRun] = useState<RunDetail | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRun = useCallback(async () => {
    if (!projectId || !runId) return;
    try {
      setLoading(true);
      const response = await runApi.get(projectId, runId);
      setRun(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load run');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  useEffect(() => {
    if (!projectId || !currentWorkspace) return;
    projectApi.get(currentWorkspace.id, projectId)
      .then((res) => setProject(res.data))
      .catch(console.error);
  }, [projectId, currentWorkspace]);

  const handleRecordResult = async (item: RunItemDetail, status: string) => {
    if (!projectId || !runId || !run) return;

    // Optimistic update
    const prevItems = run.items;
    const updatedItems = run.items.map((i) => {
      if (i.id !== item.id) return i;
      return {
        ...i,
        result: {
          id: i.result?.id ?? 'temp',
          runItemId: i.id,
          status: status as ResultDetail['status'],
          notes: i.result?.notes ?? null,
          duration: i.result?.duration ?? null,
          recordedBy: i.result?.recordedBy ?? { id: '', email: '', name: '', avatarUrl: null },
          recordedAt: new Date().toISOString(),
        },
      };
    });
    setRun({ ...run, items: updatedItems, stats: computeLocalStats(updatedItems) });

    try {
      await runApi.recordResult(projectId, runId, item.id, { status });
    } catch (err) {
      // Revert on failure
      setRun({ ...run, items: prevItems });
      const message = err instanceof ApiError ? err.message : 'Failed to record result';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleClearResult = async (item: RunItemDetail) => {
    if (!projectId || !runId || !run) return;

    const prevItems = run.items;
    const updatedItems = run.items.map((i) =>
      i.id === item.id ? { ...i, result: null } : i
    );
    setRun({ ...run, items: updatedItems, stats: computeLocalStats(updatedItems) });

    try {
      await runApi.clearResult(projectId, runId, item.id);
    } catch (err) {
      setRun({ ...run, items: prevItems });
      const message = err instanceof ApiError ? err.message : 'Failed to clear result';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleComplete = async () => {
    if (!projectId || !runId) return;
    setActionLoading(true);
    try {
      await runApi.update(projectId, runId, { status: 'completed' });
      setShowCompleteDialog(false);
      toast({ title: 'Success', description: 'Run completed' });
      fetchRun();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to complete run';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!projectId || !runId) return;
    try {
      await runApi.update(projectId, runId, { status: 'archived' });
      toast({ title: 'Success', description: 'Run archived' });
      fetchRun();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to archive run';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleReopen = async () => {
    if (!projectId || !runId) return;
    try {
      await runApi.update(projectId, runId, { status: 'active' });
      toast({ title: 'Success', description: 'Run reopened' });
      fetchRun();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to reopen run';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!projectId || !runId) return;
    setActionLoading(true);
    try {
      await runApi.delete(projectId, runId);
      toast({ title: 'Success', description: 'Run deleted' });
      navigate('/runs');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete run';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading run...</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error ?? 'Run not found'}</p>
      </div>
    );
  }

  const isActive = run.status === 'active';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground">Projects</Link>
        <ChevronRight className="h-4 w-4" />
        <Link to={`/projects/${projectId}`} className="hover:text-foreground">
          {project?.name ?? 'Project'}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/runs" className="hover:text-foreground">Runs</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{run.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">{run.title}</h2>
            <RunStatusBadge status={run.status} />
          </div>
          {run.description && (
            <p className="text-muted-foreground mt-1">{run.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span>Created by {run.createdBy.name}</span>
            <span>{new Date(run.createdAt).toLocaleString()}</span>
            {run.completedAt && <span>Completed {new Date(run.completedAt).toLocaleString()}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isActive && run.items.length > 0 && (
            <Button
              onClick={() => {
                const firstUntestedIdx = run.items.findIndex((i) => !i.result);
                const idx = firstUntestedIdx >= 0 ? firstUntestedIdx : 0;
                navigate(`/projects/${projectId}/runs/${runId}/execute?item=${idx}`);
              }}
            >
              <Play className="h-4 w-4 mr-2" />
              Execute
            </Button>
          )}
          {isActive && (
            <Button variant="outline" onClick={() => setShowCompleteDialog(true)}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complete
            </Button>
          )}
          {run.status === 'completed' && (
            <>
              <Button variant="outline" size="sm" onClick={handleReopen}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reopen
              </Button>
              <Button variant="outline" size="sm" onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-card rounded-lg border p-4">
        <div className="mb-3">
          <RunProgressBar stats={run.stats} />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <StatCount label="Passed" count={run.stats.passed} color="#22c55e" />
          <StatCount label="Failed" count={run.stats.failed} color="#ef4444" />
          <StatCount label="Blocked" count={run.stats.blocked} color="#f59e0b" />
          <StatCount label="Skipped" count={run.stats.skipped} color="#6b7280" />
          <StatCount label="Retest" count={run.stats.retest} color="#8b5cf6" />
          <StatCount label="Untested" count={run.stats.untested} color="#d1d5db" />
          <span className="ml-auto font-medium">{run.stats.total} total</span>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-12">#</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-24">Code</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Title</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-36">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-40">Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {run.items.map((item, index) => (
              <tr
                key={item.id}
                className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer"
                onClick={() => navigate(`/projects/${projectId}/runs/${runId}/execute?item=${index}`)}
              >
                <td className="px-4 py-3 text-sm text-muted-foreground">{index + 1}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-muted-foreground">
                    {item.testVersion.test.code}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm">{item.testVersion.title}</span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {isActive ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1.5 hover:bg-muted rounded px-2 py-1 -mx-2 -my-1 transition-colors">
                          <ResultStatusBadge status={item.result?.status ?? 'untested'} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {RESULT_STATUSES.map((s) => (
                          <DropdownMenuItem
                            key={s.value}
                            onClick={() => handleRecordResult(item, s.value)}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full mr-2 flex-shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.label}
                          </DropdownMenuItem>
                        ))}
                        {item.result && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleClearResult(item)}>
                              Clear result
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <ResultStatusBadge status={item.result?.status ?? 'untested'} />
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {item.result?.recordedBy.name ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Complete dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Run</DialogTitle>
            <DialogDescription>
              {run.stats.untested > 0
                ? `${run.stats.untested} of ${run.stats.total} items are still untested. Complete anyway?`
                : 'All items have been tested. Mark this run as complete?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={actionLoading}>
              {actionLoading ? 'Completing...' : 'Complete Run'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Run</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{run.title}&rdquo; and all its results. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? 'Deleting...' : 'Delete Run'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span>{count} {label}</span>
    </span>
  );
}

function computeLocalStats(items: RunItemDetail[]): RunStats {
  const stats: RunStats = { total: items.length, passed: 0, failed: 0, blocked: 0, skipped: 0, retest: 0, untested: 0 };
  for (const item of items) {
    if (item.result) {
      const key = item.result.status as keyof RunStats;
      if (key in stats && key !== 'total' && key !== 'untested') {
        stats[key]++;
      }
    }
  }
  stats.untested = stats.total - (stats.passed + stats.failed + stats.blocked + stats.skipped + stats.retest);
  return stats;
}
