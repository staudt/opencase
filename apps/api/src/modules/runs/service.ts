import type { PrismaClient } from '@opencase/db';
import { z } from 'zod';
import type { RunStats, TestContent } from '@opencase/shared';

// ============ Schemas ============

export const createRunSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  selection: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('all') }),
    z.object({ mode: z.literal('suite'), suiteIds: z.array(z.string()).min(1) }),
    z.object({ mode: z.literal('tag'), tagIds: z.array(z.string()).min(1) }),
    z.object({ mode: z.literal('manual'), testIds: z.array(z.string()).min(1) }),
  ]),
});

export const updateRunSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

export const listRunsSchema = z.object({
  status: z.enum(['active', 'completed', 'archived']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const listWorkspaceRunsSchema = z.object({
  status: z.enum(['active', 'completed', 'archived']).optional(),
  projectId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const recordResultSchema = z.object({
  status: z.enum(['passed', 'failed', 'blocked', 'skipped', 'retest']),
  notes: z.string().max(5000).nullable().optional(),
  duration: z.number().int().min(0).nullable().optional(),
});

export type CreateRunInput = z.infer<typeof createRunSchema>;
export type UpdateRunInput = z.infer<typeof updateRunSchema>;
export type ListRunsOptions = z.infer<typeof listRunsSchema>;
export type ListWorkspaceRunsOptions = z.infer<typeof listWorkspaceRunsSchema>;
export type RecordResultInput = z.infer<typeof recordResultSchema>;

// ============ Types ============

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface RunResponse {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  createdBy: AuthUser;
  createdAt: string;
  completedAt: string | null;
  stats: RunStats;
}

interface WorkspaceRunResponse extends RunResponse {
  project: { id: string; name: string; slug: string };
}

interface RunItemResponse {
  id: string;
  runId: string;
  testVersionId: string;
  orderIndex: number;
  testVersion: {
    id: string;
    testId: string;
    version: number;
    title: string;
    content: TestContent;
    contentHash: string;
    source: string;
    createdBy: AuthUser;
    createdAt: string;
    test: { id: string; code: string };
  };
  result: ResultResponse | null;
  createdAt: string;
}

interface ResultResponse {
  id: string;
  runItemId: string;
  status: string;
  notes: string | null;
  duration: number | null;
  recordedBy: AuthUser;
  recordedAt: string;
}

interface RunDetailResponse extends RunResponse {
  items: RunItemResponse[];
}

// ============ Service ============

export const runService = {
  /**
   * List runs for a project with stats
   */
  async listRuns(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    options: ListRunsOptions
  ): Promise<{ data: RunResponse[]; pagination: { cursor: string | null; hasMore: boolean } } | null> {
    // Verify access to project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: {
            members: { where: { userId } },
          },
        },
      },
    });

    if (!project || project.workspace.members.length === 0) {
      return null;
    }

    const { status, cursor, limit } = options;

    const where: Record<string, unknown> = { projectId };
    if (status) {
      where.status = status;
    }
    if (cursor) {
      where.id = { lt: cursor };
    }

    const runs = await prisma.run.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    const hasMore = runs.length > limit;
    const items = hasMore ? runs.slice(0, limit) : runs;

    // Batch compute stats for all runs
    const runIds = items.map((r) => r.id);
    const statsMap = await computeStatsForRuns(prisma, runIds);

    const data: RunResponse[] = items.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      description: r.description,
      status: r.status,
      createdBy: r.createdBy as AuthUser,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      stats: statsMap.get(r.id) ?? emptyStats(),
    }));

    return {
      data,
      pagination: {
        cursor: hasMore ? items[items.length - 1].id : null,
        hasMore,
      },
    };
  },

  /**
   * List runs across a workspace (for the /runs page)
   */
  async listWorkspaceRuns(
    prisma: PrismaClient,
    workspaceId: string,
    userId: string,
    options: ListWorkspaceRunsOptions
  ): Promise<{ data: WorkspaceRunResponse[]; pagination: { cursor: string | null; hasMore: boolean } } | null> {
    // Verify workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!membership) {
      return null;
    }

    // Get all project IDs in workspace
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      select: { id: true, name: true, slug: true },
    });
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const projectIds = projects.map((p) => p.id);

    const { status, projectId: filterProjectId, cursor, limit } = options;

    const where: Record<string, unknown> = {
      projectId: { in: filterProjectId ? [filterProjectId] : projectIds },
    };
    if (status) {
      where.status = status;
    }
    if (cursor) {
      where.id = { lt: cursor };
    }

    const runs = await prisma.run.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    const hasMore = runs.length > limit;
    const items = hasMore ? runs.slice(0, limit) : runs;

    // Batch compute stats
    const runIds = items.map((r) => r.id);
    const statsMap = await computeStatsForRuns(prisma, runIds);

    const data: WorkspaceRunResponse[] = items.map((r) => {
      const proj = projectMap.get(r.projectId)!;
      return {
        id: r.id,
        projectId: r.projectId,
        title: r.title,
        description: r.description,
        status: r.status,
        createdBy: r.createdBy as AuthUser,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        stats: statsMap.get(r.id) ?? emptyStats(),
        project: { id: proj.id, name: proj.name, slug: proj.slug },
      };
    });

    return {
      data,
      pagination: {
        cursor: hasMore ? items[items.length - 1].id : null,
        hasMore,
      },
    };
  },

  /**
   * Get a single run with items and stats
   */
  async getRun(
    prisma: PrismaClient,
    projectId: string,
    runId: string,
    userId: string
  ): Promise<RunDetailResponse | null> {
    const run = await prisma.run.findFirst({
      where: { id: runId, projectId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: { where: { userId } },
              },
            },
          },
        },
        createdBy: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
        items: {
          orderBy: { orderIndex: 'asc' },
          include: {
            testVersion: {
              include: {
                test: { select: { id: true, code: true } },
                createdBy: {
                  select: { id: true, email: true, name: true, avatarUrl: true },
                },
              },
            },
            result: {
              include: {
                recordedBy: {
                  select: { id: true, email: true, name: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
    });

    if (!run || run.project.workspace.members.length === 0) {
      return null;
    }

    const stats = computeStatsFromItems(run.items);

    return {
      id: run.id,
      projectId: run.projectId,
      title: run.title,
      description: run.description,
      status: run.status,
      createdBy: run.createdBy as AuthUser,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      stats,
      items: run.items.map((item) => ({
        id: item.id,
        runId: item.runId,
        testVersionId: item.testVersionId,
        orderIndex: item.orderIndex,
        testVersion: {
          id: item.testVersion.id,
          testId: item.testVersion.testId,
          version: item.testVersion.version,
          title: item.testVersion.title,
          content: item.testVersion.content as unknown as TestContent,
          contentHash: item.testVersion.contentHash,
          source: item.testVersion.source,
          createdBy: item.testVersion.createdBy as AuthUser,
          createdAt: item.testVersion.createdAt.toISOString(),
          test: item.testVersion.test,
        },
        result: item.result
          ? {
              id: item.result.id,
              runItemId: item.result.runItemId,
              status: item.result.status,
              notes: item.result.notes,
              duration: item.result.duration,
              recordedBy: item.result.recordedBy as AuthUser,
              recordedAt: item.result.recordedAt.toISOString(),
            }
          : null,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  },

  /**
   * Create a new run with test selection
   */
  async createRun(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    input: CreateRunInput
  ): Promise<{ data: RunResponse } | { error: string; message: string }> {
    // Verify access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: {
            members: { where: { userId } },
          },
        },
      },
    });

    if (!project || project.workspace.members.length === 0) {
      return { error: 'NOT_FOUND', message: 'Project not found' };
    }

    // Resolve test selection to test IDs
    let testIds: string[] = [];

    if (input.selection.mode === 'all') {
      const tests = await prisma.test.findMany({
        where: { projectId, currentVersionId: { not: null } },
        select: { id: true },
      });
      testIds = tests.map((t) => t.id);
    } else if (input.selection.mode === 'suite') {
      // Get all descendant suite IDs (recursive)
      const allSuiteIds = await getAllDescendantSuiteIds(prisma, input.selection.suiteIds, projectId);

      const suiteItems = await prisma.suiteItem.findMany({
        where: { suiteNodeId: { in: allSuiteIds } },
        select: { testId: true },
      });
      testIds = [...new Set(suiteItems.map((si) => si.testId))];
    } else if (input.selection.mode === 'tag') {
      const testTags = await prisma.testTag.findMany({
        where: {
          tagId: { in: input.selection.tagIds },
          test: { projectId },
        },
        select: { testId: true },
      });
      testIds = [...new Set(testTags.map((tt) => tt.testId))];
    } else if (input.selection.mode === 'manual') {
      // Verify tests exist in project
      const tests = await prisma.test.findMany({
        where: { id: { in: input.selection.testIds }, projectId },
        select: { id: true },
      });
      testIds = tests.map((t) => t.id);
      if (testIds.length !== input.selection.testIds.length) {
        return { error: 'NOT_FOUND', message: 'One or more tests not found in this project' };
      }
    }

    if (testIds.length === 0) {
      return { error: 'BAD_REQUEST', message: 'No tests match the selection criteria' };
    }

    // Fetch current version IDs for each test
    const tests = await prisma.test.findMany({
      where: { id: { in: testIds }, currentVersionId: { not: null } },
      select: { id: true, currentVersionId: true, code: true },
      orderBy: { code: 'asc' },
    });

    if (tests.length === 0) {
      return { error: 'BAD_REQUEST', message: 'No tests with published versions found' };
    }

    // Create run + items in transaction
    const run = await prisma.$transaction(async (tx) => {
      const newRun = await tx.run.create({
        data: {
          projectId,
          title: input.title,
          description: input.description,
          createdById: userId,
        },
        include: {
          createdBy: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });

      // Create run items
      await tx.runItem.createMany({
        data: tests.map((test, index) => ({
          runId: newRun.id,
          testVersionId: test.currentVersionId!,
          orderIndex: index,
        })),
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          projectId,
          userId,
          action: 'run.created',
          entityType: 'run',
          entityId: newRun.id,
          metadata: {
            title: input.title,
            testCount: tests.length,
            selectionMode: input.selection.mode,
          },
        },
      });

      return newRun;
    });

    return {
      data: {
        id: run.id,
        projectId: run.projectId,
        title: run.title,
        description: run.description,
        status: run.status,
        createdBy: run.createdBy as AuthUser,
        createdAt: run.createdAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        stats: {
          total: tests.length,
          passed: 0,
          failed: 0,
          blocked: 0,
          skipped: 0,
          retest: 0,
          untested: tests.length,
        },
      },
    };
  },

  /**
   * Update run metadata or status
   */
  async updateRun(
    prisma: PrismaClient,
    projectId: string,
    runId: string,
    userId: string,
    input: UpdateRunInput
  ): Promise<{ data: RunResponse } | { error: string; message: string }> {
    // Verify access and existence
    const existing = await prisma.run.findFirst({
      where: { id: runId, projectId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: { where: { userId } },
              },
            },
          },
        },
      },
    });

    if (!existing || existing.project.workspace.members.length === 0) {
      return { error: 'NOT_FOUND', message: 'Run not found' };
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'completed' && !existing.completedAt) {
        updateData.completedAt = new Date();
      }
    }

    const run = await prisma.run.update({
      where: { id: runId },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    // Audit log for status changes
    if (input.status && input.status !== existing.status) {
      await prisma.auditLog.create({
        data: {
          projectId,
          userId,
          action: input.status === 'completed' ? 'run.completed' : 'run.created',
          entityType: 'run',
          entityId: runId,
          metadata: {
            oldStatus: existing.status,
            newStatus: input.status,
          },
        },
      });
    }

    const stats = await computeStatsForRun(prisma, runId);

    return {
      data: {
        id: run.id,
        projectId: run.projectId,
        title: run.title,
        description: run.description,
        status: run.status,
        createdBy: run.createdBy as AuthUser,
        createdAt: run.createdAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        stats,
      },
    };
  },

  /**
   * Delete a run
   */
  async deleteRun(
    prisma: PrismaClient,
    projectId: string,
    runId: string,
    userId: string
  ): Promise<{ data: { success: boolean } } | { error: string; message: string }> {
    const existing = await prisma.run.findFirst({
      where: { id: runId, projectId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: { where: { userId } },
              },
            },
          },
        },
      },
    });

    if (!existing || existing.project.workspace.members.length === 0) {
      return { error: 'NOT_FOUND', message: 'Run not found' };
    }

    await prisma.run.delete({
      where: { id: runId },
    });

    return { data: { success: true } };
  },

  /**
   * Record a result on a run item (upsert)
   */
  async recordResult(
    prisma: PrismaClient,
    projectId: string,
    runId: string,
    runItemId: string,
    userId: string,
    input: RecordResultInput
  ): Promise<{ data: ResultResponse } | { error: string; message: string }> {
    // Verify access and that the run item belongs to the run
    const runItem = await prisma.runItem.findFirst({
      where: { id: runItemId, runId },
      include: {
        run: {
          include: {
            project: {
              include: {
                workspace: {
                  include: {
                    members: { where: { userId } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!runItem || runItem.run.projectId !== projectId || runItem.run.project.workspace.members.length === 0) {
      return { error: 'NOT_FOUND', message: 'Run item not found' };
    }

    if (runItem.run.status !== 'active') {
      return { error: 'BAD_REQUEST', message: 'Cannot record results on a non-active run' };
    }

    // Upsert result
    const result = await prisma.result.upsert({
      where: { runItemId },
      create: {
        runItemId,
        status: input.status,
        notes: input.notes ?? null,
        duration: input.duration ?? null,
        recordedById: userId,
      },
      update: {
        status: input.status,
        notes: input.notes ?? null,
        duration: input.duration ?? null,
        recordedById: userId,
        recordedAt: new Date(),
      },
      include: {
        recordedBy: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        projectId,
        userId,
        action: 'result.created',
        entityType: 'result',
        entityId: result.id,
        metadata: {
          runId,
          runItemId,
          status: input.status,
        },
      },
    });

    return {
      data: {
        id: result.id,
        runItemId: result.runItemId,
        status: result.status,
        notes: result.notes,
        duration: result.duration,
        recordedBy: result.recordedBy as AuthUser,
        recordedAt: result.recordedAt.toISOString(),
      },
    };
  },

  /**
   * Clear a result on a run item (reset to untested)
   */
  async clearResult(
    prisma: PrismaClient,
    projectId: string,
    runId: string,
    runItemId: string,
    userId: string
  ): Promise<{ data: { success: boolean } } | { error: string; message: string }> {
    const runItem = await prisma.runItem.findFirst({
      where: { id: runItemId, runId },
      include: {
        run: {
          include: {
            project: {
              include: {
                workspace: {
                  include: {
                    members: { where: { userId } },
                  },
                },
              },
            },
          },
        },
        result: true,
      },
    });

    if (!runItem || runItem.run.projectId !== projectId || runItem.run.project.workspace.members.length === 0) {
      return { error: 'NOT_FOUND', message: 'Run item not found' };
    }

    if (runItem.run.status !== 'active') {
      return { error: 'BAD_REQUEST', message: 'Cannot modify results on a non-active run' };
    }

    if (!runItem.result) {
      return { error: 'NOT_FOUND', message: 'No result to clear' };
    }

    await prisma.result.delete({
      where: { runItemId },
    });

    return { data: { success: true } };
  },
};

// ============ Helper Functions ============

function emptyStats(): RunStats {
  return { total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, retest: 0, untested: 0 };
}

/**
 * Compute stats for a single run
 */
async function computeStatsForRun(prisma: PrismaClient, runId: string): Promise<RunStats> {
  const total = await prisma.runItem.count({ where: { runId } });
  const results = await prisma.result.groupBy({
    by: ['status'],
    where: { runItem: { runId } },
    _count: true,
  });

  const stats = emptyStats();
  stats.total = total;

  let recorded = 0;
  for (const r of results) {
    const key = r.status as keyof RunStats;
    if (key in stats && key !== 'total' && key !== 'untested') {
      stats[key] = r._count;
      recorded += r._count;
    }
  }
  stats.untested = total - recorded;

  return stats;
}

/**
 * Batch compute stats for multiple runs
 */
async function computeStatsForRuns(prisma: PrismaClient, runIds: string[]): Promise<Map<string, RunStats>> {
  if (runIds.length === 0) return new Map();

  // Get total counts per run
  const totals = await prisma.runItem.groupBy({
    by: ['runId'],
    where: { runId: { in: runIds } },
    _count: true,
  });

  // Fetch per-run result counts
  const runItems = await prisma.runItem.findMany({
    where: { runId: { in: runIds } },
    select: { runId: true, result: { select: { status: true } } },
  });

  const statsMap = new Map<string, RunStats>();

  // Initialize stats for all runs
  const totalMap = new Map(totals.map((t) => [t.runId, t._count]));
  for (const runId of runIds) {
    statsMap.set(runId, { ...emptyStats(), total: totalMap.get(runId) ?? 0 });
  }

  // Count results per run
  for (const item of runItems) {
    const stats = statsMap.get(item.runId)!;
    if (item.result) {
      const key = item.result.status as keyof RunStats;
      if (key in stats && key !== 'total' && key !== 'untested') {
        stats[key]++;
      }
    }
  }

  // Calculate untested
  for (const [, stats] of statsMap) {
    const recorded = stats.passed + stats.failed + stats.blocked + stats.skipped + stats.retest;
    stats.untested = stats.total - recorded;
  }

  return statsMap;
}

/**
 * Compute stats from in-memory items (used when items are already loaded)
 */
function computeStatsFromItems(items: Array<{ result: { status: string } | null }>): RunStats {
  const stats = emptyStats();
  stats.total = items.length;

  for (const item of items) {
    if (item.result) {
      const key = item.result.status as keyof RunStats;
      if (key in stats && key !== 'total' && key !== 'untested') {
        stats[key]++;
      }
    }
  }

  const recorded = stats.passed + stats.failed + stats.blocked + stats.skipped + stats.retest;
  stats.untested = stats.total - recorded;

  return stats;
}

/**
 * Get all descendant suite IDs recursively
 */
async function getAllDescendantSuiteIds(
  prisma: PrismaClient,
  suiteIds: string[],
  projectId: string
): Promise<string[]> {
  // Fetch all suites in the project
  const allSuites = await prisma.suiteNode.findMany({
    where: { projectId },
    select: { id: true, parentId: true },
  });

  // Build parent->children map
  const childrenMap = new Map<string, string[]>();
  for (const suite of allSuites) {
    if (suite.parentId) {
      const children = childrenMap.get(suite.parentId) ?? [];
      children.push(suite.id);
      childrenMap.set(suite.parentId, children);
    }
  }

  // BFS to collect all descendants
  const result = new Set<string>(suiteIds);
  const queue = [...suiteIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childrenMap.get(current) ?? [];
    for (const child of children) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }

  return Array.from(result);
}
