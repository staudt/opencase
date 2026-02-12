import type { FastifyPluginAsync } from 'fastify';
import { exportService, importService } from './service.js';
import { importRequestSchema } from './validation.js';

export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/projects/:projectId/export
   * Export project data as JSON
   */
  fastify.get<{
    Params: { projectId: string };
    Querystring: { includeHistory?: string };
  }>('/export', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const includeHistory = request.query.includeHistory === 'true';

    const result = await exportService.exportProject(
      fastify.prisma,
      request.params.projectId,
      request.user.id,
      { includeHistory }
    );

    if (result === null) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    if ('error' in result) {
      return reply.status(400).send({
        error: { code: result.error, message: result.message },
      });
    }

    // Set download headers
    const slug = result.project.slug;
    const date = new Date().toISOString().split('T')[0];
    const filename = `${slug}-${date}.json`;

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);

    return reply.send(result);
  });

  /**
   * POST /api/projects/:projectId/import
   * Import data into project
   */
  fastify.post<{
    Params: { projectId: string };
  }>('/import', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    // Parse and validate request body
    const parseResult = importRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid import request',
          details: parseResult.error.flatten(),
        },
      });
    }

    const { data, options } = parseResult.data;

    const result = await importService.importProject(
      fastify.prisma,
      request.params.projectId,
      request.user.id,
      data,
      options
    );

    if ('error' in result) {
      const statusCode =
        result.error === 'NOT_FOUND' ? 404 :
        result.error === 'VALIDATION_ERROR' ? 400 :
        result.error === 'SCHEMA_VERSION_MISMATCH' ? 400 :
        400;

      return reply.status(statusCode).send({
        error: {
          code: result.error,
          message: result.message,
          ...('details' in result ? { details: (result as { details: unknown }).details } : {}),
        },
      });
    }

    return reply.send({ data: result });
  });

  /**
   * POST /api/projects/:projectId/import/preview
   * Preview import without applying changes (convenience endpoint)
   */
  fastify.post<{
    Params: { projectId: string };
  }>('/import/preview', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    // Parse and validate request body
    const parseResult = importRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid import request',
          details: parseResult.error.flatten(),
        },
      });
    }

    const { data, options } = parseResult.data;

    // Force dry run mode
    const result = await importService.importProject(
      fastify.prisma,
      request.params.projectId,
      request.user.id,
      data,
      { ...options, dryRun: true }
    );

    if ('error' in result) {
      const statusCode =
        result.error === 'NOT_FOUND' ? 404 :
        result.error === 'VALIDATION_ERROR' ? 400 :
        400;

      return reply.status(statusCode).send({
        error: {
          code: result.error,
          message: result.message,
          ...('details' in result ? { details: (result as { details: unknown }).details } : {}),
        },
      });
    }

    return reply.send({ data: result });
  });
};
