import { useState, useEffect } from 'react';
import { ArrowLeftRight, Loader2, Plus, Minus, Edit2, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { testApi, type TestVersion, type TestDiff, type DiffChange, type ContentBlock } from '@/lib/api';
import { cn } from '@/lib/utils';
import { BlockTypeIcon, getBlockTypeLabel } from './BlockTypeIcon';

interface VersionDiffProps {
  projectId: string;
  testId: string;
  versions: TestVersion[];
  isOpen: boolean;
  onClose: () => void;
  initialV1?: number;
  initialV2?: number;
  currentVersionId?: string | null;
  onRestoreVersion?: (version: TestVersion) => void;
}

export function VersionDiff({
  projectId,
  testId,
  versions,
  isOpen,
  onClose,
  initialV1,
  initialV2,
  currentVersionId,
  onRestoreVersion,
}: VersionDiffProps) {
  const [v1, setV1] = useState<number | null>(null);
  const [v2, setV2] = useState<number | null>(null);
  const [diff, setDiff] = useState<TestDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize versions when dialog opens
  useEffect(() => {
    if (isOpen && versions.length >= 2) {
      // Use initial versions if provided, otherwise default to comparing with newest
      if (initialV1 !== undefined && initialV2 !== undefined) {
        setV1(initialV1);
        setV2(initialV2);
      } else {
        setV1(versions[1].version); // Second newest (older)
        setV2(versions[0].version); // Newest
      }
      setDiff(null);
    }
  }, [isOpen, versions, initialV1, initialV2]);

  // Load diff when versions change
  useEffect(() => {
    if (v1 !== null && v2 !== null && v1 !== v2) {
      loadDiff();
    }
  }, [v1, v2]);

  const loadDiff = async () => {
    if (v1 === null || v2 === null) return;

    try {
      setLoading(true);
      setError(null);
      const response = await testApi.diff(projectId, testId, v1, v2);
      setDiff(response.data);
    } catch (err) {
      setError('Failed to load diff');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (type: DiffChange['type']) => {
    switch (type) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'removed':
        return <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'modified':
        return <Edit2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getChangeLabel = (type: DiffChange['type']) => {
    switch (type) {
      case 'added':
        return 'Added';
      case 'removed':
        return 'Removed';
      case 'modified':
        return 'Modified';
    }
  };

  const getChangeBg = (type: DiffChange['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-500/10 border-green-500/30';
      case 'removed':
        return 'bg-red-500/10 border-red-500/30';
      case 'modified':
        return 'bg-amber-500/10 border-amber-500/30';
    }
  };

  const renderBlockContent = (block: ContentBlock, variant: 'old' | 'new') => (
    <div
      className={cn(
        'rounded p-2 text-sm',
        variant === 'old'
          ? 'bg-red-500/10 border border-red-500/20'
          : 'bg-green-500/10 border border-green-500/20'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <BlockTypeIcon type={block.type} className="h-3 w-3" />
        <span className="text-xs font-medium text-muted-foreground">
          {getBlockTypeLabel(block.type)}
        </span>
      </div>
      <p className="whitespace-pre-wrap">{block.content || '(empty)'}</p>
    </div>
  );

  // Find versions that can be restored (not the current one)
  const v1Version = versions.find((v) => v.version === v1);
  const v2Version = versions.find((v) => v.version === v2);
  const canRestoreV1 = v1Version && v1Version.id !== currentVersionId;
  const canRestoreV2 = v2Version && v2Version.id !== currentVersionId;

  const handleRestore = (version: TestVersion) => {
    if (onRestoreVersion) {
      onRestoreVersion(version);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Compare Versions
          </DialogTitle>
        </DialogHeader>

        {/* Version selectors */}
        <div className="flex items-center gap-4 py-2 border-b">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">From</label>
            <div className="flex gap-2">
              <select
                value={v1 ?? ''}
                onChange={(e) => setV1(parseInt(e.target.value, 10))}
                className="flex-1 rounded border bg-background px-2 py-1 text-sm"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.version} disabled={v.version === v2}>
                    v{v.version} - {v.title.slice(0, 20)}
                    {v.title.length > 20 ? '...' : ''}
                    {v.id === currentVersionId ? ' (current)' : ''}
                  </option>
                ))}
              </select>
              {canRestoreV1 && onRestoreVersion && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(v1Version!)}
                  title={`Restore v${v1}`}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground mt-4" />
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">To</label>
            <div className="flex gap-2">
              <select
                value={v2 ?? ''}
                onChange={(e) => setV2(parseInt(e.target.value, 10))}
                className="flex-1 rounded border bg-background px-2 py-1 text-sm"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.version} disabled={v.version === v1}>
                    v{v.version} - {v.title.slice(0, 20)}
                    {v.title.length > 20 ? '...' : ''}
                    {v.id === currentVersionId ? ' (current)' : ''}
                  </option>
                ))}
              </select>
              {canRestoreV2 && onRestoreVersion && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(v2Version!)}
                  title={`Restore v${v2}`}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={loadDiff}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && diff && (
            <div className="space-y-4 py-4">
              {diff.changes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No differences found between these versions.
                </p>
              ) : (
                diff.changes.map((change, index) => (
                  <div
                    key={index}
                    className={cn('rounded-lg border p-3', getChangeBg(change.type))}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {getChangeIcon(change.type)}
                      <span className="text-sm font-medium">
                        {getChangeLabel(change.type)}
                        {change.field && ` - ${change.field}`}
                      </span>
                    </div>

                    {/* Field changes (title, description) */}
                    {change.field && (
                      <div className="space-y-2">
                        {change.oldValue && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-sm">
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">Old: </span>
                            <span>{String(change.oldValue)}</span>
                          </div>
                        )}
                        {change.newValue && (
                          <div className="bg-green-500/10 border border-green-500/20 rounded p-2 text-sm">
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">New: </span>
                            <span>{String(change.newValue)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Block changes */}
                    {!change.field && (
                      <div className="space-y-2">
                        {change.type === 'removed' && change.oldValue && typeof change.oldValue === 'object' && (
                          renderBlockContent(change.oldValue as ContentBlock, 'old')
                        )}
                        {change.type === 'added' && change.newValue && typeof change.newValue === 'object' && (
                          renderBlockContent(change.newValue as ContentBlock, 'new')
                        )}
                        {change.type === 'modified' && (
                          <>
                            {change.oldValue && typeof change.oldValue === 'object' && (
                              renderBlockContent(change.oldValue as ContentBlock, 'old')
                            )}
                            {change.newValue && typeof change.newValue === 'object' && (
                              renderBlockContent(change.newValue as ContentBlock, 'new')
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t pt-3 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
