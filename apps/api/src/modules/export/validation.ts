import { z } from 'zod';

// ============ Content Block Schemas ============

const contentBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['step', 'expected', 'note', 'precondition', 'table', 'attachment']),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const testContentSchema = z.object({
  description: z.string().optional(),
  blocks: z.array(contentBlockSchema).default([]),
});

// ============ Export Entity Schemas ============

export const exportTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color'),
});

export const exportTestSchema = z.object({
  id: z.string().min(1),
  code: z.string().regex(/^TC-\d+$/, 'Invalid test code format'),
  title: z.string().min(1).max(200),
  content: testContentSchema,
  tags: z.array(z.string()).default([]),
});

export const exportSuiteNodeSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().nullable(),
  name: z.string().min(1).max(100),
  order: z.number().int().min(0),
  testIds: z.array(z.string()).default([]),
});

export const exportSchemaValidator = z.object({
  version: z.string().min(1),
  exportedAt: z.string().datetime(),
  project: z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(50),
    description: z.string().max(500).nullable(),
  }),
  suites: z.array(exportSuiteNodeSchema).default([]),
  tests: z.array(exportTestSchema).default([]),
  tags: z.array(exportTagSchema).default([]),
});

// ============ Import Options Schema ============

export const conflictResolutionSchema = z.object({
  tests: z.enum(['skip', 'overwrite', 'create_new']).default('skip'),
  suites: z.enum(['skip', 'overwrite', 'create_new']).default('skip'),
  tags: z.enum(['skip', 'overwrite']).default('skip'),
});

export const importOptionsSchema = z.object({
  mode: z.enum(['merge', 'replace']).default('merge'),
  conflictResolution: conflictResolutionSchema.default({}),
  dryRun: z.boolean().default(false),
});

export const importRequestSchema = z.object({
  data: exportSchemaValidator,
  options: importOptionsSchema.default({}),
});

// ============ Type Exports ============

export type ExportSchemaInput = z.infer<typeof exportSchemaValidator>;
export type ImportOptionsInput = z.infer<typeof importOptionsSchema>;
export type ImportRequestInput = z.infer<typeof importRequestSchema>;

// ============ Validation Helpers ============

/**
 * Validate that all tag references in tests exist in the tags array
 */
export function validateTagReferences(
  data: ExportSchemaInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tagNames = new Set(data.tags.map((t) => t.name));

  for (const test of data.tests) {
    for (const tagName of test.tags) {
      if (!tagNames.has(tagName)) {
        errors.push(`Test "${test.code}" references unknown tag "${tagName}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate that all test references in suites exist in the tests array
 */
export function validateTestReferences(
  data: ExportSchemaInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const testIds = new Set(data.tests.map((t) => t.id));

  for (const suite of data.suites) {
    for (const testId of suite.testIds) {
      if (!testIds.has(testId)) {
        errors.push(`Suite "${suite.name}" references unknown test "${testId}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate that suite parent references don't form cycles
 */
export function validateSuiteHierarchy(
  data: ExportSchemaInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const suiteMap = new Map(data.suites.map((s) => [s.id, s]));

  for (const suite of data.suites) {
    // Check parent exists
    if (suite.parentId && !suiteMap.has(suite.parentId)) {
      errors.push(`Suite "${suite.name}" references unknown parent "${suite.parentId}"`);
      continue;
    }

    // Check for cycles
    const visited = new Set<string>();
    let current = suite;
    while (current.parentId) {
      if (visited.has(current.id)) {
        errors.push(`Circular reference detected in suite hierarchy involving "${suite.name}"`);
        break;
      }
      visited.add(current.id);
      const parent = suiteMap.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate uniqueness of IDs and codes within the export
 */
export function validateUniqueness(
  data: ExportSchemaInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check test code uniqueness
  const testCodes = new Set<string>();
  for (const test of data.tests) {
    if (testCodes.has(test.code)) {
      errors.push(`Duplicate test code "${test.code}"`);
    }
    testCodes.add(test.code);
  }

  // Check test ID uniqueness
  const testIds = new Set<string>();
  for (const test of data.tests) {
    if (testIds.has(test.id)) {
      errors.push(`Duplicate test ID "${test.id}"`);
    }
    testIds.add(test.id);
  }

  // Check suite ID uniqueness
  const suiteIds = new Set<string>();
  for (const suite of data.suites) {
    if (suiteIds.has(suite.id)) {
      errors.push(`Duplicate suite ID "${suite.id}"`);
    }
    suiteIds.add(suite.id);
  }

  // Check tag name uniqueness
  const tagNames = new Set<string>();
  for (const tag of data.tags) {
    if (tagNames.has(tag.name)) {
      errors.push(`Duplicate tag name "${tag.name}"`);
    }
    tagNames.add(tag.name);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Run all validations on import data
 */
export function validateImportData(
  data: ExportSchemaInput
): { valid: boolean; errors: string[] } {
  const allErrors: string[] = [];

  const uniquenessResult = validateUniqueness(data);
  allErrors.push(...uniquenessResult.errors);

  const tagRefResult = validateTagReferences(data);
  allErrors.push(...tagRefResult.errors);

  const testRefResult = validateTestReferences(data);
  allErrors.push(...testRefResult.errors);

  const hierarchyResult = validateSuiteHierarchy(data);
  allErrors.push(...hierarchyResult.errors);

  return { valid: allErrors.length === 0, errors: allErrors };
}
