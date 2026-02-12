import { useState, useEffect, useRef } from 'react';
import { History, Loader2, RotateCcw, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { testApi, type TestVersion } from '@/lib/api';
import { cn } from '@/lib/utils';
import { VersionDiff } from './VersionDiff';

interface VersionHistoryProps {
  projectId: string;
  testId: string;
  currentVersionId: string | null;
  onRestoreVersion: (version: TestVersion) => void;
}

export function VersionHistory({
  projectId,
  testId,
  currentVersionId,
  onRestoreVersion,
}: VersionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<TestVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [compareVersion, setCompareVersion] = useState<number | null>(null);

  // Track previous currentVersionId to detect when a new version is saved
  const prevVersionIdRef = useRef(currentVersionId);

  useEffect(() => {
    if (isOpen && versions.length === 0) {
      loadVersions();
    }
  }, [isOpen]);

  // Refresh versions when currentVersionId changes (new version saved)
  useEffect(() => {
    if (
      isOpen &&
      currentVersionId !== prevVersionIdRef.current &&
      currentVersionId !== null
    ) {
      loadVersions();
    }
    prevVersionIdRef.current = currentVersionId;
  }, [currentVersionId, isOpen]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await testApi.getVersions(projectId, testId);
      setVersions(response.data);
    } catch (err) {
      setError('Failed to load version history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'human':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
      case 'ai':
        return 'bg-purple-500/20 text-purple-700 dark:text-purple-300';
      case 'import':
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
    }
  };

  const handleVersionClick = (version: TestVersion) => {
    const isCurrent = version.id === currentVersionId;
    if (isCurrent) return;

    // Find current version number
    const currentVersion = versions.find((v) => v.id === currentVersionId);
    if (currentVersion) {
      setCompareVersion(version.version);
      setShowDiff(true);
    }
  };

  const handleRestoreFromDiff = (version: TestVersion) => {
    setShowDiff(false);
    setCompareVersion(null);
    onRestoreVersion(version);
  };

  const currentVersionNumber = versions.find((v) => v.id === currentVersionId)?.version;

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <History className="h-4 w-4 mr-2" />
        History
      </Button>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-background border-l shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold">Version History</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </div>

      {/* Diff Dialog */}
      <VersionDiff
        projectId={projectId}
        testId={testId}
        versions={versions}
        isOpen={showDiff}
        onClose={() => {
          setShowDiff(false);
          setCompareVersion(null);
        }}
        initialV1={compareVersion ?? undefined}
        initialV2={currentVersionNumber}
        currentVersionId={currentVersionId}
        onRestoreVersion={handleRestoreFromDiff}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="p-4 text-center">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={loadVersions}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && versions.length === 0 && (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No version history available
          </div>
        )}

        {!loading && !error && versions.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs text-muted-foreground border-b">
              Click a version to compare with current
            </div>
            <div className="divide-y">
              {versions.map((version) => {
                const isCurrent = version.id === currentVersionId;
                return (
                  <div
                    key={version.id}
                    onClick={() => handleVersionClick(version)}
                    className={cn(
                      'p-4 transition-colors',
                      isCurrent
                        ? 'bg-primary/5'
                        : 'hover:bg-muted/50 cursor-pointer'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">v{version.version}</span>
                          {isCurrent && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              Current
                            </span>
                          )}
                          <span
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded capitalize',
                              getSourceBadgeColor(version.source)
                            )}
                          >
                            {version.source}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {version.title}
                        </p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{version.createdBy.name}</span>
                          <span className="mx-1">-</span>
                          <span>{formatDate(version.createdAt)}</span>
                        </div>
                      </div>
                      {!isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestoreVersion(version);
                          }}
                          title="Restore this version"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
