import { FileText, Image as ImageIcon, Download, Paperclip } from 'lucide-react';
import type { Attachment } from '@/lib/api';

interface AttachmentListProps {
  attachments: Attachment[];
  compact?: boolean;
}

export function AttachmentList({ attachments, compact = false }: AttachmentListProps) {
  if (attachments.length === 0) return null;

  const isImage = (contentType: string) => contentType.startsWith('image/');

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${attachments.length} attachment${attachments.length !== 1 ? 's' : ''}`}>
        <Paperclip className="h-3 w-3" />
        {attachments.length}
      </span>
    );
  }

  const imageAttachments = attachments.filter((a) => isImage(a.contentType));

  return (
    <div className="space-y-1.5">
      {attachments.map((att) => (
        <a
          key={att.id}
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm hover:underline text-muted-foreground hover:text-foreground transition-colors"
        >
          {isImage(att.contentType) ? (
            <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <FileText className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <span className="truncate">{att.filename}</span>
          <Download className="h-3 w-3 flex-shrink-0 ml-auto" />
        </a>
      ))}

      {imageAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {imageAttachments.map((att) => (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={att.url}
                alt={att.filename}
                className="h-16 w-16 object-cover rounded border hover:border-primary transition-colors"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
