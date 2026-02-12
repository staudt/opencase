import type { PrismaClient } from '@opencase/db';
import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const projectService = {
  async getWorkspaceProjects(
    prisma: PrismaClient,
    workspaceId: string,
    userId: string
  ) {
    // First verify user has access to workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!membership) {
      return null;
    }

    const projects = await prisma.project.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { tests: true, runs: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      testCount: p._count.tests,
      runCount: p._count.runs,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  },

  async getProject(
    prisma: PrismaClient,
    projectId: string,
    userId: string
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
        _count: {
          select: { tests: true, runs: true, suiteNodes: true, tags: true },
        },
      },
    });

    if (!project || project.workspace.members.length === 0) {
      return null;
    }

    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      slug: project.slug,
      description: project.description,
      testCount: project._count.tests,
      runCount: project._count.runs,
      suiteCount: project._count.suiteNodes,
      tagCount: project._count.tags,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  },

  async createProject(
    prisma: PrismaClient,
    workspaceId: string,
    userId: string,
    input: CreateProjectInput
  ) {
    // Verify membership
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!membership) {
      return { error: 'NOT_FOUND', message: 'Workspace not found' };
    }

    // Check for duplicate slug
    const existing = await prisma.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: input.slug } },
    });

    if (existing) {
      return { error: 'CONFLICT', message: 'A project with this slug already exists' };
    }

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        slug: input.slug,
        description: input.description,
      },
    });

    return {
      data: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        createdAt: project.createdAt,
      },
    };
  },
};
