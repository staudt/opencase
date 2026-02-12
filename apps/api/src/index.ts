import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';

import { config } from './config.js';
import { prismaPlugin } from './plugins/prisma.js';
import { authPlugin } from './plugins/auth.js';
import { errorHandler } from './plugins/error-handler.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { workspaceRoutes } from './modules/workspaces/routes.js';
import { projectRoutes } from './modules/projects/routes.js';
import { suiteRoutes } from './modules/suites/routes.js';
import { testRoutes } from './modules/tests/routes.js';
import { tagRoutes } from './modules/tags/routes.js';
import { exportRoutes } from './modules/export/routes.js';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'info' : 'warn',
      transport:
        config.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(cookie);
  await app.register(formbody);

  // Custom plugins
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(errorHandler);
  await app.register(swaggerPlugin);

  // Routes
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(workspaceRoutes, { prefix: '/api/workspaces' });
  await app.register(projectRoutes, { prefix: '/api/workspaces/:workspaceId/projects' });
  await app.register(suiteRoutes, { prefix: '/api/projects/:projectId/suites' });
  await app.register(testRoutes, { prefix: '/api/projects/:projectId/tests' });
  await app.register(tagRoutes, { prefix: '/api/projects/:projectId/tags' });
  await app.register(exportRoutes, { prefix: '/api/projects/:projectId' });

  return app;
}

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`
    🚀 OpenCase API Server

    Environment: ${config.NODE_ENV}
    Port: ${config.PORT}

    Health: http://localhost:${config.PORT}/api/health
    Docs: http://localhost:${config.PORT}/docs
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
