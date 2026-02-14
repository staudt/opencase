import { FastifyPluginAsync } from 'fastify';
import { attachmentService } from './service.js';

/**
 * Project-scoped attachment routes: /api/projects/:projectId/attachments
 */
export const attachmentRoutes: FastifyPluginAsync = async (fastify) => {
  // Upload a file
  fastify.post<{ Params: { projectId: string } }>(
    '/',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: 'No file provided' },
        });
      }

      const result = await attachmentService.upload(
        fastify.prisma,
        request.params.projectId,
        request.user.id,
        {
          filename: file.filename,
          mimetype: file.mimetype,
          file: file.file,
        }
      );

      if ('error' in result) {
        const status =
          result.error === 'NOT_FOUND' ? 404 :
          result.error === 'FORBIDDEN' ? 403 : 400;
        return reply.status(status).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.status(201).send(result);
    }
  );

  // Delete an attachment
  fastify.delete<{ Params: { projectId: string; attachmentId: string } }>(
    '/:attachmentId',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await attachmentService.delete(
        fastify.prisma,
        request.params.attachmentId,
        request.user.id
      );

      if ('error' in result) {
        const status =
          result.error === 'NOT_FOUND' ? 404 :
          result.error === 'FORBIDDEN' ? 403 : 400;
        return reply.status(status).send({
          error: { code: result.error, message: result.message },
        });
      }

      return reply.send(result);
    }
  );
};

/**
 * Global attachment download routes: /api/attachments
 */
export const attachmentDownloadRoutes: FastifyPluginAsync = async (fastify) => {
  // Download a file
  fastify.get<{ Params: { attachmentId: string } }>(
    '/:attachmentId/download',
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await attachmentService.download(
        fastify.prisma,
        request.params.attachmentId,
        request.user.id
      );

      if ('error' in result) {
        return reply.status(404).send({
          error: { code: result.error, message: result.message },
        });
      }

      const { stream, contentType, filename, size } = result.data;
      reply.header('Content-Type', contentType);
      reply.header('Content-Disposition', `inline; filename="${filename}"`);
      reply.header('Content-Length', size);
      return reply.send(stream);
    }
  );
};
