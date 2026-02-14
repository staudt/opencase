import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  runApi,
  suiteApi,
  tagApi,
  testApi,
  type Run,
  type Project,
  type SuiteNode,
  type Tag,
  type TestSummary,
  type TestSelectionInput,
  ApiError,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft } from 'lucide-react';
import { UserPicker } from '@/components/runs/UserPicker';

interface CreateRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projects: Project[];
  onCreated: (run: Run) => void;
}

type SelectionMode = 'all' | 'suite' | 'tag' | 'manual';

export function CreateRunDialog({
  open,
  onOpenChange,
  projectId: initialProjectId,
  projects,
  onCreated,
}: CreateRunDialogProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ?? '');
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('all');
  const [selectedSuiteIds, setSelectedSuiteIds] = useState<Set<string>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Data for step 2
  const [suites, setSuites] = useState<SuiteNode[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep(1);
      setTitle('');
      setDescription('');
      setSelectedProjectId(initialProjectId ?? (projects.length === 1 ? projects[0].id : ''));
      setSelectionMode('all');
      setSelectedSuiteIds(new Set());
      setSelectedTagIds(new Set());
      setSelectedTestIds(new Set());
      setAssignedToId(null);
    }
  }, [open, initialProjectId, projects]);

  // Fetch data when moving to step 2
  useEffect(() => {
    if (step !== 2 || !selectedProjectId) return;

    async function fetchData() {
      setLoadingData(true);
      try {
        const [suitesRes, tagsRes, testsRes] = await Promise.all([
          suiteApi.getTree(selectedProjectId),
          tagApi.list(selectedProjectId),
          testApi.list(selectedProjectId, { limit: 100 }),
        ]);
        setSuites(suitesRes.data);
        setTags(tagsRes.data);
        setTests(testsRes.data);
      } catch (err) {
        console.error('Failed to load project data', err);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, [step, selectedProjectId]);

  const handleNext = () => {
    if (!title.trim()) {
      toast({ title: 'Error', description: 'Run title is required', variant: 'destructive' });
      return;
    }
    if (!selectedProjectId) {
      toast({ title: 'Error', description: 'Please select a project', variant: 'destructive' });
      return;
    }
    setStep(2);
  };

  const getSelectionCount = (): string => {
    switch (selectionMode) {
      case 'all':
        return `${tests.length} tests`;
      case 'suite':
        return `${selectedSuiteIds.size} suite${selectedSuiteIds.size !== 1 ? 's' : ''} selected`;
      case 'tag':
        return `${selectedTagIds.size} tag${selectedTagIds.size !== 1 ? 's' : ''} selected`;
      case 'manual':
        return `${selectedTestIds.size} test${selectedTestIds.size !== 1 ? 's' : ''} selected`;
    }
  };

  const canCreate = (): boolean => {
    switch (selectionMode) {
      case 'all':
        return tests.length > 0;
      case 'suite':
        return selectedSuiteIds.size > 0;
      case 'tag':
        return selectedTagIds.size > 0;
      case 'manual':
        return selectedTestIds.size > 0;
    }
  };

  const handleCreate = async () => {
    const selection: TestSelectionInput = { mode: selectionMode };
    if (selectionMode === 'suite') selection.suiteIds = Array.from(selectedSuiteIds);
    if (selectionMode === 'tag') selection.tagIds = Array.from(selectedTagIds);
    if (selectionMode === 'manual') selection.testIds = Array.from(selectedTestIds);

    setIsLoading(true);
    try {
      const response = await runApi.create(selectedProjectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        selection,
        assignedToId: assignedToId || undefined,
      });
      toast({ title: 'Success', description: 'Run created successfully' });
      onCreated(response.data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create run';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSuite = (id: string) => {
    setSelectedSuiteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTest = (id: string) => {
    setSelectedTestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllTests = () => {
    if (selectedTestIds.size === tests.length) {
      setSelectedTestIds(new Set());
    } else {
      setSelectedTestIds(new Set(tests.map((t) => t.id)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Create Run' : 'Select Tests'}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Configure the new test run.'
              : 'Choose which tests to include in this run.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-2">
            {!initialProjectId && projects.length > 1 && (
              <div className="space-y-2">
                <Label>Project</Label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-background border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="run-title">Title</Label>
              <Input
                id="run-title"
                placeholder="e.g., Sprint 42 Regression"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-desc">Description (optional)</Label>
              <Textarea
                id="run-desc"
                placeholder="Notes about this run..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Assignee (optional)</Label>
              <div>
                <UserPicker
                  value={assignedToId}
                  onChange={setAssignedToId}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Selection mode tabs */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 mb-3">
              {(['all', 'suite', 'tag', 'manual'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSelectionMode(mode)}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectionMode === mode
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode === 'all' ? 'All Tests' : mode === 'suite' ? 'By Suite' : mode === 'tag' ? 'By Tag' : 'Manual'}
                </button>
              ))}
            </div>

            {/* Selection content */}
            <div className="flex-1 overflow-y-auto min-h-0 border rounded-md">
              {loadingData ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
              ) : selectionMode === 'all' ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    All <strong>{tests.length}</strong> tests in this project will be included.
                  </p>
                </div>
              ) : selectionMode === 'suite' ? (
                <div className="p-2 space-y-1">
                  {suites.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No suites in this project</p>
                  ) : (
                    suites.map((suite) => (
                      <SuiteCheckboxItem
                        key={suite.id}
                        suite={suite}
                        selected={selectedSuiteIds}
                        onToggle={toggleSuite}
                        depth={0}
                      />
                    ))
                  )}
                </div>
              ) : selectionMode === 'tag' ? (
                <div className="p-2 space-y-1">
                  {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No tags in this project</p>
                  ) : (
                    tags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTagIds.has(tag.id)}
                          onChange={() => toggleTag(tag.id)}
                          className="rounded"
                        />
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm">{tag.name}</span>
                        {tag.testCount !== undefined && (
                          <span className="text-xs text-muted-foreground ml-auto">{tag.testCount} tests</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              ) : (
                <div className="p-2">
                  {tests.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No tests in this project</p>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer border-b mb-1 pb-2">
                        <input
                          type="checkbox"
                          checked={selectedTestIds.size === tests.length && tests.length > 0}
                          onChange={toggleAllTests}
                          className="rounded"
                        />
                        <span className="text-sm font-medium">Select All</span>
                        <span className="text-xs text-muted-foreground ml-auto">{tests.length} tests</span>
                      </label>
                      <div className="space-y-0.5">
                        {tests.map((test) => (
                          <label
                            key={test.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTestIds.has(test.id)}
                              onChange={() => toggleTest(test.id)}
                              className="rounded"
                            />
                            <span className="text-xs text-muted-foreground font-mono">{test.code}</span>
                            <span className="text-sm truncate">{test.title}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="text-sm text-muted-foreground mt-2">
              {getSelectionCount()}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              disabled={isLoading}
              className="mr-auto"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          {step === 1 ? (
            <Button onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={isLoading || !canCreate()}>
              {isLoading ? 'Creating...' : 'Create Run'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Recursive suite checkbox component
function SuiteCheckboxItem({
  suite,
  selected,
  onToggle,
  depth,
}: {
  suite: SuiteNode;
  selected: Set<string>;
  onToggle: (id: string) => void;
  depth: number;
}) {
  return (
    <>
      <label
        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <input
          type="checkbox"
          checked={selected.has(suite.id)}
          onChange={() => onToggle(suite.id)}
          className="rounded"
        />
        <span className="text-sm">{suite.name}</span>
        {suite.itemCount !== undefined && (
          <span className="text-xs text-muted-foreground ml-auto">{suite.itemCount} tests</span>
        )}
      </label>
      {suite.children?.map((child) => (
        <SuiteCheckboxItem
          key={child.id}
          suite={child}
          selected={selected}
          onToggle={onToggle}
          depth={depth + 1}
        />
      ))}
    </>
  );
}
