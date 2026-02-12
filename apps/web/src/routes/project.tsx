import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, FolderTree, Plus, GripVertical, Folder, FileText } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import {
  projectApi,
  suiteApi,
  testApi,
  type Project,
  type SuiteNode,
  type TestSummary,
  type GroupedTestsResponse,
  ApiError,
} from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { SuiteTree, handleSuiteDragEnd, type DropPosition } from '@/components/project/SuiteTree';
import { TestTreeView } from '@/components/project/TestTreeView';
import { CreateSuiteDialog } from '@/components/project/CreateSuiteDialog';
import { CreateTestDialog } from '@/components/project/CreateTestDialog';
import { ImportExportMenu } from '@/components/project/ImportExportMenu';
import { useToast } from '@/hooks/use-toast';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentWorkspace } = useWorkspaceStore();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [suites, setSuites] = useState<SuiteNode[]>([]);
  const [groupedTests, setGroupedTests] = useState<GroupedTestsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateSuite, setShowCreateSuite] = useState(false);
  const [showCreateTest, setShowCreateTest] = useState(false);

  // Sidebar navigation state
  const [highlightedSuiteId, setHighlightedSuiteId] = useState<string | null>(null);
  const [scrollToSuiteId, setScrollToSuiteId] = useState<string | null>(null);

  // Shared DndContext state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<unknown>(null);
  const [sidebarDropPosition, setSidebarDropPosition] = useState<DropPosition>(null);
  const [pointerY, setPointerY] = useState<number>(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch project details
  useEffect(() => {
    async function fetchProject() {
      if (!currentWorkspace || !projectId) return;

      try {
        setLoading(true);
        const response = await projectApi.get(currentWorkspace.id, projectId);
        setProject(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to load project');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [currentWorkspace, projectId]);

  // Fetch suites and grouped tests
  useEffect(() => {
    async function fetchData() {
      if (!projectId) return;

      try {
        const [suitesRes, groupedRes] = await Promise.all([
          suiteApi.getTree(projectId),
          testApi.getGrouped(projectId),
        ]);
        setSuites(suitesRes.data);
        setGroupedTests(groupedRes.data);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }

    fetchData();
  }, [projectId]);

  const refreshAll = useCallback(async () => {
    if (!projectId) return;
    try {
      const [suitesRes, groupedRes] = await Promise.all([
        suiteApi.getTree(projectId),
        testApi.getGrouped(projectId),
      ]);
      setSuites(suitesRes.data);
      setGroupedTests(groupedRes.data);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  }, [projectId]);

  const handleSuiteCreated = (_suite: SuiteNode) => {
    setShowCreateSuite(false);
    refreshAll();
  };

  const handleTestCreated = (_test: TestSummary) => {
    setShowCreateTest(false);
    refreshAll();
  };

  // Sidebar suite click: highlight + scroll to that section
  const handleSelectSuite = (suiteId: string | null) => {
    setHighlightedSuiteId(suiteId);
    if (suiteId) {
      setScrollToSuiteId(suiteId);
    }
  };

  const handleScrollComplete = useCallback(() => {
    setScrollToSuiteId(null);
  }, []);

  // ============ DndContext handlers ============

  const handleDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type as string;
    setActiveDragType(type);
    setActiveDragId(event.active.id as string);
    setActiveDragData(event.active.data.current);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (event.activatorEvent instanceof PointerEvent) {
      setPointerY(event.activatorEvent.clientY + (event.delta?.y || 0));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const type = active.data.current?.type as string;
    const currentDropPosition = sidebarDropPosition;

    // Reset drag state
    setActiveDragId(null);
    setActiveDragType(null);
    setActiveDragData(null);
    setSidebarDropPosition(null);

    if (!over) return;

    if (type === 'suite') {
      // Suite reorder in sidebar
      const suiteId = (active.id as string).replace('suite-', '');
      try {
        const result = await handleSuiteDragEnd(
          suiteId,
          currentDropPosition,
          suites,
          projectId!,
          refreshAll,
          () => {}, // expandSuite handled inside SuiteTree's own state
        );
        if (result.error) {
          toast({
            title: 'Cannot move',
            description: result.error,
            variant: 'destructive',
          });
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to move suite';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      }
    } else if (type === 'test') {
      // Test move to suite
      const testId = (active.id as string).replace('test-', '');
      const overData = over.data.current;

      // Determine target suite ID
      let targetSuiteId: string | null = null;
      const overId = over.id as string;

      if (overData?.type === 'suite-drop-zone' || overData?.type === 'sidebar-suite') {
        targetSuiteId = overData.suiteId ?? null;
      } else if (overId.startsWith('main-')) {
        const id = overId.replace('main-', '');
        targetSuiteId = id === 'unassigned' ? null : id;
      } else if (overId.startsWith('sidebar-')) {
        targetSuiteId = overId.replace('sidebar-', '');
      }

      try {
        await testApi.moveToSuite(projectId!, testId, { targetSuiteId });
        refreshAll();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to move test';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      }
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setActiveDragType(null);
    setActiveDragData(null);
    setSidebarDropPosition(null);
  };

  // ============ Render ============

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No workspace selected</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error || 'Project not found'}</p>
      </div>
    );
  }

  // Build drag overlay content
  const dragOverlay = (() => {
    if (!activeDragData) return null;
    const data = activeDragData as Record<string, unknown>;

    if (activeDragType === 'suite') {
      const suite = data.suite as SuiteNode;
      return (
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm bg-background border-2 border-primary shadow-lg">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <Folder className="h-4 w-4 flex-shrink-0 text-primary" />
          <span className="truncate font-medium">{suite.name}</span>
        </div>
      );
    }

    if (activeDragType === 'test') {
      const test = data.test as TestSummary;
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-background border-2 border-primary shadow-lg max-w-md">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
            {test.code}
          </span>
          <span className="truncate font-medium">{test.title}</span>
        </div>
      );
    }

    return null;
  })();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            to="/projects"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreateSuite(true)}>
              <FolderTree className="h-4 w-4 mr-2" />
              New Suite
            </Button>
            <Button size="sm" onClick={() => setShowCreateTest(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Test
            </Button>
            <ImportExportMenu
              projectId={projectId!}
              projectSlug={project.slug}
              onImportComplete={refreshAll}
            />
          </div>
        </div>
      </div>

      {/* Main content with shared DndContext */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 flex overflow-hidden">
          {/* Suite tree sidebar */}
          <div className="w-64 border-r bg-muted/30 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-muted-foreground">Suites</h2>
              </div>
              <SuiteTree
                suites={suites}
                highlightedSuiteId={highlightedSuiteId}
                onSelectSuite={handleSelectSuite}
                onSuiteUpdated={refreshAll}
                projectId={projectId!}
                activeId={activeDragType === 'suite' ? activeDragId : null}
                dropPosition={sidebarDropPosition}
                pointerY={pointerY}
                onDropPositionChange={setSidebarDropPosition}
              />
            </div>
          </div>

          {/* Test tree view */}
          <div className="flex-1 overflow-hidden">
            {groupedTests ? (
              <TestTreeView
                projectId={projectId!}
                suites={suites}
                groupedTests={groupedTests}
                scrollToSuiteId={scrollToSuiteId}
                onScrollComplete={handleScrollComplete}
                activeDragType={activeDragType}
              />
            ) : (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading tests...</p>
              </div>
            )}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragOverlay}
        </DragOverlay>
      </DndContext>

      {/* Dialogs */}
      <CreateSuiteDialog
        open={showCreateSuite}
        onOpenChange={setShowCreateSuite}
        projectId={projectId!}
        parentId={highlightedSuiteId}
        onCreated={handleSuiteCreated}
      />
      <CreateTestDialog
        open={showCreateTest}
        onOpenChange={setShowCreateTest}
        projectId={projectId!}
        suiteId={highlightedSuiteId}
        onCreated={handleTestCreated}
      />
    </div>
  );
}
