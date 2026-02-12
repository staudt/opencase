import { FastifyPluginAsync } from 'fastify';
import { createProjectSchema, projectService } from './service.js';

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // List projects in a workspace
  fastify.get<{ Params: { workspaceId: string } }>(
    '/',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const workspaceId = request.params.workspaceId;
      const projects = await projectService.getWorkspaceProjects(
        fastify.prisma,
        workspaceId,
        request.user.id
      );

      if (projects === null) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Workspace not found' },
        });
      }

      return reply.send({ data: projects });
    }
  );

  // Get single project
  fastify.get<{ Params: { workspaceId: string; projectId: string } }>(
    '/:projectId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const project = await projectService.getProject(
        fastify.prisma,
        request.params.projectId,
        request.user.id
      );

      if (!project) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      return reply.send({ data: project });
    }
  );

  // Create project
  fastify.post<{ Params: { workspaceId: string } }>(
    '/',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = createProjectSchema.parse(request.body);
      const result = await projectService.createProject(
        fastify.prisma,
        request.params.workspaceId,
        request.user.id,
        body
      );

      if ('error' in result) {
        const status = result.error === 'CONFLICT' ? 409 : 404;
        return reply.status(status).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.status(201).send(result);
    }
  );
};
