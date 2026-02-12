import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { testApi, tagApi, type Test, type ContentBlock, type TestVersion, type Tag } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { TestEditor, VersionHistory, TagSelector } from '@/components/test-editor';

export function TestDetailPage() {
  const { projectId, testId } = useParams<{ projectId: string; testId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);

  // Track original values to detect changes
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [originalBlocks, setOriginalBlocks] = useState<ContentBlock[]>([]);

  // Check if there are unsaved changes
  const isDirty = useMemo(() => {
    if (title !== originalTitle) return true;
    if (description !== originalDescription) return true;
    if (JSON.stringify(blocks) !== JSON.stringify(originalBlocks)) return true;
    return false;
  }, [title, description, blocks, originalTitle, originalDescription, originalBlocks]);

  // Fetch test
  useEffect(() => {
    async function fetchTest() {
      if (!projectId || !testId) return;

      try {
        setLoading(true);
        const response = await testApi.get(projectId, testId);
        setTest(response.data);

        // Initialize editable state
        const testTitle = response.data.currentVersion?.title ?? '';
        const testDescription = response.data.currentVersion?.content?.description ?? '';
        const testBlocks = response.data.currentVersion?.content?.blocks ?? [];
        setTitle(testTitle);
        setDescription(testDescription);
        setBlocks(testBlocks);
        setTags(response.data.tags ?? []);
        setOriginalTitle(testTitle);
        setOriginalDescription(testDescription);
        setOriginalBlocks(testBlocks);

        setError(null);
      } catch (err) {
        setError('Failed to load test');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchTest();
  }, [projectId, testId]);

  // Warn about unsaved changes on navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSave = useCallback(async () => {
    if (!projectId || !testId || !isDirty) return;

    try {
      setIsSaving(true);
      const response = await testApi.update(projectId, testId, {
        title,
        content: { description, blocks },
        source: 'human',
      });

      if (response.noChange) {
        toast({
          title: 'No changes',
          description: 'Content is identical to the current version.',
        });
      } else {
        toast({
          title: 'Saved',
          description: `Version ${response.data.currentVersion?.version} created.`,
        });

        // Update original values
        setOriginalTitle(title);
        setOriginalDescription(description);
        setOriginalBlocks(blocks);
        setTest(response.data);
      }
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [projectId, testId, isDirty, title, description, blocks, toast]);

  // Keyboard shortcut for save (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !isSaving) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, isSaving, handleSave]);

  const handleRestoreVersion = (version: TestVersion) => {
    setTitle(version.title);
    setDescription(version.content?.description ?? '');
    setBlocks(version.content?.blocks ?? []);
    toast({
      title: 'Version restored',
      description: `Loaded content from version ${version.version}. Save to create a new version.`,
    });
  };

  const handleTagsChange = async (newTags: Tag[]) => {
    if (!projectId || !testId) return;

    // Optimistically update UI
    setTags(newTags);

    try {
      await tagApi.setTestTags(projectId, testId, newTags.map((t) => t.id));
    } catch (err) {
      // Revert on error
      setTags(test?.tags ?? []);
      toast({
        title: 'Failed to update tags',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!projectId || !testId) return;

    try {
      setIsDeleting(true);
      await testApi.delete(projectId, testId);
      toast({
        title: 'Test deleted',
        description: `${test?.code} has been deleted.`,
      });
      navigate(`/projects/${projectId}`);
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{error || 'Test not found'}</p>
        <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
          Back to Project
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            to={`/projects/${projectId}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                {test.code}
              </span>
              <h1 className="text-xl font-semibold truncate">{title || 'Untitled Test'}</h1>
              {isDirty && (
                <span className="text-xs text-muted-foreground">(unsaved changes)</span>
              )}
            </div>
            {test.currentVersion && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Version {test.currentVersion.version} by {test.currentVersion.createdBy.name}
              </p>
            )}
            <div className="mt-2">
              <TagSelector
                projectId={projectId!}
                selectedTags={tags}
                onChange={handleTagsChange}
                disabled={isSaving}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <VersionHistory
              projectId={projectId!}
              testId={testId!}
              currentVersionId={test.currentVersion?.id ?? null}
              onRestoreVersion={handleRestoreVersion}
            />
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete test?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete <strong>{test.code}</strong> and all its version history.
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          <TestEditor
            title={title}
            description={description}
            blocks={blocks}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onBlocksChange={setBlocks}
            disabled={isSaving}
          />
        </div>
      </div>
    </div>
  );
}
