import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  tagService,
  createTagSchema,
  updateTagSchema,
} from './service.js';

export const tagRoutes: FastifyPluginAsync = async (fastify) => {
  // List all tags for a project
  fastify.get<{ Params: { projectId: string } }>('/', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const tags = await tagService.listTags(
      fastify.prisma,
      request.params.projectId,
      request.user.id
    );

    if (tags === null) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    return reply.send({ data: tags });
  });

  // Get single tag
  fastify.get<{ Params: { projectId: string; tagId: string } }>(
    '/:tagId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const tag = await tagService.getTag(
        fastify.prisma,
        request.params.projectId,
        request.params.tagId,
        request.user.id
      );

      if (!tag) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Tag not found' },
        });
      }

      return reply.send({ data: tag });
    }
  );

  // Create tag
  fastify.post<{ Params: { projectId: string } }>('/', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const body = createTagSchema.parse(request.body);
    const result = await tagService.createTag(
      fastify.prisma,
      request.params.projectId,
      request.user.id,
      body
    );

    if ('error' in result) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'CONFLICT' ? 409 : 400;
      return reply.status(status).send({
        error: { code: result.error, message: result.message },
      });
    }

    return reply.status(201).send(result);
  });

  // Update tag
  fastify.patch<{ Params: { projectId: string; tagId: string } }>(
    '/:tagId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = updateTagSchema.parse(request.body);
      const result = await tagService.updateTag(
        fastify.prisma,
        request.params.projectId,
        request.params.tagId,
        request.user.id,
        body
      );

      if ('error' in result) {
        const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'CONFLICT' ? 409 : 400;
        return reply.status(status).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.send(result);
    }
  );

  // Delete tag
  fastify.delete<{ Params: { projectId: string; tagId: string } }>(
    '/:tagId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await tagService.deleteTag(
        fastify.prisma,
        request.params.projectId,
        request.params.tagId,
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

  // Set tags for a test (replace all)
  fastify.put<{ Params: { projectId: string; testId: string } }>(
    '/test/:testId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const body = z.object({ tagIds: z.array(z.string()) }).parse(request.body);
      const result = await tagService.setTestTags(
        fastify.prisma,
        request.params.projectId,
        request.params.testId,
        request.user.id,
        body.tagIds
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
