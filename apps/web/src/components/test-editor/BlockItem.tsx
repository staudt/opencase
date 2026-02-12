import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BlockTypeIcon, getBlockTypeLabel } from './BlockTypeIcon';
import type { ContentBlock } from '@/lib/api';

interface BlockItemProps {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function BlockItem({ block, onChange, onDelete, disabled }: BlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex gap-2 rounded-lg border bg-background p-3',
        isDragging && 'opacity-50 shadow-lg',
        disabled && 'opacity-60'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing',
          disabled && 'cursor-not-allowed'
        )}
        disabled={disabled}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Block content */}
      <div className="flex-1 space-y-2">
        {/* Block type badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
              block.type === 'step' && 'bg-blue-100 text-blue-700',
              block.type === 'expected' && 'bg-green-100 text-green-700',
              block.type === 'note' && 'bg-yellow-100 text-yellow-700',
              block.type === 'precondition' && 'bg-orange-100 text-orange-700',
              block.type === 'table' && 'bg-purple-100 text-purple-700',
              block.type === 'attachment' && 'bg-gray-100 text-gray-700'
            )}
          >
            <BlockTypeIcon type={block.type} className="h-3 w-3" />
            {getBlockTypeLabel(block.type)}
          </span>
        </div>

        {/* Content textarea */}
        <Textarea
          value={block.content}
          onChange={(e) => onChange({ ...block, content: e.target.value })}
          placeholder={`Enter ${getBlockTypeLabel(block.type).toLowerCase()} content...`}
          className="min-h-[60px] resize-none"
          disabled={disabled}
        />
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100',
          disabled && 'hidden'
        )}
        onClick={onDelete}
        disabled={disabled}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
