import type { PrismaClient } from '@opencase/db';
import { z } from 'zod';

// ============ Schemas ============

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

// ============ Types ============

export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string;
  testCount: number;
  createdAt: string;
}

// ============ Service ============

export const tagService = {
  /**
   * List all tags for a project
   */
  async listTags(
    prisma: PrismaClient,
    projectId: string,
    userId: string
  ): Promise<Tag[] | null> {
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

    const tags = await prisma.tag.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { tests: true } },
      },
    });

    return tags.map((tag) => ({
      id: tag.id,
      projectId: tag.projectId,
      name: tag.name,
      color: tag.color,
      testCount: tag._count.tests,
      createdAt: tag.createdAt.toISOString(),
    }));
  },

  /**
   * Get a single tag
   */
  async getTag(
    prisma: PrismaClient,
    projectId: string,
    tagId: string,
    userId: string
  ): Promise<Tag | null> {
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, projectId },
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
        _count: { select: { tests: true } },
      },
    });

    if (!tag || tag.project.workspace.members.length === 0) {
      return null;
    }

    return {
      id: tag.id,
      projectId: tag.projectId,
      name: tag.name,
      color: tag.color,
      testCount: tag._count.tests,
      createdAt: tag.createdAt.toISOString(),
    };
  },

  /**
   * Create a new tag
   */
  async createTag(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    input: CreateTagInput
  ): Promise<{ data: Tag } | { error: string; message: string }> {
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

    // Check if tag name already exists in project
    const existing = await prisma.tag.findFirst({
      where: { projectId, name: input.name },
    });

    if (existing) {
      return { error: 'CONFLICT', message: 'Tag with this name already exists' };
    }

    const tag = await prisma.tag.create({
      data: {
        projectId,
        name: input.name,
        color: input.color ?? '#6366f1',
      },
      include: {
        _count: { select: { tests: true } },
      },
    });

    return {
      data: {
        id: tag.id,
        projectId: tag.projectId,
        name: tag.name,
        color: tag.color,
        testCount: tag._count.tests,
        createdAt: tag.createdAt.toISOString(),
      },
    };
  },

  /**
   * Update a tag
   */
  async updateTag(
    prisma: PrismaClient,
    projectId: string,
    tagId: string,
    userId: string,
    input: UpdateTagInput
  ): Promise<{ data: Tag } | { error: string; message: string }> {
    // Verify access and existence
    const existing = await prisma.tag.findFirst({
      where: { id: tagId, projectId },
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
      return { error: 'NOT_FOUND', message: 'Tag not found' };
    }

    // Check if new name conflicts with another tag
    if (input.name && input.name !== existing.name) {
      const conflict = await prisma.tag.findFirst({
        where: { projectId, name: input.name, id: { not: tagId } },
      });
      if (conflict) {
        return { error: 'CONFLICT', message: 'Tag with this name already exists' };
      }
    }

    const tag = await prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.color && { color: input.color }),
      },
      include: {
        _count: { select: { tests: true } },
      },
    });

    return {
      data: {
        id: tag.id,
        projectId: tag.projectId,
        name: tag.name,
        color: tag.color,
        testCount: tag._count.tests,
        createdAt: tag.createdAt.toISOString(),
      },
    };
  },

  /**
   * Delete a tag
   */
  async deleteTag(
    prisma: PrismaClient,
    projectId: string,
    tagId: string,
    userId: string
  ): Promise<{ data: { success: boolean } } | { error: string; message: string }> {
    // Verify access and existence
    const existing = await prisma.tag.findFirst({
      where: { id: tagId, projectId },
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
      return { error: 'NOT_FOUND', message: 'Tag not found' };
    }

    // Delete the tag (cascade will handle TestTag relations)
    await prisma.tag.delete({
      where: { id: tagId },
    });

    return { data: { success: true } };
  },

  /**
   * Add tags to a test
   */
  async addTagsToTest(
    prisma: PrismaClient,
    projectId: string,
    testId: string,
    userId: string,
    tagIds: string[]
  ): Promise<{ data: { added: number } } | { error: string; message: string }> {
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
    });

    if (!test) {
      return { error: 'NOT_FOUND', message: 'Test not found' };
    }

    // Verify all tags exist and belong to project
    const tags = await prisma.tag.findMany({
      where: { id: { in: tagIds }, projectId },
    });

    if (tags.length !== tagIds.length) {
      return { error: 'NOT_FOUND', message: 'One or more tags not found' };
    }

    // Get existing test-tag relations
    const existingRelations = await prisma.testTag.findMany({
      where: { testId, tagId: { in: tagIds } },
      select: { tagId: true },
    });

    const existingTagIds = new Set(existingRelations.map((r) => r.tagId));
    const newTagIds = tagIds.filter((id) => !existingTagIds.has(id));

    if (newTagIds.length > 0) {
      await prisma.testTag.createMany({
        data: newTagIds.map((tagId) => ({ testId, tagId })),
      });
    }

    return { data: { added: newTagIds.length } };
  },

  /**
   * Remove tags from a test
   */
  async removeTagsFromTest(
    prisma: PrismaClient,
    projectId: string,
    testId: string,
    userId: string,
    tagIds: string[]
  ): Promise<{ data: { removed: number } } | { error: string; message: string }> {
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
    });

    if (!test) {
      return { error: 'NOT_FOUND', message: 'Test not found' };
    }

    const result = await prisma.testTag.deleteMany({
      where: { testId, tagId: { in: tagIds } },
    });

    return { data: { removed: result.count } };
  },

  /**
   * Set tags for a test (replace all)
   */
  async setTestTags(
    prisma: PrismaClient,
    projectId: string,
    testId: string,
    userId: string,
    tagIds: string[]
  ): Promise<{ data: { tags: Tag[] } } | { error: string; message: string }> {
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
    });

    if (!test) {
      return { error: 'NOT_FOUND', message: 'Test not found' };
    }

    // Verify all tags exist and belong to project
    if (tagIds.length > 0) {
      const tags = await prisma.tag.findMany({
        where: { id: { in: tagIds }, projectId },
      });

      if (tags.length !== tagIds.length) {
        return { error: 'NOT_FOUND', message: 'One or more tags not found' };
      }
    }

    // Replace all tags in a transaction
    await prisma.$transaction(async (tx) => {
      // Remove all existing tags
      await tx.testTag.deleteMany({
        where: { testId },
      });

      // Add new tags
      if (tagIds.length > 0) {
        await tx.testTag.createMany({
          data: tagIds.map((tagId) => ({ testId, tagId })),
        });
      }
    });

    // Return updated tags
    const updatedTags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      include: {
        _count: { select: { tests: true } },
      },
    });

    return {
      data: {
        tags: updatedTags.map((tag) => ({
          id: tag.id,
          projectId: tag.projectId,
          name: tag.name,
          color: tag.color,
          testCount: tag._count.tests,
          createdAt: tag.createdAt.toISOString(),
        })),
      },
    };
  },
};
