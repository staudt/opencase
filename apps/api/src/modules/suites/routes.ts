import { FastifyPluginAsync } from 'fastify';
import {
  suiteService,
  createSuiteSchema,
  updateSuiteSchema,
  moveSuiteSchema,
} from './service.js';

export const suiteRoutes: FastifyPluginAsync = async (fastify) => {
  // List suites as tree
  fastify.get<{ Params: { projectId: string } }>(
    '/',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const tree = await suiteService.getSuiteTree(
        fastify.prisma,
        request.params.projectId,
        request.user.id
      );

      if (tree === null) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      return reply.send({ data: tree });
    }
  );

  // Get single suite
  fastify.get<{ Params: { projectId: string; suiteId: string } }>(
    '/:suiteId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const suite = await suiteService.getSuite(
        fastify.prisma,
        request.params.projectId,
        request.params.suiteId,
        request.user.id
      );

      if (!suite) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Suite not found' },
        });
      }

      return reply.send({ data: suite });
    }
  );

  // Create suite
  fastify.post<{ Params: { projectId: string } }>(
    '/',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = createSuiteSchema.parse(request.body);
      const result = await suiteService.createSuite(
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
    }
  );

  // Update suite (rename)
  fastify.patch<{ Params: { projectId: string; suiteId: string } }>(
    '/:suiteId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = updateSuiteSchema.parse(request.body);
      const result = await suiteService.updateSuite(
        fastify.prisma,
        request.params.projectId,
        request.params.suiteId,
        request.user.id,
        body
      );

      if ('error' in result) {
        return reply.status(404).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.send(result);
    }
  );

  // Move suite (reorder/reparent)
  fastify.post<{ Params: { projectId: string; suiteId: string } }>(
    '/:suiteId/move',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = moveSuiteSchema.parse(request.body);
      const result = await suiteService.moveSuite(
        fastify.prisma,
        request.params.projectId,
        request.params.suiteId,
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

  // Delete suite
  fastify.delete<{ Params: { projectId: string; suiteId: string } }>(
    '/:suiteId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await suiteService.deleteSuite(
        fastify.prisma,
        request.params.projectId,
        request.params.suiteId,
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
};
