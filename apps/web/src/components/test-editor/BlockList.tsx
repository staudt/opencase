import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { BlockItem } from './BlockItem';
import { BlockTypeIcon, getBlockTypeLabel } from './BlockTypeIcon';
import type { ContentBlock } from '@/lib/api';

interface BlockListProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  disabled?: boolean;
}

export function BlockList({ blocks, onChange, disabled }: BlockListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activeBlock = activeId ? blocks.find((b) => b.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      onChange(arrayMove(blocks, oldIndex, newIndex));
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleBlockChange = (index: number, updatedBlock: ContentBlock) => {
    const newBlocks = [...blocks];
    newBlocks[index] = updatedBlock;
    onChange(newBlocks);
  };

  const handleBlockDelete = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <p className="text-sm">No blocks yet</p>
        <p className="text-xs mt-1">Add a block to start building your test case</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <BlockItem
              key={block.id}
              block={block}
              onChange={(updated) => handleBlockChange(index, updated)}
              onDelete={() => handleBlockDelete(index)}
              disabled={disabled}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeBlock && (
          <div className="flex items-center gap-2 rounded-lg border bg-background p-3 shadow-lg">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <BlockTypeIcon type={activeBlock.type} className="h-4 w-4" />
            <span className="text-sm font-medium">{getBlockTypeLabel(activeBlock.type)}</span>
            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
              {activeBlock.content || '(empty)'}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
