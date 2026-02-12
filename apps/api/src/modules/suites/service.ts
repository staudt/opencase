import type { PrismaClient } from '@opencase/db';
import { z } from 'zod';
import { generateLexoRank, getLexoRankBetween } from '@opencase/shared';
import type { SuiteNode } from '@opencase/shared';

// ============ Schemas ============

export const createSuiteSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().nullish(),
  afterSuiteId: z.string().optional(),
});

export const updateSuiteSchema = z.object({
  name: z.string().min(1).max(100),
});

export const moveSuiteSchema = z.object({
  parentId: z.string().nullable(),
  afterSuiteId: z.string().optional(),
});

export type CreateSuiteInput = z.infer<typeof createSuiteSchema>;
export type UpdateSuiteInput = z.infer<typeof updateSuiteSchema>;
export type MoveSuiteInput = z.infer<typeof moveSuiteSchema>;

// ============ Service ============

export const suiteService = {
  /**
   * Get suite tree for a project (nested structure)
   */
  async getSuiteTree(
    prisma: PrismaClient,
    projectId: string,
    userId: string
  ): Promise<SuiteNode[] | null> {
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

    // Fetch all suites for project
    const suites = await prisma.suiteNode.findMany({
      where: { projectId },
      orderBy: { orderKey: 'asc' },
      include: {
        _count: { select: { items: true } },
      },
    });

    // Build tree structure
    return buildSuiteTree(suites);
  },

  /**
   * Get single suite with items
   */
  async getSuite(
    prisma: PrismaClient,
    projectId: string,
    suiteId: string,
    userId: string
  ): Promise<SuiteNode | null> {
    const suite = await prisma.suiteNode.findFirst({
      where: { id: suiteId, projectId },
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
        _count: { select: { items: true } },
      },
    });

    if (!suite || suite.project.workspace.members.length === 0) {
      return null;
    }

    return {
      id: suite.id,
      projectId: suite.projectId,
      parentId: suite.parentId,
      name: suite.name,
      orderKey: suite.orderKey,
      itemCount: suite._count.items,
      createdAt: suite.createdAt.toISOString(),
      updatedAt: suite.updatedAt.toISOString(),
    };
  },

  /**
   * Create a new suite
   */
  async createSuite(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    input: CreateSuiteInput
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

    // If parentId is provided, verify it exists
    const parentId = input.parentId ?? null;
    if (parentId) {
      const parent = await prisma.suiteNode.findFirst({
        where: { id: parentId, projectId },
      });
      if (!parent) {
        return { error: 'NOT_FOUND', message: 'Parent suite not found' };
      }
    }

    // Calculate orderKey
    const orderKey = await calculateOrderKey(
      prisma,
      projectId,
      parentId,
      input.afterSuiteId
    );

    const suite = await prisma.suiteNode.create({
      data: {
        projectId,
        parentId,
        name: input.name,
        orderKey,
      },
      include: {
        _count: { select: { items: true } },
      },
    });

    return {
      data: {
        id: suite.id,
        projectId: suite.projectId,
        parentId: suite.parentId,
        name: suite.name,
        orderKey: suite.orderKey,
        itemCount: suite._count.items,
        createdAt: suite.createdAt.toISOString(),
        updatedAt: suite.updatedAt.toISOString(),
      } as SuiteNode,
    };
  },

  /**
   * Update suite (rename)
   */
  async updateSuite(
    prisma: PrismaClient,
    projectId: string,
    suiteId: string,
    userId: string,
    input: UpdateSuiteInput
  ) {
    // Verify access and existence
    const existing = await prisma.suiteNode.findFirst({
      where: { id: suiteId, projectId },
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
      return { error: 'NOT_FOUND', message: 'Suite not found' };
    }

    const suite = await prisma.suiteNode.update({
      where: { id: suiteId },
      data: { name: input.name },
      include: {
        _count: { select: { items: true } },
      },
    });

    return {
      data: {
        id: suite.id,
        projectId: suite.projectId,
        parentId: suite.parentId,
        name: suite.name,
        orderKey: suite.orderKey,
        itemCount: suite._count.items,
        createdAt: suite.createdAt.toISOString(),
        updatedAt: suite.updatedAt.toISOString(),
      } as SuiteNode,
    };
  },

  /**
   * Move suite (reorder or reparent)
   */
  async moveSuite(
    prisma: PrismaClient,
    projectId: string,
    suiteId: string,
    userId: string,
    input: MoveSuiteInput
  ) {
    // Verify access and existence
    const existing = await prisma.suiteNode.findFirst({
      where: { id: suiteId, projectId },
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
      return { error: 'NOT_FOUND', message: 'Suite not found' };
    }

    // Prevent moving to self or descendant
    if (input.parentId) {
      if (input.parentId === suiteId) {
        return { error: 'BAD_REQUEST', message: 'Cannot move suite into itself' };
      }

      // Check if target parent is a descendant
      const isDescendant = await isDescendantOf(prisma, input.parentId, suiteId);
      if (isDescendant) {
        return { error: 'BAD_REQUEST', message: 'Cannot move suite into its own descendant' };
      }

      // Verify parent exists
      const parent = await prisma.suiteNode.findFirst({
        where: { id: input.parentId, projectId },
      });
      if (!parent) {
        return { error: 'NOT_FOUND', message: 'Target parent suite not found' };
      }
    }

    // Calculate new orderKey
    const orderKey = await calculateOrderKey(
      prisma,
      projectId,
      input.parentId,
      input.afterSuiteId
    );

    const suite = await prisma.suiteNode.update({
      where: { id: suiteId },
      data: {
        parentId: input.parentId,
        orderKey,
      },
      include: {
        _count: { select: { items: true } },
      },
    });

    return {
      data: {
        id: suite.id,
        projectId: suite.projectId,
        parentId: suite.parentId,
        name: suite.name,
        orderKey: suite.orderKey,
        itemCount: suite._count.items,
        createdAt: suite.createdAt.toISOString(),
        updatedAt: suite.updatedAt.toISOString(),
      } as SuiteNode,
    };
  },

  /**
   * Delete suite and all children
   */
  async deleteSuite(
    prisma: PrismaClient,
    projectId: string,
    suiteId: string,
    userId: string
  ) {
    // Verify access and existence
    const existing = await prisma.suiteNode.findFirst({
      where: { id: suiteId, projectId },
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
      return { error: 'NOT_FOUND', message: 'Suite not found' };
    }

    // Get all descendant IDs for cascade delete
    const descendantIds = await getDescendantIds(prisma, suiteId);
    const allIds = [suiteId, ...descendantIds];

    // Delete suite items first (foreign key constraint)
    await prisma.suiteItem.deleteMany({
      where: { suiteNodeId: { in: allIds } },
    });

    // Delete all suites (bottom-up to satisfy FK constraints)
    const deleteResult = await prisma.suiteNode.deleteMany({
      where: { id: { in: allIds } },
    });

    return {
      data: {
        success: true,
        deletedCount: deleteResult.count,
      },
    };
  },
};

// ============ Helper Functions ============

interface SuiteRecord {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  orderKey: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { items: number };
}

function buildSuiteTree(suites: SuiteRecord[]): SuiteNode[] {
  const suiteMap = new Map<string, SuiteNode & { children: SuiteNode[] }>();
  const roots: SuiteNode[] = [];

  // First pass: create all nodes
  for (const s of suites) {
    suiteMap.set(s.id, {
      id: s.id,
      projectId: s.projectId,
      parentId: s.parentId,
      name: s.name,
      orderKey: s.orderKey,
      itemCount: s._count.items,
      children: [],
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    });
  }

  // Second pass: build parent-child relationships
  for (const s of suites) {
    const node = suiteMap.get(s.id)!;
    if (s.parentId) {
      const parent = suiteMap.get(s.parentId);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

async function calculateOrderKey(
  prisma: PrismaClient,
  projectId: string,
  parentId: string | null,
  afterSuiteId?: string
): Promise<string> {
  // Get siblings at target location
  const siblings = await prisma.suiteNode.findMany({
    where: { projectId, parentId },
    orderBy: { orderKey: 'asc' },
    select: { id: true, orderKey: true },
  });

  if (siblings.length === 0) {
    return generateLexoRank(0);
  }

  if (!afterSuiteId) {
    // Insert at beginning
    const first = siblings[0];
    return getLexoRankBetween(null, first.orderKey);
  }

  const afterIndex = siblings.findIndex((s) => s.id === afterSuiteId);
  if (afterIndex === -1) {
    // afterSuiteId not found, append to end
    const last = siblings[siblings.length - 1];
    return getLexoRankBetween(last.orderKey, null);
  }

  const before = siblings[afterIndex].orderKey;
  const after = siblings[afterIndex + 1]?.orderKey ?? null;
  return getLexoRankBetween(before, after);
}

async function isDescendantOf(
  prisma: PrismaClient,
  potentialDescendantId: string,
  ancestorId: string
): Promise<boolean> {
  let currentId: string | null = potentialDescendantId;

  while (currentId) {
    if (currentId === ancestorId) {
      return true;
    }
    const found: { parentId: string | null } | null = await prisma.suiteNode.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = found?.parentId ?? null;
  }

  return false;
}

async function getDescendantIds(
  prisma: PrismaClient,
  suiteId: string
): Promise<string[]> {
  const descendants: string[] = [];
  const queue = [suiteId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await prisma.suiteNode.findMany({
      where: { parentId: currentId },
      select: { id: true },
    });

    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id);
    }
  }

  return descendants;
}
