import type { PrismaClient } from '@opencase/db';
import { z } from 'zod';
import { hashContent, generateLexoRank, getLexoRankBetween } from '@opencase/shared';
import type { Test, TestSummary, TestVersion, TestContent, PaginatedResponse, BulkResult, BulkFailure, TestDiff, DiffChange, ContentBlock } from '@opencase/shared';

// ============ Schemas ============

const contentBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['step', 'expected', 'note', 'precondition', 'table', 'attachment']),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const testContentSchema = z.object({
  description: z.string().optional(),
  blocks: z.array(contentBlockSchema).default([]),
});

export const createTestSchema = z.object({
  title: z.string().min(1).max(200),
  suiteId: z.string().optional(),
  content: testContentSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTestSchema = z.object({
  title: z.string().min(1).max(200),
  content: testContentSchema,
  source: z.enum(['human', 'ai', 'import']).optional().default('human'),
});

export const listTestsSchema = z.object({
  suiteId: z.string().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const moveTestSchema = z.object({
  targetSuiteId: z.string().nullable(),
  afterTestId: z.string().optional(),
});

export const bulkCreateTestsSchema = z.object({
  tests: z.array(createTestSchema).min(1).max(100),
});

export const bulkUpdateTestsSchema = z.object({
  tests: z.array(updateTestSchema.extend({ id: z.string() })).min(1).max(100),
});

export const bulkDeleteTestsSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export type ListTestsOptions = z.infer<typeof listTestsSchema>;
export type MoveTestInput = z.infer<typeof moveTestSchema>;
export type BulkCreateTestsInput = z.infer<typeof bulkCreateTestsSchema>;
export type BulkUpdateTestsInput = z.infer<typeof bulkUpdateTestsSchema>;
export type BulkDeleteTestsInput = z.infer<typeof bulkDeleteTestsSchema>;

// ============ Service ============

export const testService = {
  /**
   * List tests with optional filters and pagination
   */
  async listTests(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    options: ListTestsOptions
  ): Promise<PaginatedResponse<TestSummary> | null> {
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

    const { suiteId, search, cursor, limit } = options;

    // Build where clause
    const where: Record<string, unknown> = { projectId };

    // Filter by suite if provided
    if (suiteId) {
      const suiteItems = await prisma.suiteItem.findMany({
        where: { suiteNodeId: suiteId },
        select: { testId: true },
      });
      where.id = { in: suiteItems.map((si) => si.testId) };
    }

    // Search filter (search in current version title)
    if (search) {
      where.currentVersion = {
        title: { contains: search, mode: 'insensitive' },
      };
    }

    // Cursor pagination
    if (cursor) {
      where.id = { ...(where.id as object || {}), gt: cursor };
    }

    const tests = await prisma.test.findMany({
      where,
      take: limit + 1, // Fetch one extra to check hasMore
      orderBy: { code: 'asc' },
      include: {
        currentVersion: {
          include: {
            createdBy: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    const hasMore = tests.length > limit;
    const items = hasMore ? tests.slice(0, limit) : tests;

    const data: TestSummary[] = items.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      code: t.code,
      title: t.currentVersion?.title ?? '',
      tags: t.tags.map((tt) => ({
        id: tt.tag.id,
        projectId: tt.tag.projectId,
        name: tt.tag.name,
        color: tt.tag.color,
        createdAt: tt.tag.createdAt.toISOString(),
      })),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
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
   * Get single test with current version
   */
  async getTest(
    prisma: PrismaClient,
    projectId: string,
    testId: string,
    userId: string
  ): Promise<Test | null> {
    const test = await prisma.test.findFirst({
      where: { id: testId, projectId },
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
        currentVersion: {
          include: {
            createdBy: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!test || test.project.workspace.members.length === 0) {
      return null;
    }

    return {
      id: test.id,
      projectId: test.projectId,
      code: test.code,
      title: test.currentVersion?.title ?? '',
      tags: test.tags.map((tt) => ({
        id: tt.tag.id,
        projectId: tt.tag.projectId,
        name: tt.tag.name,
        color: tt.tag.color,
        createdAt: tt.tag.createdAt.toISOString(),
      })),
      currentVersion: test.currentVersion
        ? {
            id: test.currentVersion.id,
            testId: test.currentVersion.testId,
            version: test.currentVersion.version,
            title: test.currentVersion.title,
            content: test.currentVersion.content as unknown as TestContent,
            contentHash: test.currentVersion.contentHash,
            source: test.currentVersion.source as 'human' | 'ai' | 'import',
            createdBy: {
              id: test.currentVersion.createdBy.id,
              email: test.currentVersion.createdBy.email,
              name: test.currentVersion.createdBy.name,
              avatarUrl: test.currentVersion.createdBy.avatarUrl,
            },
            createdAt: test.currentVersion.createdAt.toISOString(),
          }
        : null,
      createdAt: test.createdAt.toISOString(),
      updatedAt: test.updatedAt.toISOString(),
    };
  },

  /**
   * Create test with initial version
   */
  async createTest(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    input: CreateTestInput
  ) {
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

    // Verify suite exists if provided
    if (input.suiteId) {
      const suite = await prisma.suiteNode.findFirst({
        where: { id: input.suiteId, projectId },
      });
      if (!suite) {
        return { error: 'NOT_FOUND', message: 'Suite not found' };
      }
    }

    // Verify tags exist if provided
    if (input.tags && input.tags.length > 0) {
      const tags = await prisma.tag.findMany({
        where: { id: { in: input.tags }, projectId },
      });
      if (tags.length !== input.tags.length) {
        return { error: 'NOT_FOUND', message: 'One or more tags not found' };
      }
    }

    // Generate test code atomically
    const code = await generateTestCode(prisma, projectId);

    // Prepare content
    const content: TestContent = input.content ?? { blocks: [] };
    const contentHash = hashContent(content);

    // Create test, version, and optional suite item in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create test (without currentVersion first)
      const test = await tx.test.create({
        data: {
          projectId,
          code,
        },
      });

      // Create initial version
      const version = await tx.testVersion.create({
        data: {
          testId: test.id,
          version: 1,
          title: input.title,
          content: content as object,
          contentHash,
          source: 'human',
          createdById: userId,
        },
        include: {
          createdBy: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });

      // Link current version
      await tx.test.update({
        where: { id: test.id },
        data: { currentVersionId: version.id },
      });

      // Add to suite if provided
      if (input.suiteId) {
        const orderKey = await calculateSuiteItemOrderKey(tx as PrismaClient, input.suiteId);
        await tx.suiteItem.create({
          data: {
            suiteNodeId: input.suiteId,
            testId: test.id,
            orderKey,
          },
        });
      }

      // Add tags if provided
      if (input.tags && input.tags.length > 0) {
        await tx.testTag.createMany({
          data: input.tags.map((tagId) => ({
            testId: test.id,
            tagId,
          })),
        });
      }

      return { test, version };
    });

    // Fetch full test with relations
    const fullTest = await prisma.test.findUnique({
      where: { id: result.test.id },
      include: {
        currentVersion: {
          include: {
            createdBy: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!fullTest || !fullTest.currentVersion) {
      return { error: 'INTERNAL', message: 'Failed to create test' };
    }

    return {
      data: {
        id: fullTest.id,
        projectId: fullTest.projectId,
        code: fullTest.code,
        title: fullTest.currentVersion.title,
        tags: fullTest.tags.map((tt) => ({
          id: tt.tag.id,
          projectId: tt.tag.projectId,
          name: tt.tag.name,
          color: tt.tag.color,
          createdAt: tt.tag.createdAt.toISOString(),
        })),
        currentVersion: {
          id: fullTest.currentVersion.id,
          testId: fullTest.currentVersion.testId,
          version: fullTest.currentVersion.version,
          title: fullTest.currentVersion.title,
          content: fullTest.currentVersion.content as unknown as TestContent,
          contentHash: fullTest.currentVersion.contentHash,
          source: fullTest.currentVersion.source as 'human' | 'ai' | 'import',
          createdBy: {
            id: fullTest.currentVersion.createdBy.id,
            email: fullTest.currentVersion.createdBy.email,
            name: fullTest.currentVersion.createdBy.name,
            avatarUrl: fullTest.currentVersion.createdBy.avatarUrl,
          },
          createdAt: fullTest.currentVersion.createdAt.toISOString(),
        },
        createdAt: fullTest.createdAt.toISOString(),
        updatedAt: fullTest.updatedAt.toISOString(),
      } as Test,
    };
  },

  /**
   * Get version history for a test
   */
  async getVersions(
    prisma: PrismaClient,
    projectId: string,
    testId: string,
    userId: string
  ): Promise<TestVersion[] | null> {
    const test = await prisma.test.findFirst({
      where: { id: testId, projectId },
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

    if (!test || test.project.workspace.members.length === 0) {
      return null;
    }

    const versions = await prisma.testVersion.findMany({
      where: { testId },
      orderBy: { version: 'desc' },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    return versions.map((v) => ({
      id: v.id,
      testId: v.testId,
      version: v.version,
      title: v.title,
      content: v.content as unknown as TestContent,
      contentHash: v.contentHash,
      source: v.source as 'human' | 'ai' | 'import',
      createdBy: {
        id: v.createdBy.id,
        email: v.createdBy.email,
        name: v.createdBy.name,
        avatarUrl: v.createdBy.avatarUrl,
      },
      createdAt: v.createdAt.toISOString(),
    }));
  },

  /**
   * Compare two versions and return the diff
   */
  async diffVersions(
    prisma: PrismaClient,
    projectId: string,
    testId: string,
    userId: string,
    version1: number,
    version2: number
  ): Promise<TestDiff | null | { error: string; message: string }> {
    // Verify access to test
    const test = await prisma.test.findFirst({
      where: { id: testId, projectId },
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

    if (!test || test.project.workspace.members.length === 0) {
      return null;
    }

    // Fetch both versions
    const [v1, v2] = await Promise.all([
      prisma.testVersion.findFirst({
        where: { testId, version: version1 },
      }),
      prisma.testVersion.findFirst({
        where: { testId, version: version2 },
      }),
    ]);

    if (!v1 || !v2) {
      return { error: 'NOT_FOUND', message: 'One or both versions not found' };
    }

    const content1 = v1.content as unknown as TestContent;
    const content2 = v2.content as unknown as TestContent;

    const changes = computeBlockDiff(content1.blocks ?? [], content2.blocks ?? []);

    // Also check for title/description changes
    if (v1.title !== v2.title) {
      changes.unshift({
        type: 'modified',
        field: 'title',
        oldValue: v1.title,
        newValue: v2.title,
      } as DiffChange & { field: string; oldValue: string; newValue: string });
    }

    if (content1.description !== content2.description) {
      changes.unshift({
        type: 'modified',
        field: 'description',
        oldValue: content1.description ?? '',
        newValue: content2.description ?? '',
      } as DiffChange & { field: string; oldValue: string; newValue: string });
    }

    return {
      version1,
      version2,
      changes,
    };
  },

  /**
   * Update test (creates a new version)
   */
  async updateTest(
    prisma: PrismaClient,
    projectId: string,
    testId: string,
    userId: string,
    input: UpdateTestInput
  ): Promise<{ data: Test; noChange?: boolean } | { error: string; message: string }> {
    // Verify access and fetch test with current version
    const test = await prisma.test.findFirst({
      where: { id: testId, projectId },
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
        currentVersion: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!test || test.project.workspace.members.length === 0) {
      return { error: 'NOT_FOUND', message: 'Test not found' };
    }

    // Compute content hash
    const contentHash = hashContent(input.content);

    // Check if content actually changed
    const titleChanged = test.currentVersion?.title !== input.title;
    const contentChanged = test.currentVersion?.contentHash !== contentHash;

    if (!titleChanged && !contentChanged) {
      // No changes - return current test without creating new version
      const fullTest = await getFullTest(prisma, testId);
      if (!fullTest) {
        return { error: 'INTERNAL', message: 'Failed to fetch test' };
      }
      return { data: fullTest, noChange: true };
    }

    // Get next version number
    const latestVersion = await prisma.testVersion.findFirst({
      where: { testId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Create new version in transaction
    await prisma.$transaction(async (tx) => {
      // Create new version
      const version = await tx.testVersion.create({
        data: {
          testId,
          version: nextVersion,
          title: input.title,
          content: input.content as object,
          contentHash,
          source: input.source,
          createdById: userId,
        },
      });

      // Update test to point to new version
      await tx.test.update({
        where: { id: testId },
        data: { currentVersionId: version.id },
      });
    });

    // Fetch and return updated test
    const fullTest = await getFullTest(prisma, testId);
    if (!fullTest) {
      return { error: 'INTERNAL', message: 'Failed to fetch updated test' };
    }

    return { data: fullTest };
  },

  /**
   * Bulk delete tests
   */
  async bulkDeleteTests(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    ids: string[]
  ): Promise<BulkResult<TestSummary> | { error: string; message: string }> {
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
      return { error: 'NOT_FOUND', message: 'Project not found' };
    }

    // Fetch all tests to verify they exist and belong to project
    const tests = await prisma.test.findMany({
      where: { id: { in: ids }, projectId },
      include: {
        currentVersion: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    const foundIds = new Set(tests.map((t) => t.id));
    const succeeded: TestSummary[] = [];
    const failed: BulkFailure[] = [];

    // Collect not found errors
    for (const id of ids) {
      if (!foundIds.has(id)) {
        failed.push({ id, error: 'NOT_FOUND', message: 'Test not found' });
      }
    }

    // Build summaries before deletion
    const summaries = new Map<string, TestSummary>();
    for (const test of tests) {
      summaries.set(test.id, {
        id: test.id,
        projectId: test.projectId,
        code: test.code,
        title: test.currentVersion?.title ?? '',
        tags: test.tags.map((tt) => ({
          id: tt.tag.id,
          projectId: tt.tag.projectId,
          name: tt.tag.name,
          color: tt.tag.color,
          createdAt: tt.tag.createdAt.toISOString(),
        })),
        createdAt: test.createdAt.toISOString(),
        updatedAt: test.updatedAt.toISOString(),
      });
    }

    // Delete all found tests in a transaction
    if (tests.length > 0) {
      await prisma.test.deleteMany({
        where: { id: { in: tests.map((t) => t.id) } },
      });

      for (const test of tests) {
        const summary = summaries.get(test.id);
        if (summary) {
          succeeded.push(summary);
        }
      }
    }

    return { succeeded, failed };
  },

  /**
   * Delete a single test
   */
  async deleteTest(
    prisma: PrismaClient,
    projectId: string,
    testId: string,
    userId: string
  ): Promise<{ data: TestSummary } | { error: string; message: string }> {
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
      return { error: 'NOT_FOUND', message: 'Project not found' };
    }

    // Find the test
    const test = await prisma.test.findFirst({
      where: { id: testId, projectId },
      include: {
        currentVersion: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!test) {
      return { error: 'NOT_FOUND', message: 'Test not found' };
    }

    // Build summary before deletion
    const summary: TestSummary = {
      id: test.id,
      projectId: test.projectId,
      code: test.code,
      title: test.currentVersion?.title ?? '',
      tags: test.tags.map((tt) => ({
        id: tt.tag.id,
        projectId: tt.tag.projectId,
        name: tt.tag.name,
        color: tt.tag.color,
        createdAt: tt.tag.createdAt.toISOString(),
      })),
      createdAt: test.createdAt.toISOString(),
      updatedAt: test.updatedAt.toISOString(),
    };

    // Delete the test (cascade will handle versions, tags, suite items)
    await prisma.test.delete({
      where: { id: testId },
    });

    return { data: summary };
  },

  /**
   * Bulk create tests
   */
  async bulkCreateTests(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    inputs: CreateTestInput[]
  ): Promise<BulkResult<Test> | { error: string; message: string }> {
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
      return { error: 'NOT_FOUND', message: 'Project not found' };
    }

    // Collect all suiteIds and tagIds for validation
    const allSuiteIds = new Set<string>();
    const allTagIds = new Set<string>();
    for (const input of inputs) {
      if (input.suiteId) allSuiteIds.add(input.suiteId);
      if (input.tags) input.tags.forEach((t) => allTagIds.add(t));
    }

    // Validate suites exist
    const validSuiteIds = new Set<string>();
    if (allSuiteIds.size > 0) {
      const suites = await prisma.suiteNode.findMany({
        where: { id: { in: Array.from(allSuiteIds) }, projectId },
        select: { id: true },
      });
      suites.forEach((s) => validSuiteIds.add(s.id));
    }

    // Validate tags exist
    const validTagIds = new Set<string>();
    if (allTagIds.size > 0) {
      const tags = await prisma.tag.findMany({
        where: { id: { in: Array.from(allTagIds) }, projectId },
        select: { id: true },
      });
      tags.forEach((t) => validTagIds.add(t.id));
    }

    const succeeded: Test[] = [];
    const failed: BulkFailure[] = [];

    // Process each test independently
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      // Validate suite
      if (input.suiteId && !validSuiteIds.has(input.suiteId)) {
        failed.push({ index: i, error: 'NOT_FOUND', message: 'Suite not found' });
        continue;
      }

      // Validate tags
      if (input.tags && input.tags.some((t) => !validTagIds.has(t))) {
        failed.push({ index: i, error: 'NOT_FOUND', message: 'One or more tags not found' });
        continue;
      }

      try {
        // Generate test code
        const code = await generateTestCode(prisma, projectId);
        const content: TestContent = input.content ?? { blocks: [] };
        const contentHash = hashContent(content);

        // Create in transaction
        const result = await prisma.$transaction(async (tx) => {
          const test = await tx.test.create({
            data: { projectId, code },
          });

          const version = await tx.testVersion.create({
            data: {
              testId: test.id,
              version: 1,
              title: input.title,
              content: content as object,
              contentHash,
              source: 'human',
              createdById: userId,
            },
          });

          await tx.test.update({
            where: { id: test.id },
            data: { currentVersionId: version.id },
          });

          if (input.suiteId) {
            const orderKey = await calculateSuiteItemOrderKey(tx as PrismaClient, input.suiteId);
            await tx.suiteItem.create({
              data: {
                suiteNodeId: input.suiteId,
                testId: test.id,
                orderKey,
              },
            });
          }

          if (input.tags && input.tags.length > 0) {
            await tx.testTag.createMany({
              data: input.tags.map((tagId) => ({
                testId: test.id,
                tagId,
              })),
            });
          }

          return test.id;
        });

        // Fetch full test
        const fullTest = await getFullTest(prisma, result);
        if (fullTest) {
          succeeded.push(fullTest);
        } else {
          failed.push({ index: i, error: 'INTERNAL', message: 'Failed to fetch created test' });
        }
      } catch (err) {
        failed.push({
          index: i,
          error: 'INTERNAL',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { succeeded, failed };
  },

  /**
   * Bulk update tests
   */
  async bulkUpdateTests(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    inputs: Array<UpdateTestInput & { id: string }>
  ): Promise<BulkResult<Test> | { error: string; message: string }> {
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
      return { error: 'NOT_FOUND', message: 'Project not found' };
    }

    // Fetch all tests to verify they exist
    const testIds = inputs.map((i) => i.id);
    const tests = await prisma.test.findMany({
      where: { id: { in: testIds }, projectId },
      include: { currentVersion: true },
    });
    const testMap = new Map(tests.map((t) => [t.id, t]));

    const succeeded: Test[] = [];
    const failed: BulkFailure[] = [];

    for (const input of inputs) {
      const test = testMap.get(input.id);
      if (!test) {
        failed.push({ id: input.id, error: 'NOT_FOUND', message: 'Test not found' });
        continue;
      }

      try {
        const contentHash = hashContent(input.content);
        const titleChanged = test.currentVersion?.title !== input.title;
        const contentChanged = test.currentVersion?.contentHash !== contentHash;

        if (!titleChanged && !contentChanged) {
          // No change, fetch and return current
          const fullTest = await getFullTest(prisma, input.id);
          if (fullTest) {
            succeeded.push(fullTest);
          }
          continue;
        }

        // Get next version number
        const latestVersion = await prisma.testVersion.findFirst({
          where: { testId: input.id },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const nextVersion = (latestVersion?.version ?? 0) + 1;

        // Create new version
        await prisma.$transaction(async (tx) => {
          const version = await tx.testVersion.create({
            data: {
              testId: input.id,
              version: nextVersion,
              title: input.title,
              content: input.content as object,
              contentHash,
              source: input.source ?? 'human',
              createdById: userId,
            },
          });

          await tx.test.update({
            where: { id: input.id },
            data: { currentVersionId: version.id },
          });
        });

        const fullTest = await getFullTest(prisma, input.id);
        if (fullTest) {
          succeeded.push(fullTest);
        } else {
          failed.push({ id: input.id, error: 'INTERNAL', message: 'Failed to fetch updated test' });
        }
      } catch (err) {
        failed.push({
          id: input.id,
          error: 'INTERNAL',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { succeeded, failed };
  },

  /**
   * Get all tests grouped by suite
   */
  async getGroupedTests(
    prisma: PrismaClient,
    projectId: string,
    userId: string
  ): Promise<{ data: { suites: Array<{ suiteId: string; tests: TestSummary[] }>; unassigned: TestSummary[] } } | null> {
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

    // Fetch all tests with their suite associations
    const tests = await prisma.test.findMany({
      where: { projectId },
      orderBy: { code: 'asc' },
      include: {
        currentVersion: {
          include: {
            createdBy: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
        tags: {
          include: { tag: true },
        },
        suiteItems: {
          select: { suiteNodeId: true, orderKey: true },
          orderBy: { orderKey: 'asc' },
        },
      },
    });

    // Group tests by suite
    const suiteMap = new Map<string, Array<{ test: typeof tests[0]; orderKey: string }>>();
    const unassigned: TestSummary[] = [];

    for (const test of tests) {
      const summary: TestSummary = {
        id: test.id,
        projectId: test.projectId,
        code: test.code,
        title: test.currentVersion?.title ?? '',
        tags: test.tags.map((tt) => ({
          id: tt.tag.id,
          projectId: tt.tag.projectId,
          name: tt.tag.name,
          color: tt.tag.color,
          createdAt: tt.tag.createdAt.toISOString(),
        })),
        createdAt: test.createdAt.toISOString(),
        updatedAt: test.updatedAt.toISOString(),
      };

      if (test.suiteItems.length === 0) {
        unassigned.push(summary);
      } else {
        // A test could theoretically be in multiple suites, but we use the first one
        const suiteItem = test.suiteItems[0];
        if (!suiteMap.has(suiteItem.suiteNodeId)) {
          suiteMap.set(suiteItem.suiteNodeId, []);
        }
        suiteMap.get(suiteItem.suiteNodeId)!.push({ test, orderKey: suiteItem.orderKey });
      }
    }

    // Build suite groups, ordered by suite item orderKey
    const suites: Array<{ suiteId: string; tests: TestSummary[] }> = [];
    for (const [suiteId, items] of suiteMap) {
      items.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
      suites.push({
        suiteId,
        tests: items.map((item) => ({
          id: item.test.id,
          projectId: item.test.projectId,
          code: item.test.code,
          title: item.test.currentVersion?.title ?? '',
          tags: item.test.tags.map((tt) => ({
            id: tt.tag.id,
            projectId: tt.tag.projectId,
            name: tt.tag.name,
            color: tt.tag.color,
            createdAt: tt.tag.createdAt.toISOString(),
          })),
          createdAt: item.test.createdAt.toISOString(),
          updatedAt: item.test.updatedAt.toISOString(),
        })),
      });
    }

    return { data: { suites, unassigned } };
  },

  /**
   * Move a test to a different suite (or unassign from all suites)
   */
  async moveTestToSuite(
    prisma: PrismaClient,
    projectId: string,
    testId: string,
    userId: string,
    input: MoveTestInput
  ): Promise<{ data: TestSummary } | { error: string; message: string }> {
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
      return { error: 'NOT_FOUND', message: 'Project not found' };
    }

    // Verify test exists
    const test = await prisma.test.findFirst({
      where: { id: testId, projectId },
      include: {
        currentVersion: true,
        tags: { include: { tag: true } },
      },
    });

    if (!test) {
      return { error: 'NOT_FOUND', message: 'Test not found' };
    }

    // Verify target suite exists if provided
    if (input.targetSuiteId) {
      const suite = await prisma.suiteNode.findFirst({
        where: { id: input.targetSuiteId, projectId },
      });
      if (!suite) {
        return { error: 'NOT_FOUND', message: 'Target suite not found' };
      }
    }

    // Move in transaction
    await prisma.$transaction(async (tx) => {
      // Remove all existing suite associations
      await tx.suiteItem.deleteMany({
        where: { testId },
      });

      // Create new association if target suite provided
      if (input.targetSuiteId) {
        const orderKey = await calculateSuiteItemOrderKey(
          tx as PrismaClient,
          input.targetSuiteId,
          input.afterTestId
        );
        await tx.suiteItem.create({
          data: {
            suiteNodeId: input.targetSuiteId,
            testId,
            orderKey,
          },
        });
      }
    });

    const summary: TestSummary = {
      id: test.id,
      projectId: test.projectId,
      code: test.code,
      title: test.currentVersion?.title ?? '',
      tags: test.tags.map((tt) => ({
        id: tt.tag.id,
        projectId: tt.tag.projectId,
        name: tt.tag.name,
        color: tt.tag.color,
        createdAt: tt.tag.createdAt.toISOString(),
      })),
      createdAt: test.createdAt.toISOString(),
      updatedAt: test.updatedAt.toISOString(),
    };

    return { data: summary };
  },
};

// ============ Helper Functions ============

async function generateTestCode(
  prisma: PrismaClient,
  projectId: string
): Promise<string> {
  // Atomically increment and get counter
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { testCounter: { increment: 1 } },
    select: { testCounter: true },
  });

  return `TC-${project.testCounter}`;
}

async function calculateSuiteItemOrderKey(
  prisma: PrismaClient,
  suiteId: string,
  afterTestId?: string
): Promise<string> {
  const siblings = await prisma.suiteItem.findMany({
    where: { suiteNodeId: suiteId },
    orderBy: { orderKey: 'asc' },
    select: { testId: true, orderKey: true },
  });

  if (siblings.length === 0) {
    return generateLexoRank(0);
  }

  if (!afterTestId) {
    // Append to end
    const last = siblings[siblings.length - 1];
    return getLexoRankBetween(last.orderKey, null);
  }

  const afterIndex = siblings.findIndex((s) => s.testId === afterTestId);
  if (afterIndex === -1) {
    const last = siblings[siblings.length - 1];
    return getLexoRankBetween(last.orderKey, null);
  }

  const before = siblings[afterIndex].orderKey;
  const after = siblings[afterIndex + 1]?.orderKey ?? null;
  return getLexoRankBetween(before, after);
}

async function getFullTest(
  prisma: PrismaClient,
  testId: string
): Promise<Test | null> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      currentVersion: {
        include: {
          createdBy: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      },
      tags: {
        include: { tag: true },
      },
    },
  });

  if (!test) {
    return null;
  }

  return {
    id: test.id,
    projectId: test.projectId,
    code: test.code,
    title: test.currentVersion?.title ?? '',
    tags: test.tags.map((tt) => ({
      id: tt.tag.id,
      projectId: tt.tag.projectId,
      name: tt.tag.name,
      color: tt.tag.color,
      createdAt: tt.tag.createdAt.toISOString(),
    })),
    currentVersion: test.currentVersion
      ? {
          id: test.currentVersion.id,
          testId: test.currentVersion.testId,
          version: test.currentVersion.version,
          title: test.currentVersion.title,
          content: test.currentVersion.content as unknown as TestContent,
          contentHash: test.currentVersion.contentHash,
          source: test.currentVersion.source as 'human' | 'ai' | 'import',
          createdBy: {
            id: test.currentVersion.createdBy.id,
            email: test.currentVersion.createdBy.email,
            name: test.currentVersion.createdBy.name,
            avatarUrl: test.currentVersion.createdBy.avatarUrl,
          },
          createdAt: test.currentVersion.createdAt.toISOString(),
        }
      : null,
    createdAt: test.createdAt.toISOString(),
    updatedAt: test.updatedAt.toISOString(),
  };
}

function computeBlockDiff(oldBlocks: ContentBlock[], newBlocks: ContentBlock[]): DiffChange[] {
  const changes: DiffChange[] = [];
  const oldMap = new Map(oldBlocks.map((b) => [b.id, b]));
  const newMap = new Map(newBlocks.map((b) => [b.id, b]));

  // Find removed and modified blocks
  for (const oldBlock of oldBlocks) {
    const newBlock = newMap.get(oldBlock.id);
    if (!newBlock) {
      changes.push({
        type: 'removed',
        blockId: oldBlock.id,
        oldValue: oldBlock,
      });
    } else if (
      oldBlock.type !== newBlock.type ||
      oldBlock.content !== newBlock.content
    ) {
      changes.push({
        type: 'modified',
        blockId: oldBlock.id,
        oldValue: oldBlock,
        newValue: newBlock,
      });
    }
  }

  // Find added blocks
  for (const newBlock of newBlocks) {
    if (!oldMap.has(newBlock.id)) {
      changes.push({
        type: 'added',
        blockId: newBlock.id,
        newValue: newBlock,
      });
    }
  }

  return changes;
}
