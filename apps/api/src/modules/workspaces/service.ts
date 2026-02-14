import type { PrismaClient } from '@opencase/db';

export const workspaceService = {
  async getUserWorkspaces(prisma: PrismaClient, userId: string) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: { projects: true },
            },
          },
        },
      },
      orderBy: {
        workspace: { name: 'asc' },
      },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      projectCount: m.workspace._count.projects,
      createdAt: m.workspace.createdAt,
    }));
  },

  async getWorkspace(prisma: PrismaClient, workspaceId: string, userId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      return null;
    }

    return {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
      createdAt: membership.workspace.createdAt,
    };
  },

  async listMembers(prisma: PrismaClient, workspaceId: string, userId: string) {
    // Verify caller is a member
    const callerMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!callerMembership) return null;

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      user: m.user,
    }));
  },
};
