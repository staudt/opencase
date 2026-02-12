import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { Session } from '@opencase/db';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
    session: Session | null;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPluginImpl: FastifyPluginAsync = async (fastify) => {
  // Add user and session to request
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('session', null);

  // Authentication hook
  fastify.addHook('onRequest', async (request) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return;
    }

    const token = authHeader.slice(7);
    if (!token) {
      return;
    }

    try {
      const session = await fastify.prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!session || session.expiresAt < new Date()) {
        return;
      }

      request.session = session;
      request.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        avatarUrl: session.user.avatarUrl,
      };
    } catch {
      // Ignore auth errors, user remains null
    }
  });

  // Authentication decorator for protected routes
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }
  });
};

export const authPlugin = fp(authPluginImpl, {
  name: 'auth',
  dependencies: ['prisma'],
});
