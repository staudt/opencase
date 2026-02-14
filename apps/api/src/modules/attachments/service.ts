import type { PrismaClient } from '@opencase/db';
import { Readable, Transform } from 'stream';
import { storage, generateStorageKey } from '../../services/storage.js';
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  ALLOWED_ATTACHMENT_TYPES,
} from '@opencase/shared';

// ============ Types ============

export interface AttachmentResponse {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  createdAt: string;
}

// ============ Service ============

export const attachmentService = {
  /**
   * Upload a file and create an Attachment record (unlinked — no resultId yet).
   */
  async upload(
    prisma: PrismaClient,
    projectId: string,
    userId: string,
    file: { filename: string; mimetype: string; file: Readable }
  ): Promise<{ data: AttachmentResponse } | { error: string; message: string }> {
    // Verify project access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: { members: { where: { userId } } },
        },
      },
    });
    if (!project || project.workspace.members.length === 0) {
      return { error: 'NOT_FOUND', message: 'Project not found' };
    }

    // Validate content type
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
      return {
        error: 'BAD_REQUEST',
        message: `File type "${file.mimetype}" is not allowed`,
      };
    }

    // Generate storage key and save with size tracking
    const storageKey = generateStorageKey(file.filename);
    let size = 0;

    const sizeTracker = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (size > MAX_ATTACHMENT_SIZE_BYTES) {
          callback(new Error(`File exceeds maximum size of ${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)}MB`));
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      const trackedStream = file.file.pipe(sizeTracker);
      await storage.save(storageKey, trackedStream, file.mimetype);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      if (msg.includes('exceeds maximum size')) {
        return { error: 'BAD_REQUEST', message: msg };
      }
      throw err;
    }

    // Create DB record
    const attachment = await prisma.attachment.create({
      data: {
        filename: file.filename,
        contentType: file.mimetype,
        size,
        storageKey,
        uploadedById: userId,
      },
    });

    return {
      data: formatAttachment(attachment),
    };
  },

  /**
   * Download file — returns stream + metadata.
   */
  async download(
    prisma: PrismaClient,
    attachmentId: string,
    _userId: string
  ): Promise<
    | { data: { stream: Readable; contentType: string; filename: string; size: number } }
    | { error: string; message: string }
  > {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      return { error: 'NOT_FOUND', message: 'Attachment not found' };
    }

    try {
      const stream = await storage.getStream(attachment.storageKey);
      return {
        data: {
          stream,
          contentType: attachment.contentType,
          filename: attachment.filename,
          size: attachment.size,
        },
      };
    } catch {
      return { error: 'NOT_FOUND', message: 'File not found in storage' };
    }
  },

  /**
   * Delete an unlinked attachment (only the uploader can delete).
   */
  async delete(
    prisma: PrismaClient,
    attachmentId: string,
    userId: string
  ): Promise<{ data: { success: boolean } } | { error: string; message: string }> {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      return { error: 'NOT_FOUND', message: 'Attachment not found' };
    }

    if (attachment.uploadedById !== userId) {
      return { error: 'FORBIDDEN', message: 'You can only delete your own attachments' };
    }

    await storage.delete(attachment.storageKey);
    await prisma.attachment.delete({ where: { id: attachmentId } });

    return { data: { success: true } };
  },

  formatAttachment,
};

// ============ Helpers ============

export function formatAttachment(attachment: {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
}): AttachmentResponse {
  return {
    id: attachment.id,
    filename: attachment.filename,
    contentType: attachment.contentType,
    size: attachment.size,
    url: `/api/attachments/${attachment.id}/download`,
    createdAt: attachment.createdAt.toISOString(),
  };
}
