import { createReadStream, createWriteStream } from 'fs';
import { mkdir, unlink, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import { config } from '../config.js';

export interface StorageProvider {
  save(key: string, stream: Readable, contentType: string): Promise<void>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}

// --- Local Filesystem Provider ---

class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private getPath(key: string): string {
    return join(this.baseDir, key);
  }

  async save(key: string, stream: Readable): Promise<void> {
    const filePath = this.getPath(key);
    await mkdir(dirname(filePath), { recursive: true });
    const writeStream = createWriteStream(filePath);
    await pipeline(stream, writeStream);
  }

  async getStream(key: string): Promise<Readable> {
    const filePath = this.getPath(key);
    await stat(filePath); // throws ENOENT if not found
    return createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.getPath(key));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}

// --- S3 Provider (stub) ---

class S3StorageProvider implements StorageProvider {
  async save(_key: string, _stream: Readable, _contentType: string): Promise<void> {
    throw new Error('S3 storage not yet implemented');
  }
  async getStream(_key: string): Promise<Readable> {
    throw new Error('S3 storage not yet implemented');
  }
  async delete(_key: string): Promise<void> {
    throw new Error('S3 storage not yet implemented');
  }
}

// --- Factory ---

function createStorageProvider(): StorageProvider {
  if (config.STORAGE_TYPE === 's3') {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider(config.UPLOAD_DIR);
}

// --- Helpers ---

export function generateStorageKey(filename: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const uuid = randomUUID();
  const safeFilename = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 100);
  return `${year}/${month}/${uuid}/${safeFilename}`;
}

export const storage = createStorageProvider();
