import { createHash } from 'crypto';

// ============ Slug Generation ============

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============ Content Hashing ============

export function hashContent(content: object): string {
  const serialized = serializeCanonical(content);
  return createHash('sha256').update(serialized).digest('hex');
}

export function serializeCanonical(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const items = obj.map((item) => serializeCanonical(item));
    return `[${items.join(',')}]`;
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((key) => {
    const value = (obj as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${serializeCanonical(value)}`;
  });

  return `{${pairs.join(',')}}`;
}

// ============ ID Generation ============

export function generateId(): string {
  // Simple cuid-like ID for client-side use
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${randomPart}`;
}

export function generateBlockId(): string {
  return `blk_${generateId()}`;
}

// ============ LexoRank Utilities ============

const LEXO_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const LEXO_MID = 'm';

export function generateLexoRank(index: number): string {
  const base = LEXO_CHARS.length;
  let result = '';
  let n = index;

  do {
    result = LEXO_CHARS[n % base] + result;
    n = Math.floor(n / base);
  } while (n > 0);

  return result.padStart(3, 'a');
}

export function getLexoRankBetween(before: string | null, after: string | null): string {
  if (!before && !after) {
    return LEXO_MID;
  }

  if (!before) {
    // Insert at beginning
    const firstChar = after!.charAt(0);
    const idx = LEXO_CHARS.indexOf(firstChar);
    if (idx <= 0) {
      return 'a' + LEXO_MID;
    }
    return LEXO_CHARS[Math.floor(idx / 2)];
  }

  if (!after) {
    // Insert at end
    return before + LEXO_MID;
  }

  // Insert between
  const minLen = Math.max(before.length, after.length);
  const beforePadded = before.padEnd(minLen, 'a');
  const afterPadded = after.padEnd(minLen, 'a');

  let result = '';
  let foundDiff = false;

  for (let i = 0; i < minLen; i++) {
    const beforeChar = beforePadded[i];
    const afterChar = afterPadded[i];
    const beforeIdx = LEXO_CHARS.indexOf(beforeChar);
    const afterIdx = LEXO_CHARS.indexOf(afterChar);

    if (!foundDiff) {
      if (beforeIdx === afterIdx) {
        result += beforeChar;
      } else if (afterIdx - beforeIdx > 1) {
        result += LEXO_CHARS[Math.floor((beforeIdx + afterIdx) / 2)];
        foundDiff = true;
      } else {
        result += beforeChar;
        // Need to go deeper
      }
    }
  }

  if (!foundDiff) {
    result += LEXO_MID;
  }

  return result;
}

// ============ Date Utilities ============

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString();
}

// ============ Validation ============

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

// ============ Error Helpers ============

export function createApiError(code: string, message: string, details?: Record<string, unknown>) {
  return {
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
}

// ============ Type Guards ============

export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}
