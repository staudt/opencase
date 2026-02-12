import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authService } from './service.js';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const result = await authService.register(fastify.prisma, {
      email: body.email,
      password: body.password,
      name: body.name,
    });

    return reply.status(201).send({
      data: result,
    });
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const result = await authService.login(fastify.prisma, {
      email: body.email,
      password: body.password,
    });

    return reply.send({
      data: result,
    });
  });

  // Logout
  fastify.post('/logout', async (request, reply) => {
    if (!request.session) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      });
    }

    await authService.logout(fastify.prisma, request.session.token);

    return reply.send({
      data: { success: true },
    });
  });

  // Get current user
  fastify.get('/me', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      });
    }

    return reply.send({
      data: {
        user: request.user,
      },
    });
  });
};
