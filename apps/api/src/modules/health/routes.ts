import { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    // Check database connection
    let dbStatus = 'ok';
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    const health = {
      status: dbStatus === 'ok' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      checks: {
        database: dbStatus,
      },
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    return reply.status(statusCode).send(health);
  });

  fastify.get('/health/ready', async (_request, reply) => {
    // Readiness check - can the service handle requests?
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      return reply.send({ ready: true });
    } catch {
      return reply.status(503).send({ ready: false });
    }
  });

  fastify.get('/health/live', async () => {
    // Liveness check - is the process running?
    return { alive: true };
  });
};
