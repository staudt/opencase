import { FastifyPluginAsync } from 'fastify';
import {
  runService,
  createRunSchema,
  updateRunSchema,
  updateRunItemSchema,
  listRunsSchema,
  listWorkspaceRunsSchema,
  recordResultSchema,
} from './service.js';

/**
 * Project-level run routes: /api/projects/:projectId/runs
 */
export const runRoutes: FastifyPluginAsync = async (fastify) => {
  // List runs for a project
  fastify.get<{
    Params: { projectId: string };
    Querystring: { status?: string; cursor?: string; limit?: string };
  }>('/', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const options = listRunsSchema.parse(request.query);
    const result = await runService.listRuns(
      fastify.prisma,
      request.params.projectId,
      request.user.id,
      options
    );

    if (result === null) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    return reply.send(result);
  });

  // Create a new run
  fastify.post<{ Params: { projectId: string } }>('/', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = createRunSchema.parse(request.body);
    const result = await runService.createRun(
      fastify.prisma,
      request.params.projectId,
      request.user.id,
      body
    );

    if ('error' in result) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return reply.status(status).send({
        error: { code: result.error, message: result.message },
      });
    }

    return reply.status(201).send(result);
  });

  // Get a single run with items
  fastify.get<{ Params: { projectId: string; runId: string } }>(
    '/:runId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const run = await runService.getRun(
        fastify.prisma,
        request.params.projectId,
        request.params.runId,
        request.user.id
      );

      if (!run) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Run not found' },
        });
      }

      return reply.send({ data: run });
    }
  );

  // Update a run
  fastify.patch<{ Params: { projectId: string; runId: string } }>(
    '/:runId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = updateRunSchema.parse(request.body);
      const result = await runService.updateRun(
        fastify.prisma,
        request.params.projectId,
        request.params.runId,
        request.user.id,
        body
      );

      if ('error' in result) {
        const status = result.error === 'NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.send(result);
    }
  );

  // Delete a run
  fastify.delete<{ Params: { projectId: string; runId: string } }>(
    '/:runId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await runService.deleteRun(
        fastify.prisma,
        request.params.projectId,
        request.params.runId,
        request.user.id
      );

      if ('error' in result) {
        return reply.status(404).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.send(result);
    }
  );

  // Record result on a run item
  fastify.put<{ Params: { projectId: string; runId: string; runItemId: string } }>(
    '/:runId/items/:runItemId/result',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = recordResultSchema.parse(request.body);
      const result = await runService.recordResult(
        fastify.prisma,
        request.params.projectId,
        request.params.runId,
        request.params.runItemId,
        request.user.id,
        body
      );

      if ('error' in result) {
        const status = result.error === 'NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.send(result);
    }
  );

  // Clear result on a run item
  fastify.delete<{ Params: { projectId: string; runId: string; runItemId: string } }>(
    '/:runId/items/:runItemId/result',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await runService.clearResult(
        fastify.prisma,
        request.params.projectId,
        request.params.runId,
        request.params.runItemId,
        request.user.id
      );

      if ('error' in result) {
        const status = result.error === 'NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.send(result);
    }
  );

  // Update a run item (assignment)
  fastify.patch<{ Params: { projectId: string; runId: string; runItemId: string } }>(
    '/:runId/items/:runItemId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = updateRunItemSchema.parse(request.body);
      const result = await runService.updateRunItem(
        fastify.prisma,
        request.params.projectId,
        request.params.runId,
        request.params.runItemId,
        request.user.id,
        body
      );

      if ('error' in result) {
        const status = result.error === 'NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.send(result);
    }
  );
};

/**
 * Workspace-level run routes: /api/workspaces/:workspaceId/runs
 */
export const workspaceRunRoutes: FastifyPluginAsync = async (fastify) => {
  // List runs across workspace
  fastify.get<{
    Params: { workspaceId: string };
    Querystring: { status?: string; projectId?: string; cursor?: string; limit?: string };
  }>('/', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const options = listWorkspaceRunsSchema.parse(request.query);
    const result = await runService.listWorkspaceRuns(
      fastify.prisma,
      request.params.workspaceId,
      request.user.id,
      options
    );

    if (result === null) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
    }

    return reply.send(result);
  });
};
