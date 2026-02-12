import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function badRequest(message: string, code = 'BAD_REQUEST') {
  return new ApiError(400, code, message);
}

export function unauthorized(message = 'Authentication required') {
  return new ApiError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'Access denied') {
  return new ApiError(403, 'FORBIDDEN', message);
}

export function notFound(resource = 'Resource') {
  return new ApiError(404, 'NOT_FOUND', `${resource} not found`);
}

export function conflict(message: string) {
  return new ApiError(409, 'CONFLICT', message);
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    // Handle API errors
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
      });
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.flatten(),
        },
      });
    }

    // Handle Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }

    // Log unexpected errors
    request.log.error(error);

    // Generic error response
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'development'
            ? error.message
            : 'An unexpected error occurred',
      },
    });
  });
};

export const errorHandler = fp(errorHandlerPlugin, {
  name: 'error-handler',
});
