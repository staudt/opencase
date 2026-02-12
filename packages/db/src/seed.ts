import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Use bcrypt for password hashing (same as auth service)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

function generateLexoRank(index: number): string {
  // Simple lexorank generation for seed data
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const base = chars.length;
  let result = '';
  let n = index;

  do {
    result = chars[n % base] + result;
    n = Math.floor(n / base);
  } while (n > 0);

  return result.padStart(3, 'a');
}

function contentHash(content: object): string {
  const serialized = JSON.stringify(content, Object.keys(content).sort());
  return createHash('sha256').update(serialized).digest('hex');
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.result.deleteMany();
  await prisma.runItem.deleteMany();
  await prisma.run.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.testTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.testVersion.deleteMany();
  await prisma.test.deleteMany();
  await prisma.suiteItem.deleteMany();
  await prisma.suiteNode.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Create demo user
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@opencase.dev',
      passwordHash: await hashPassword('demo1234'),
      name: 'Demo User',
    },
  });
  console.log('✅ Created demo user:', demoUser.email);

  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Demo Workspace',
      slug: 'demo',
      members: {
        create: {
          userId: demoUser.id,
          role: 'owner',
        },
      },
    },
  });
  console.log('✅ Created workspace:', workspace.name);

  // Create project
  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: 'Sample Project',
      slug: 'sample-project',
      description: 'A sample project with demo test cases',
      testCounter: 5, // We'll create 5 tests
    },
  });
  console.log('✅ Created project:', project.name);

  // Create tags
  const tags = await Promise.all([
    prisma.tag.create({
      data: { projectId: project.id, name: 'smoke', color: '#ef4444' },
    }),
    prisma.tag.create({
      data: { projectId: project.id, name: 'regression', color: '#3b82f6' },
    }),
    prisma.tag.create({
      data: { projectId: project.id, name: 'critical', color: '#f59e0b' },
    }),
  ]);
  console.log('✅ Created', tags.length, 'tags');

  // Create suite tree
  const authSuite = await prisma.suiteNode.create({
    data: {
      projectId: project.id,
      name: 'Authentication',
      orderKey: generateLexoRank(0),
    },
  });

  const loginSuite = await prisma.suiteNode.create({
    data: {
      projectId: project.id,
      parentId: authSuite.id,
      name: 'Login',
      orderKey: generateLexoRank(0),
    },
  });

  const registrationSuite = await prisma.suiteNode.create({
    data: {
      projectId: project.id,
      parentId: authSuite.id,
      name: 'Registration',
      orderKey: generateLexoRank(1),
    },
  });

  const dashboardSuite = await prisma.suiteNode.create({
    data: {
      projectId: project.id,
      name: 'Dashboard',
      orderKey: generateLexoRank(1),
    },
  });

  console.log('✅ Created suite tree');

  // Create tests with versions
  const testData = [
    {
      code: 'TC-1',
      title: 'User can login with valid credentials',
      suiteId: loginSuite.id,
      tags: ['smoke', 'critical'],
      content: {
        blocks: [
          { id: 'step-1', type: 'step', content: 'Navigate to login page' },
          { id: 'exp-1', type: 'expected', content: 'Login form is displayed' },
          { id: 'step-2', type: 'step', content: 'Enter valid email and password' },
          { id: 'step-3', type: 'step', content: 'Click login button' },
          { id: 'exp-2', type: 'expected', content: 'User is redirected to dashboard' },
        ],
      },
    },
    {
      code: 'TC-2',
      title: 'User sees error with invalid credentials',
      suiteId: loginSuite.id,
      tags: ['regression'],
      content: {
        blocks: [
          { id: 'step-1', type: 'step', content: 'Navigate to login page' },
          { id: 'step-2', type: 'step', content: 'Enter invalid email or password' },
          { id: 'step-3', type: 'step', content: 'Click login button' },
          { id: 'exp-1', type: 'expected', content: 'Error message is displayed' },
          { id: 'note-1', type: 'note', content: 'Check that password is not revealed in error' },
        ],
      },
    },
    {
      code: 'TC-3',
      title: 'User can register with valid information',
      suiteId: registrationSuite.id,
      tags: ['smoke'],
      content: {
        blocks: [
          { id: 'step-1', type: 'step', content: 'Navigate to registration page' },
          { id: 'step-2', type: 'step', content: 'Fill in all required fields' },
          { id: 'step-3', type: 'step', content: 'Accept terms and conditions' },
          { id: 'step-4', type: 'step', content: 'Click register button' },
          { id: 'exp-1', type: 'expected', content: 'Account is created and user is logged in' },
        ],
      },
    },
    {
      code: 'TC-4',
      title: 'Dashboard displays user statistics',
      suiteId: dashboardSuite.id,
      tags: ['regression'],
      content: {
        blocks: [
          { id: 'pre-1', type: 'precondition', content: 'User is logged in' },
          { id: 'step-1', type: 'step', content: 'Navigate to dashboard' },
          { id: 'exp-1', type: 'expected', content: 'Dashboard page loads' },
          { id: 'exp-2', type: 'expected', content: 'User statistics are displayed' },
        ],
      },
    },
    {
      code: 'TC-5',
      title: 'User can logout from dashboard',
      suiteId: dashboardSuite.id,
      tags: ['smoke', 'critical'],
      content: {
        blocks: [
          { id: 'pre-1', type: 'precondition', content: 'User is logged in' },
          { id: 'step-1', type: 'step', content: 'Click user menu' },
          { id: 'step-2', type: 'step', content: 'Click logout button' },
          { id: 'exp-1', type: 'expected', content: 'User is logged out and redirected to login page' },
        ],
      },
    },
  ];

  for (let i = 0; i < testData.length; i++) {
    const td = testData[i];

    // Create test version first
    const testVersion = await prisma.testVersion.create({
      data: {
        version: 1,
        title: td.title,
        content: td.content,
        contentHash: contentHash(td.content),
        source: 'import',
        createdBy: { connect: { id: demoUser.id } },
        test: {
          create: {
            projectId: project.id,
            code: td.code,
          },
        },
      },
      include: { test: true },
    });

    // Update test to point to current version
    await prisma.test.update({
      where: { id: testVersion.test.id },
      data: { currentVersionId: testVersion.id },
    });

    // Add to suite
    await prisma.suiteItem.create({
      data: {
        suiteNodeId: td.suiteId,
        testId: testVersion.test.id,
        orderKey: generateLexoRank(i),
      },
    });

    // Add tags
    for (const tagName of td.tags) {
      const tag = tags.find((t) => t.name === tagName);
      if (tag) {
        await prisma.testTag.create({
          data: {
            testId: testVersion.test.id,
            tagId: tag.id,
          },
        });
      }
    }
  }

  console.log('✅ Created', testData.length, 'tests with versions');

  // Create a sample run
  const run = await prisma.run.create({
    data: {
      project: { connect: { id: project.id } },
      title: 'Smoke Test Run - Demo',
      description: 'Sample test run for demonstration',
      status: 'active',
      createdBy: { connect: { id: demoUser.id } },
    },
  });

  // Add some tests to the run
  const smokeTests = await prisma.test.findMany({
    where: {
      projectId: project.id,
      tags: { some: { tag: { name: 'smoke' } } },
    },
    include: { currentVersion: true },
  });

  for (let i = 0; i < smokeTests.length; i++) {
    const test = smokeTests[i];
    if (test.currentVersion) {
      await prisma.runItem.create({
        data: {
          runId: run.id,
          testVersionId: test.currentVersion.id,
          orderIndex: i,
        },
      });
    }
  }

  console.log('✅ Created sample run with', smokeTests.length, 'tests');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\nDemo credentials:');
  console.log('  Email: demo@opencase.dev');
  console.log('  Password: demo1234');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
