import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { prisma, PrismaClient } from '@opencase/db';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export const prismaPlugin = fp(prismaPluginImpl, {
  name: 'prisma',
});
