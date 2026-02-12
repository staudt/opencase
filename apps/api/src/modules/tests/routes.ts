import { FastifyPluginAsync } from 'fastify';
import {
  testService,
  createTestSchema,
  updateTestSchema,
  listTestsSchema,
  bulkCreateTestsSchema,
  bulkUpdateTestsSchema,
  bulkDeleteTestsSchema,
} from './service.js';

export const testRoutes: FastifyPluginAsync = async (fastify) => {
  // List tests with optional filters
  fastify.get<{
    Params: { projectId: string };
    Querystring: { suiteId?: string; search?: string; cursor?: string; limit?: string };
  }>('/', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const options = listTestsSchema.parse(request.query);
    const result = await testService.listTests(
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

  // Get single test
  fastify.get<{ Params: { projectId: string; testId: string } }>(
    '/:testId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const test = await testService.getTest(
        fastify.prisma,
        request.params.projectId,
        request.params.testId,
        request.user.id
      );

      if (!test) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test not found' },
        });
      }

      return reply.send({ data: test });
    }
  );

  // Create test
  fastify.post<{ Params: { projectId: string } }>('/', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = createTestSchema.parse(request.body);
    const result = await testService.createTest(
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

  // Get version history
  fastify.get<{ Params: { projectId: string; testId: string } }>(
    '/:testId/versions',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const versions = await testService.getVersions(
        fastify.prisma,
        request.params.projectId,
        request.params.testId,
        request.user.id
      );

      if (versions === null) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test not found' },
        });
      }

      return reply.send({ data: versions });
    }
  );

  // Get diff between two versions
  fastify.get<{
    Params: { projectId: string; testId: string };
    Querystring: { v1: string; v2: string };
  }>(
    '/:testId/diff',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const v1 = parseInt(request.query.v1, 10);
      const v2 = parseInt(request.query.v2, 10);

      if (isNaN(v1) || isNaN(v2)) {
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: 'v1 and v2 query parameters must be valid version numbers' },
        });
      }

      const result = await testService.diffVersions(
        fastify.prisma,
        request.params.projectId,
        request.params.testId,
        request.user.id,
        v1,
        v2
      );

      if (result === null) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test not found' },
        });
      }

      if ('error' in result) {
        const status = result.error === 'NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.send({ data: result });
    }
  );

  // Update test (creates new version)
  fastify.patch<{ Params: { projectId: string; testId: string } }>(
    '/:testId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = updateTestSchema.parse(request.body);
      const result = await testService.updateTest(
        fastify.prisma,
        request.params.projectId,
        request.params.testId,
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

  // Delete single test
  fastify.delete<{ Params: { projectId: string; testId: string } }>(
    '/:testId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await testService.deleteTest(
        fastify.prisma,
        request.params.projectId,
        request.params.testId,
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

  // Bulk create tests
  fastify.post<{ Params: { projectId: string } }>('/bulk', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = bulkCreateTestsSchema.parse(request.body);
    const result = await testService.bulkCreateTests(
      fastify.prisma,
      request.params.projectId,
      request.user.id,
      body.tests
    );

    if ('error' in result) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return reply.status(status).send({
        error: { code: result.error, message: result.message },
      });
    }

    return reply.send(result);
  });

  // Bulk update tests
  fastify.patch<{ Params: { projectId: string } }>('/bulk', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = bulkUpdateTestsSchema.parse(request.body);
    const result = await testService.bulkUpdateTests(
      fastify.prisma,
      request.params.projectId,
      request.user.id,
      body.tests
    );

    if ('error' in result) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return reply.status(status).send({
        error: { code: result.error, message: result.message },
      });
    }

    return reply.send(result);
  });

  // Bulk delete tests
  fastify.delete<{ Params: { projectId: string } }>('/bulk', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = bulkDeleteTestsSchema.parse(request.body);
    const result = await testService.bulkDeleteTests(
      fastify.prisma,
      request.params.projectId,
      request.user.id,
      body.ids
    );

    if ('error' in result) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400;
      return reply.status(status).send({
        error: { code: result.error, message: result.message },
      });
    }

    return reply.send(result);
  });
};
