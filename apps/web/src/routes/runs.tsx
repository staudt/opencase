import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FlaskConical, Plus, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runApi, projectApi, type WorkspaceRun, type Project, type Run } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { RunProgressBar } from '@/components/runs/RunProgressBar';
import { RunStatusBadge } from '@/components/runs/ResultStatusBadge';
import { CreateRunDialog } from '@/components/runs/CreateRunDialog';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
] as const;

export function RunsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<WorkspaceRun[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchRuns = useCallback(async (reset = true) => {
    if (!currentWorkspace) return;

    try {
      if (reset) setLoading(true);
      const options: { status?: string; projectId?: string; cursor?: string } = {};
      if (statusFilter) options.status = statusFilter;
      if (projectFilter) options.projectId = projectFilter;
      if (!reset && cursor) options.cursor = cursor;

      const response = await runApi.listForWorkspace(currentWorkspace.id, options);

      if (reset) {
        setRuns(response.data);
      } else {
        setRuns((prev) => [...prev, ...response.data]);
      }
      setCursor(response.pagination.cursor);
      setHasMore(response.pagination.hasMore);
      setError(null);
    } catch (err) {
      setError('Failed to load runs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, statusFilter, projectFilter, cursor]);

  useEffect(() => {
    if (!currentWorkspace) return;
    fetchRuns(true);
  }, [currentWorkspace, statusFilter, projectFilter]);

  useEffect(() => {
    async function fetchProjects() {
      if (!currentWorkspace) return;
      try {
        const response = await projectApi.list(currentWorkspace.id);
        setProjects(response.data);
      } catch (err) {
        console.error('Failed to load projects', err);
      }
    }
    fetchProjects();
  }, [currentWorkspace]);

  const handleCreated = useCallback((run: Run) => {
    setShowCreateDialog(false);
    navigate(`/projects/${run.projectId}/runs/${run.id}`);
  }, [navigate]);

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No workspace selected</p>
      </div>
    );
  }

  if (loading && runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading runs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Test Runs</h2>
          <p className="text-muted-foreground mt-1">
            Execute and track test run progress
          </p>
        </div>
        {projects.length > 0 && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Run
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === filter.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {projects.length > 1 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-background border rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Runs list */}
      {runs.length === 0 ? (
        <div className="bg-card rounded-lg border p-12 text-center">
          <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No runs yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first test run to start tracking execution progress.
          </p>
          {projects.length > 0 && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Run
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <Link
              key={run.id}
              to={`/projects/${run.projectId}/runs/${run.id}`}
              className="block bg-card rounded-lg border p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{run.title}</h3>
                    <RunStatusBadge status={run.status} />
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {run.project.name}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground ml-4 flex-shrink-0">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {run.createdBy.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(run.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <RunProgressBar stats={run.stats} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                  {run.stats.passed > 0 && <span className="text-green-600">{run.stats.passed} passed</span>}
                  {run.stats.failed > 0 && <span className="text-red-600">{run.stats.failed} failed</span>}
                  {run.stats.blocked > 0 && <span className="text-amber-600">{run.stats.blocked} blocked</span>}
                  <span>{run.stats.total} total</span>
                </div>
              </div>
            </Link>
          ))}

          {hasMore && (
            <div className="text-center py-4">
              <Button variant="outline" onClick={() => fetchRuns(false)}>
                Load More
              </Button>
            </div>
          )}
        </div>
      )}

      <CreateRunDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projects={projects}
        onCreated={handleCreated}
      />
    </div>
  );
}
