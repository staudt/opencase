import { FastifyPluginAsync } from 'fastify';
import { workspaceService } from './service.js';

export const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  // List user's workspaces
  fastify.get('/', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const workspaces = await workspaceService.getUserWorkspaces(
      fastify.prisma,
      request.user.id
    );

    return reply.send({ data: workspaces });
  });

  // Get single workspace
  fastify.get<{ Params: { workspaceId: string } }>(
    '/:workspaceId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const workspace = await workspaceService.getWorkspace(
        fastify.prisma,
        request.params.workspaceId,
        request.user.id
      );

      if (!workspace) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Workspace not found' },
        });
      }

      return reply.send({ data: workspace });
    }
  );

  // List workspace members
  fastify.get<{ Params: { workspaceId: string } }>(
    '/:workspaceId/members',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const members = await workspaceService.listMembers(
        fastify.prisma,
        request.params.workspaceId,
        request.user.id
      );

      if (!members) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Workspace not found' },
        });
      }

      return reply.send({ data: members });
    }
  );
};
