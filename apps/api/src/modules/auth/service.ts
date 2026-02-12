import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { PrismaClient } from '@opencase/db';
import { badRequest, unauthorized } from '../../plugins/error-handler.js';
import { SESSION_DURATION_HOURS } from '@opencase/shared';

const SALT_ROUNDS = 12;

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
  session: {
    token: string;
    expiresAt: string;
  };
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function getSessionExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + SESSION_DURATION_HOURS);
  return expiry;
}

export const authService = {
  async register(prisma: PrismaClient, input: RegisterInput): Promise<AuthResult> {
    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw badRequest('Email already registered', 'EMAIL_EXISTS');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
      },
    });

    // Create session
    const token = generateToken();
    const expiresAt = getSessionExpiry();

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Create default workspace for new user
    const workspaceSlug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'my-workspace';

    await prisma.workspace.create({
      data: {
        name: `${input.name}'s Workspace`,
        slug: `${workspaceSlug}-${user.id.slice(-6)}`,
        members: {
          create: {
            userId: user.id,
            role: 'owner',
          },
        },
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      session: {
        token,
        expiresAt: expiresAt.toISOString(),
      },
    };
  },

  async login(prisma: PrismaClient, input: LoginInput): Promise<AuthResult> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      throw unauthorized('Invalid email or password');
    }

    // Verify password
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw unauthorized('Invalid email or password');
    }

    // Create session
    const token = generateToken();
    const expiresAt = getSessionExpiry();

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      session: {
        token,
        expiresAt: expiresAt.toISOString(),
      },
    };
  },

  async logout(prisma: PrismaClient, token: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { token },
    });
  },

  async cleanExpiredSessions(prisma: PrismaClient): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  },
};
