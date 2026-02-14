import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  runApi,
  type RunDetail,
  type RunItemDetail,
  type ResultDetail,
  type RunStats,
  type Attachment,
  ApiError,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { RunProgressBar } from '@/components/runs/RunProgressBar';
import { ResultStatusBadge } from '@/components/runs/ResultStatusBadge';
import { ReadOnlyBlocks } from '@/components/runs/ReadOnlyBlocks';
import { AttachmentUpload } from '@/components/runs/AttachmentUpload';
import { AttachmentList } from '@/components/runs/AttachmentList';

const RESULT_STATUSES = [
  { value: 'passed', label: 'Passed', color: '#22c55e', key: '1' },
  { value: 'failed', label: 'Failed', color: '#ef4444', key: '2' },
  { value: 'blocked', label: 'Blocked', color: '#f59e0b', key: '3' },
  { value: 'skipped', label: 'Skipped', color: '#6b7280', key: '4' },
  { value: 'retest', label: 'Retest', color: '#8b5cf6', key: '5' },
];

export function RunExecutionPage() {
  const { projectId, runId } = useParams<{ projectId: string; runId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [savingResult, setSavingResult] = useState(false);

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

  // Set initial index from query param
  useEffect(() => {
    if (!run) return;
    const itemParam = searchParams.get('item');
    if (itemParam !== null) {
      const idx = parseInt(itemParam, 10);
      if (!isNaN(idx) && idx >= 0 && idx < run.items.length) {
        setCurrentIndex(idx);
      }
    }
  }, [run, searchParams]);

  // Sync notes and attachments when current item changes
  useEffect(() => {
    if (!run) return;
    const item = run.items[currentIndex];
    setNotes(item?.result?.notes ?? '');
    setPendingAttachments(item?.result?.attachments ?? []);
  }, [currentIndex, run]);

  const currentItem = run?.items[currentIndex] ?? null;
  const isActive = run?.status === 'active';
  const totalItems = run?.items.length ?? 0;

  const goTo = useCallback((index: number) => {
    if (index < 0 || !run || index >= run.items.length) return;
    setCurrentIndex(index);
    setSearchParams({ item: String(index) }, { replace: true });
  }, [run, setSearchParams]);

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  const handleRecordResult = useCallback(async (status: string) => {
    if (!projectId || !runId || !run || !currentItem || savingResult) return;

    const prevItems = run.items;
    const updatedItems = run.items.map((i) => {
      if (i.id !== currentItem.id) return i;
      return {
        ...i,
        result: {
          id: i.result?.id ?? 'temp',
          runItemId: i.id,
          status: status as ResultDetail['status'],
          notes: notes || null,
          duration: i.result?.duration ?? null,
          recordedBy: i.result?.recordedBy ?? { id: '', email: '', name: '', avatarUrl: null },
          recordedAt: new Date().toISOString(),
          attachments: pendingAttachments,
        },
      };
    });
    setRun({ ...run, items: updatedItems, stats: computeLocalStats(updatedItems) });

    setSavingResult(true);
    try {
      await runApi.recordResult(projectId, runId, currentItem.id, {
        status,
        notes: notes || undefined,
        attachmentIds: pendingAttachments.length > 0 ? pendingAttachments.map((a) => a.id) : undefined,
      });
    } catch (err) {
      setRun({ ...run, items: prevItems });
      const message = err instanceof ApiError ? err.message : 'Failed to record result';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSavingResult(false);
    }
  }, [projectId, runId, run, currentItem, notes, pendingAttachments, savingResult, toast]);

  const handleClearResult = useCallback(async () => {
    if (!projectId || !runId || !run || !currentItem) return;

    const prevItems = run.items;
    const updatedItems = run.items.map((i) =>
      i.id === currentItem.id ? { ...i, result: null } : i
    );
    setRun({ ...run, items: updatedItems, stats: computeLocalStats(updatedItems) });
    setNotes('');
    setPendingAttachments([]);

    try {
      await runApi.clearResult(projectId, runId, currentItem.id);
    } catch (err) {
      setRun({ ...run, items: prevItems });
      const message = err instanceof ApiError ? err.message : 'Failed to clear result';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }, [projectId, runId, run, currentItem, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in textarea
      if (e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (isActive && !savingResult) {
        const idx = ['1', '2', '3', '4', '5'].indexOf(e.key);
        if (idx !== -1) {
          e.preventDefault();
          handleRecordResult(RESULT_STATUSES[idx].value);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrev, goNext, isActive, savingResult, handleRecordResult]);

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

  if (run.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">This run has no test items.</p>
        <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/runs/${runId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Run
        </Button>
      </div>
    );
  }

  const currentStatus = currentItem?.result?.status ?? null;
  const blocks = currentItem?.testVersion.content?.blocks ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}/runs/${runId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Exit
          </Button>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Play className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium truncate">{run.title}</span>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} of {totalItems}
            </span>
            <div className="w-32">
              <RunProgressBar stats={run.stats} />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Test header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-muted-foreground">
                {currentItem?.testVersion.test.code}
              </span>
              {currentStatus && (
                <ResultStatusBadge status={currentStatus} />
              )}
            </div>
            <h2 className="text-xl font-semibold">
              {currentItem?.testVersion.title}
            </h2>
            {currentItem?.assignedTo && (
              <p className="text-sm text-muted-foreground mt-1">
                Assigned to {currentItem.assignedTo.name || currentItem.assignedTo.email}
              </p>
            )}
          </div>

          {/* Test content blocks */}
          {blocks.length > 0 ? (
            <ReadOnlyBlocks blocks={blocks} />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              This test has no content blocks.
            </p>
          )}

          {/* Result recording */}
          <div className="border rounded-lg p-4 bg-card space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Record Result</h3>

            {/* Status buttons */}
            <div className="flex flex-wrap gap-2">
              {RESULT_STATUSES.map((s) => {
                const isSelected = currentStatus === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => isActive && handleRecordResult(s.value)}
                    disabled={!isActive || savingResult}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'ring-2 ring-offset-1 bg-card'
                        : 'hover:bg-muted'
                    } ${!isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={isSelected ? { borderColor: s.color, '--tw-ring-color': s.color } as React.CSSProperties : undefined}
                  >
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.label}
                    <kbd className="hidden sm:inline text-xs text-muted-foreground ml-1 px-1 py-0.5 bg-muted rounded">
                      {s.key}
                    </kbd>
                  </button>
                );
              })}
              {currentStatus && isActive && (
                <button
                  onClick={handleClearResult}
                  disabled={savingResult}
                  className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted border transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Notes */}
            <div>
              <Textarea
                placeholder="Add notes (optional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={!isActive}
                className="resize-none"
              />
              {isActive && notes !== (currentItem?.result?.notes ?? '') && currentStatus && (
                <p className="text-xs text-muted-foreground mt-1">
                  Click a status button to save notes with the result.
                </p>
              )}
            </div>

            {/* Attachments */}
            {isActive ? (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Attachments
                </label>
                <AttachmentUpload
                  projectId={projectId!}
                  attachments={pendingAttachments}
                  onAttachmentsChange={setPendingAttachments}
                />
                {pendingAttachments.length > 0 && !currentStatus && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Click a status button to save attachments with the result.
                  </p>
                )}
              </div>
            ) : (
              currentItem?.result?.attachments && currentItem.result.attachments.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Attachments
                  </label>
                  <AttachmentList attachments={currentItem.result.attachments} />
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Bottom navigation bar */}
      <div className="border-t bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
            <kbd className="hidden sm:inline text-xs text-muted-foreground ml-2 px-1 py-0.5 bg-muted rounded">
              ←
            </kbd>
          </Button>

          {/* Item dots / mini nav */}
          <div className="flex items-center gap-1 overflow-hidden">
            {run.items.map((item, idx) => {
              const status = item.result?.status ?? 'untested';
              const isCurrent = idx === currentIndex;
              const statusColor: Record<string, string> = {
                passed: '#22c55e',
                failed: '#ef4444',
                blocked: '#f59e0b',
                skipped: '#6b7280',
                retest: '#8b5cf6',
                untested: '#d1d5db',
              };
              return (
                <button
                  key={item.id}
                  onClick={() => goTo(idx)}
                  className={`h-2.5 rounded-full transition-all flex-shrink-0 ${
                    isCurrent ? 'w-6' : 'w-2.5'
                  }`}
                  style={{ backgroundColor: statusColor[status] ?? '#d1d5db' }}
                  title={`${item.testVersion.test.code}: ${item.testVersion.title}`}
                />
              );
            })}
          </div>

          <Button
            variant="outline"
            onClick={goNext}
            disabled={currentIndex >= totalItems - 1}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
            <kbd className="hidden sm:inline text-xs text-muted-foreground ml-2 px-1 py-0.5 bg-muted rounded">
              →
            </kbd>
          </Button>
        </div>
      </div>
    </div>
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
