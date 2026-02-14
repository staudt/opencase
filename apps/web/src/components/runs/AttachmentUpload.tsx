import { useState, useRef } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { attachmentApi, type Attachment } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AttachmentUploadProps {
  projectId: string;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  disabled?: boolean;
  maxFiles?: number;
}

const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv', 'application/json',
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function AttachmentUpload({
  projectId,
  attachments,
  onAttachmentsChange,
  disabled = false,
  maxFiles = 5,
}: AttachmentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (attachments.length + files.length > maxFiles) {
      toast({
        title: 'Too many files',
        description: `Maximum ${maxFiles} attachments allowed.`,
        variant: 'destructive',
      });
      return;
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: `"${file.name}" has an unsupported type.`,
          variant: 'destructive',
        });
        return;
      }
      if (file.size > MAX_SIZE) {
        toast({
          title: 'File too large',
          description: `"${file.name}" exceeds the 10MB limit.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of files) {
      try {
        const result = await attachmentApi.upload(projectId, file);
        newAttachments.push(result.data);
      } catch {
        toast({
          title: 'Upload failed',
          description: `Failed to upload "${file.name}".`,
          variant: 'destructive',
        });
      }
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (attachment: Attachment) => {
    try {
      await attachmentApi.delete(projectId, attachment.id);
      onAttachmentsChange(attachments.filter((a) => a.id !== attachment.id));
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to remove attachment.',
        variant: 'destructive',
      });
    }
  };

  const isImage = (contentType: string) => contentType.startsWith('image/');

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 border rounded-md px-2 py-1.5 bg-muted/30 text-sm"
            >
              {isImage(att.contentType) ? (
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline truncate max-w-[150px]"
                title={att.filename}
              >
                {att.filename}
              </a>
              <span className="text-xs text-muted-foreground">
                ({formatFileSize(att.size)})
              </span>
              {!disabled && (
                <button
                  onClick={() => handleRemove(att)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && attachments.length < maxFiles && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4 mr-2" />
            )}
            {uploading ? 'Uploading...' : 'Attach files'}
          </Button>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
