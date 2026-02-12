import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, FolderTree, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { projectApi, suiteApi, testApi, type Project, type SuiteNode, type TestSummary } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { SuiteTree } from '@/components/project/SuiteTree';
import { TestList } from '@/components/project/TestList';
import { CreateSuiteDialog } from '@/components/project/CreateSuiteDialog';
import { CreateTestDialog } from '@/components/project/CreateTestDialog';
import { ImportExportMenu } from '@/components/project/ImportExportMenu';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentWorkspace } = useWorkspaceStore();

  const [project, setProject] = useState<Project | null>(null);
  const [suites, setSuites] = useState<SuiteNode[]>([]);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateSuite, setShowCreateSuite] = useState(false);
  const [showCreateTest, setShowCreateTest] = useState(false);

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

  // Fetch suites
  useEffect(() => {
    async function fetchSuites() {
      if (!projectId) return;

      try {
        const response = await suiteApi.getTree(projectId);
        setSuites(response.data);
      } catch (err) {
        console.error('Failed to load suites:', err);
      }
    }

    fetchSuites();
  }, [projectId]);

  // Fetch tests (filtered by suite if selected)
  useEffect(() => {
    async function fetchTests() {
      if (!projectId) return;

      try {
        const response = await testApi.list(projectId, {
          suiteId: selectedSuiteId ?? undefined,
        });
        setTests(response.data);
      } catch (err) {
        console.error('Failed to load tests:', err);
      }
    }

    fetchTests();
  }, [projectId, selectedSuiteId]);

  const handleSuiteCreated = (suite: SuiteNode) => {
    // Add the new suite to the tree
    if (suite.parentId) {
      // Add as child of parent
      setSuites(prev => addChildToTree(prev, suite.parentId!, suite));
    } else {
      // Add as root suite
      setSuites(prev => [...prev, suite]);
    }
    setShowCreateSuite(false);
  };

  const handleTestCreated = (test: TestSummary) => {
    setTests(prev => [test, ...prev]);
    setShowCreateTest(false);
  };

  const refreshSuites = async () => {
    if (!projectId) return;
    try {
      const response = await suiteApi.getTree(projectId);
      setSuites(response.data);
    } catch (err) {
      console.error('Failed to refresh suites:', err);
    }
  };

  const refreshAll = useCallback(async () => {
    if (!projectId) return;
    try {
      const [suitesRes, testsRes] = await Promise.all([
        suiteApi.getTree(projectId),
        testApi.list(projectId, { suiteId: selectedSuiteId ?? undefined }),
      ]);
      setSuites(suitesRes.data);
      setTests(testsRes.data);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  }, [projectId, selectedSuiteId]);

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

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Suite tree sidebar */}
        <div className="w-64 border-r bg-muted/30 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground">Suites</h2>
            </div>
            <SuiteTree
              suites={suites}
              selectedSuiteId={selectedSuiteId}
              onSelectSuite={setSelectedSuiteId}
              onSuiteUpdated={refreshSuites}
              projectId={projectId!}
            />
          </div>
        </div>

        {/* Test list */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <TestList
              tests={tests}
              selectedSuiteId={selectedSuiteId}
              suites={suites}
              onSelectSuite={setSelectedSuiteId}
              projectId={projectId!}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreateSuiteDialog
        open={showCreateSuite}
        onOpenChange={setShowCreateSuite}
        projectId={projectId!}
        parentId={selectedSuiteId}
        onCreated={handleSuiteCreated}
      />
      <CreateTestDialog
        open={showCreateTest}
        onOpenChange={setShowCreateTest}
        projectId={projectId!}
        suiteId={selectedSuiteId}
        onCreated={handleTestCreated}
      />
    </div>
  );
}

// Helper to add a child suite to the tree
function addChildToTree(tree: SuiteNode[], parentId: string, newSuite: SuiteNode): SuiteNode[] {
  return tree.map(node => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...(node.children || []), newSuite],
      };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: addChildToTree(node.children, parentId, newSuite),
      };
    }
    return node;
  });
}
