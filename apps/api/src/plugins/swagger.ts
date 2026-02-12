import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

const swaggerPluginImpl: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'OpenCase API',
        description: 'Open source test case management API',
        version: '0.1.0',
        contact: {
          name: 'OpenCase',
          url: 'https://github.com/yourorg/opencase',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'token',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Workspaces', description: 'Workspace management' },
        { name: 'Projects', description: 'Project management' },
        { name: 'Suites', description: 'Test suite management' },
        { name: 'Tests', description: 'Test case management' },
        { name: 'Runs', description: 'Test run management' },
        { name: 'Tags', description: 'Tag management' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
  });

  // Endpoint to get raw OpenAPI spec
  fastify.get('/api/openapi.json', async () => {
    return fastify.swagger();
  });
};

export const swaggerPlugin = fp(swaggerPluginImpl, {
  name: 'swagger',
});
