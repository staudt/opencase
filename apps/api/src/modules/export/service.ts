import type { PrismaClient } from '@opencase/db';
import {
  hashContent,
  generateLexoRank,
  EXPORT_SCHEMA_VERSION,
} from '@opencase/shared';
import type {
  ExportSchema,
  ExportTest,
  ExportSuiteNode,
  ExportTag,
  ImportOptions,
  ImportResult,
  ImportPreview,
  EntityImportSummary,
  EntityPreview,
  TestContent,
} from '@opencase/shared';
import { validateImportData, type ExportSchemaInput } from './validation.js';

// ============ Export Service ============

export const exportService = {
  /**
   * Export project data to ExportSchema format
   */
  async exportProject(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    _options: { includeHistory?: boolean } = {}
  ): Promise<ExportSchema | null | { error: string; message: string }> {
    // Verify access to project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: {
            members: { where: { userId } },
          },
        },
      },
    });

    if (!project || project.workspace.members.length === 0) {
      return null;
    }

    // Fetch all suites ordered by orderKey
    const suites = await prisma.suiteNode.findMany({
      where: { projectId },
      orderBy: { orderKey: 'asc' },
      include: {
        items: {
          orderBy: { orderKey: 'asc' },
          select: { testId: true },
        },
      },
    });

    // Fetch all tests with current version and tags
    const tests = await prisma.test.findMany({
      where: { projectId },
      orderBy: { code: 'asc' },
      include: {
        currentVersion: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    // Fetch all tags
    const tags = await prisma.tag.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });

    // Transform suites to export format
    const exportSuites: ExportSuiteNode[] = suites.map((suite, index) => ({
      id: suite.id,
      parentId: suite.parentId,
      name: suite.name,
      order: index,
      testIds: suite.items.map((item) => item.testId),
    }));

    // Transform tests to export format
    const exportTests: ExportTest[] = tests
      .filter((test) => test.currentVersion)
      .map((test) => ({
        id: test.id,
        code: test.code,
        title: test.currentVersion!.title,
        content: test.currentVersion!.content as unknown as TestContent,
        tags: test.tags.map((tt) => tt.tag.name),
      }));

    // Transform tags to export format
    const exportTags: ExportTag[] = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    }));

    // Log export action
    await prisma.auditLog.create({
      data: {
        projectId,
        userId,
        action: 'project.exported',
        entityType: 'project',
        entityId: projectId,
        metadata: {
          testCount: exportTests.length,
          suiteCount: exportSuites.length,
          tagCount: exportTags.length,
        },
      },
    });

    return {
      version: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        slug: project.slug,
        description: project.description,
      },
      suites: exportSuites,
      tests: exportTests,
      tags: exportTags,
    };
  },
};

// ============ Import Service ============

export const importService = {
  /**
   * Import data into a project
   */
  async importProject(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    data: ExportSchemaInput,
    options: ImportOptions
  ): Promise<ImportResult | ImportPreview | { error: string; message: string }> {
    // Verify access to project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: {
            members: { where: { userId } },
          },
        },
      },
    });

    if (!project || project.workspace.members.length === 0) {
      return { error: 'NOT_FOUND', message: 'Project not found' };
    }

    // Validate schema version
    if (data.version !== EXPORT_SCHEMA_VERSION) {
      return {
        error: 'SCHEMA_VERSION_MISMATCH',
        message: `Unsupported export version "${data.version}". Expected "${EXPORT_SCHEMA_VERSION}"`,
      };
    }

    // Run structural validations
    const validation = validateImportData(data);
    if (!validation.valid) {
      return {
        error: 'VALIDATION_ERROR',
        message: 'Import data validation failed',
        ...({ details: { errors: validation.errors } } as object),
      } as { error: string; message: string };
    }

    // Fetch existing entities for conflict detection
    const existingTags = await prisma.tag.findMany({
      where: { projectId },
    });
    const existingSuites = await prisma.suiteNode.findMany({
      where: { projectId },
    });
    const existingTests = await prisma.test.findMany({
      where: { projectId },
    });

    const existingTagsByName = new Map(existingTags.map((t) => [t.name, t]));
    const existingTestsByCode = new Map(existingTests.map((t) => [t.code, t]));
    const existingSuitesByKey = new Map(
      existingSuites.map((s) => [`${s.parentId ?? 'root'}:${s.name}`, s])
    );

    // Analyze what would happen
    const preview = analyzeImport(
      data,
      existingTagsByName,
      existingTestsByCode,
      existingSuitesByKey,
      options
    );

    // If dry run, return preview
    if (options.dryRun) {
      return preview;
    }

    // Execute import in transaction
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // If replace mode, clear existing data
          if (options.mode === 'replace') {
            await tx.suiteItem.deleteMany({ where: { suiteNode: { projectId } } });
            await tx.testTag.deleteMany({ where: { test: { projectId } } });
            await tx.testVersion.deleteMany({ where: { test: { projectId } } });
            await tx.test.deleteMany({ where: { projectId } });
            await tx.suiteNode.deleteMany({ where: { projectId } });
            await tx.tag.deleteMany({ where: { projectId } });
          }

          // Import tags first (no dependencies)
          const tagMappings = await importTags(
            tx as PrismaClient,
            projectId,
            data.tags,
            options.mode === 'replace' ? new Map() : existingTagsByName,
            options.conflictResolution.tags
          );

          // Import suites in topological order
          const suiteMappings = await importSuites(
            tx as PrismaClient,
            projectId,
            data.suites,
            options.mode === 'replace' ? new Map() : existingSuitesByKey,
            options.conflictResolution.suites
          );

          // Import tests
          const testMappings = await importTests(
            tx as PrismaClient,
            projectId,
            userId,
            data.tests,
            tagMappings.nameToId,
            options.mode === 'replace' ? new Map() : existingTestsByCode,
            options.conflictResolution.tests
          );

          // Link tests to suites
          await linkTestsToSuites(
            tx as PrismaClient,
            data.suites,
            suiteMappings.exportIdToDbId,
            testMappings.exportIdToDbId
          );

          return {
            tags: tagMappings.summary,
            suites: suiteMappings.summary,
            tests: testMappings.summary,
            mappings: {
              tags: Object.fromEntries(tagMappings.exportIdToDbId),
              suites: Object.fromEntries(suiteMappings.exportIdToDbId),
              tests: Object.fromEntries(testMappings.exportIdToDbId),
            },
          };
        },
        { timeout: 60000 }
      );

      // Log import action
      await prisma.auditLog.create({
        data: {
          projectId,
          userId,
          action: 'project.imported',
          entityType: 'project',
          entityId: projectId,
          metadata: {
            testsCreated: result.tests.created,
            testsUpdated: result.tests.updated,
            testsSkipped: result.tests.skipped,
            suitesCreated: result.suites.created,
            tagsCreated: result.tags.created,
          },
        },
      });

      return {
        summary: {
          suites: result.suites,
          tests: result.tests,
          tags: result.tags,
        },
        mappings: result.mappings,
        warnings: [],
      };
    } catch (err) {
      return {
        error: 'IMPORT_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error during import',
      };
    }
  },
};

// ============ Helper Functions ============

function analyzeImport(
  data: ExportSchemaInput,
  existingTagsByName: Map<string, { id: string; name: string }>,
  existingTestsByCode: Map<string, { id: string; code: string }>,
  existingSuitesByKey: Map<string, { id: string; name: string; parentId: string | null }>,
  options: ImportOptions
): ImportPreview {
  const tagsPreview = analyzeEntityImport(
    data.tags,
    (tag) => tag.name,
    (name) => existingTagsByName.has(name),
    options.conflictResolution.tags
  );

  const testsPreview = analyzeEntityImport(
    data.tests,
    (test) => test.code,
    (code) => existingTestsByCode.has(code),
    options.conflictResolution.tests
  );

  // Build parent mapping for suites after potential imports
  const suiteParentMap = new Map<string, string | null>();
  for (const suite of data.suites) {
    suiteParentMap.set(suite.id, suite.parentId);
  }

  const suitesPreview = analyzeEntityImport(
    data.suites,
    (suite) => {
      // Resolve parent to existing or importing suite
      const parentId = suite.parentId;
      const parentDbId = parentId ? existingSuitesByKey.get(`root:${parentId}`)?.id : null;
      return `${parentDbId ?? parentId ?? 'root'}:${suite.name}`;
    },
    (key) => existingSuitesByKey.has(key),
    options.conflictResolution.suites
  );

  return {
    valid: true,
    preview: {
      tags: tagsPreview,
      tests: testsPreview,
      suites: suitesPreview,
    },
    errors: [],
    warnings: [],
  };
}

function analyzeEntityImport<T>(
  entities: T[],
  getKey: (entity: T) => string,
  existsCheck: (key: string) => boolean,
  conflictMode: 'skip' | 'overwrite' | 'create_new'
): EntityPreview {
  const toCreate: string[] = [];
  const toUpdate: string[] = [];
  const toSkip: string[] = [];
  const conflicts: string[] = [];

  for (const entity of entities) {
    const key = getKey(entity);
    const exists = existsCheck(key);

    if (!exists) {
      toCreate.push(key);
    } else {
      conflicts.push(key);
      switch (conflictMode) {
        case 'skip':
          toSkip.push(key);
          break;
        case 'overwrite':
          toUpdate.push(key);
          break;
        case 'create_new':
          toCreate.push(key);
          break;
      }
    }
  }

  return { toCreate, toUpdate, toSkip, conflicts };
}

async function importTags(
  prisma: PrismaClient,
  projectId: string,
  tags: ExportTag[],
  existingByName: Map<string, { id: string; name: string; color: string }>,
  conflictMode: 'skip' | 'overwrite'
): Promise<{
  summary: EntityImportSummary;
  exportIdToDbId: Map<string, string>;
  nameToId: Map<string, string>;
}> {
  const summary: EntityImportSummary = { created: 0, updated: 0, skipped: 0 };
  const exportIdToDbId = new Map<string, string>();
  const nameToId = new Map<string, string>();

  for (const tag of tags) {
    const existing = existingByName.get(tag.name);

    if (existing) {
      if (conflictMode === 'skip') {
        summary.skipped++;
        exportIdToDbId.set(tag.id, existing.id);
        nameToId.set(tag.name, existing.id);
      } else {
        // Overwrite: update color
        await prisma.tag.update({
          where: { id: existing.id },
          data: { color: tag.color },
        });
        summary.updated++;
        exportIdToDbId.set(tag.id, existing.id);
        nameToId.set(tag.name, existing.id);
      }
    } else {
      // Create new tag
      const newTag = await prisma.tag.create({
        data: {
          projectId,
          name: tag.name,
          color: tag.color,
        },
      });
      summary.created++;
      exportIdToDbId.set(tag.id, newTag.id);
      nameToId.set(tag.name, newTag.id);
    }
  }

  return { summary, exportIdToDbId, nameToId };
}

async function importSuites(
  prisma: PrismaClient,
  projectId: string,
  suites: ExportSuiteNode[],
  existingByKey: Map<string, { id: string; name: string; parentId: string | null }>,
  conflictMode: 'skip' | 'overwrite' | 'create_new'
): Promise<{
  summary: EntityImportSummary;
  exportIdToDbId: Map<string, string>;
}> {
  const summary: EntityImportSummary = { created: 0, updated: 0, skipped: 0 };
  const exportIdToDbId = new Map<string, string>();

  // Topological sort: process suites with no parent first
  const sortedSuites = topologicalSortSuites(suites);

  for (const suite of sortedSuites) {
    // Resolve parent ID: either from already-imported suites or null for root
    const parentDbId = suite.parentId ? exportIdToDbId.get(suite.parentId) ?? null : null;
    const key = `${parentDbId ?? 'root'}:${suite.name}`;
    const existing = existingByKey.get(key);

    if (existing) {
      if (conflictMode === 'skip') {
        summary.skipped++;
        exportIdToDbId.set(suite.id, existing.id);
      } else if (conflictMode === 'overwrite') {
        // Just map to existing, name is the same
        summary.updated++;
        exportIdToDbId.set(suite.id, existing.id);
      } else {
        // create_new: create with modified name
        const newSuite = await createSuiteWithUniqueNameId(
          prisma,
          projectId,
          parentDbId,
          suite.name,
          suite.order
        );
        summary.created++;
        exportIdToDbId.set(suite.id, newSuite.id);
      }
    } else {
      // Create new suite
      const orderKey = generateLexoRank(suite.order);
      const newSuite = await prisma.suiteNode.create({
        data: {
          projectId,
          parentId: parentDbId,
          name: suite.name,
          orderKey,
        },
      });
      summary.created++;
      exportIdToDbId.set(suite.id, newSuite.id);
    }
  }

  return { summary, exportIdToDbId };
}

async function importTests(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  tests: ExportTest[],
  tagNameToId: Map<string, string>,
  existingByCode: Map<string, { id: string; code: string }>,
  conflictMode: 'skip' | 'overwrite' | 'create_new'
): Promise<{
  summary: EntityImportSummary;
  exportIdToDbId: Map<string, string>;
}> {
  const summary: EntityImportSummary = { created: 0, updated: 0, skipped: 0 };
  const exportIdToDbId = new Map<string, string>();

  for (const test of tests) {
    const existing = existingByCode.get(test.code);
    const tagIds = test.tags.map((name) => tagNameToId.get(name)).filter(Boolean) as string[];

    if (existing) {
      if (conflictMode === 'skip') {
        summary.skipped++;
        exportIdToDbId.set(test.id, existing.id);
      } else if (conflictMode === 'overwrite') {
        // Create new version for existing test
        await createNewVersionForTest(prisma, existing.id, userId, test.title, test.content);
        // Update tags
        await updateTestTags(prisma, existing.id, tagIds);
        summary.updated++;
        exportIdToDbId.set(test.id, existing.id);
      } else {
        // create_new: generate new code
        const newTest = await createTestWithNewCode(
          prisma,
          projectId,
          userId,
          test.title,
          test.content,
          tagIds
        );
        summary.created++;
        exportIdToDbId.set(test.id, newTest.id);
      }
    } else {
      // Create new test with specified code
      const newTest = await createTestWithCode(
        prisma,
        projectId,
        userId,
        test.code,
        test.title,
        test.content,
        tagIds
      );
      summary.created++;
      exportIdToDbId.set(test.id, newTest.id);
    }
  }

  return { summary, exportIdToDbId };
}

async function linkTestsToSuites(
  prisma: PrismaClient,
  suites: ExportSuiteNode[],
  suiteMapping: Map<string, string>,
  testMapping: Map<string, string>
): Promise<void> {
  for (const suite of suites) {
    const dbSuiteId = suiteMapping.get(suite.id);
    if (!dbSuiteId) continue;

    // Get existing items in this suite
    const existingItems = await prisma.suiteItem.findMany({
      where: { suiteNodeId: dbSuiteId },
      select: { testId: true },
    });
    const existingTestIds = new Set(existingItems.map((item) => item.testId));

    // Add tests that aren't already in the suite
    let orderIndex = existingItems.length;
    for (const exportTestId of suite.testIds) {
      const dbTestId = testMapping.get(exportTestId);
      if (!dbTestId || existingTestIds.has(dbTestId)) continue;

      const orderKey = generateLexoRank(orderIndex++);
      await prisma.suiteItem.create({
        data: {
          suiteNodeId: dbSuiteId,
          testId: dbTestId,
          orderKey,
        },
      });
    }
  }
}

function topologicalSortSuites(suites: ExportSuiteNode[]): ExportSuiteNode[] {
  const result: ExportSuiteNode[] = [];
  const visited = new Set<string>();
  const suiteMap = new Map(suites.map((s) => [s.id, s]));

  function visit(suite: ExportSuiteNode) {
    if (visited.has(suite.id)) return;
    visited.add(suite.id);

    // Visit parent first
    if (suite.parentId) {
      const parent = suiteMap.get(suite.parentId);
      if (parent) visit(parent);
    }

    result.push(suite);
  }

  // Sort by order within each level first
  const sortedByOrder = [...suites].sort((a, b) => a.order - b.order);
  for (const suite of sortedByOrder) {
    visit(suite);
  }

  return result;
}

async function createSuiteWithUniqueNameId(
  prisma: PrismaClient,
  projectId: string,
  parentId: string | null,
  baseName: string,
  order: number
): Promise<{ id: string }> {
  let name = `${baseName} (imported)`;
  let counter = 1;

  // Find unique name
  while (true) {
    const exists = await prisma.suiteNode.findFirst({
      where: { projectId, parentId, name },
    });
    if (!exists) break;
    name = `${baseName} (imported ${++counter})`;
  }

  const orderKey = generateLexoRank(order);
  return prisma.suiteNode.create({
    data: { projectId, parentId, name, orderKey },
    select: { id: true },
  });
}

async function createNewVersionForTest(
  prisma: PrismaClient,
  testId: string,
  userId: string,
  title: string,
  content: TestContent
): Promise<void> {
  // Get current version number
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { currentVersion: true },
  });

  if (!test) return;

  const nextVersion = (test.currentVersion?.version ?? 0) + 1;
  const contentHash = hashContent(content);

  // Don't create if content is identical
  if (test.currentVersion?.contentHash === contentHash && test.currentVersion?.title === title) {
    return;
  }

  const version = await prisma.testVersion.create({
    data: {
      testId,
      version: nextVersion,
      title,
      content: content as object,
      contentHash,
      source: 'import',
      createdById: userId,
    },
  });

  await prisma.test.update({
    where: { id: testId },
    data: { currentVersionId: version.id },
  });
}

async function updateTestTags(
  prisma: PrismaClient,
  testId: string,
  tagIds: string[]
): Promise<void> {
  // Remove existing tags
  await prisma.testTag.deleteMany({ where: { testId } });

  // Add new tags
  if (tagIds.length > 0) {
    await prisma.testTag.createMany({
      data: tagIds.map((tagId) => ({ testId, tagId })),
    });
  }
}

async function createTestWithCode(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  code: string,
  title: string,
  content: TestContent,
  tagIds: string[]
): Promise<{ id: string }> {
  const contentHash = hashContent(content);

  // Extract the number from code and update project counter if needed
  const codeNumber = parseInt(code.replace('TC-', ''), 10);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      testCounter: {
        set: Math.max(codeNumber, (await prisma.project.findUnique({ where: { id: projectId }, select: { testCounter: true } }))?.testCounter ?? 0),
      },
    },
  });

  const test = await prisma.test.create({
    data: { projectId, code },
  });

  const version = await prisma.testVersion.create({
    data: {
      testId: test.id,
      version: 1,
      title,
      content: content as object,
      contentHash,
      source: 'import',
      createdById: userId,
    },
  });

  await prisma.test.update({
    where: { id: test.id },
    data: { currentVersionId: version.id },
  });

  if (tagIds.length > 0) {
    await prisma.testTag.createMany({
      data: tagIds.map((tagId) => ({ testId: test.id, tagId })),
    });
  }

  return { id: test.id };
}

async function createTestWithNewCode(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  title: string,
  content: TestContent,
  tagIds: string[]
): Promise<{ id: string }> {
  const contentHash = hashContent(content);

  // Generate new code
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { testCounter: { increment: 1 } },
    select: { testCounter: true },
  });
  const code = `TC-${project.testCounter}`;

  const test = await prisma.test.create({
    data: { projectId, code },
  });

  const version = await prisma.testVersion.create({
    data: {
      testId: test.id,
      version: 1,
      title,
      content: content as object,
      contentHash,
      source: 'import',
      createdById: userId,
    },
  });

  await prisma.test.update({
    where: { id: test.id },
    data: { currentVersionId: version.id },
  });

  if (tagIds.length > 0) {
    await prisma.testTag.createMany({
      data: tagIds.map((tagId) => ({ testId: test.id, tagId })),
    });
  }

  return { id: test.id };
}
