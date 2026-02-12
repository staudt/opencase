import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BlockTypeIcon, getBlockTypeLabel, blockTypes } from './BlockTypeIcon';
import type { ContentBlock } from '@/lib/api';

// Client-side block ID generator
function generateBlockId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `blk_c${timestamp}${randomPart}`;
}

interface AddBlockButtonProps {
  onAdd: (block: ContentBlock) => void;
  disabled?: boolean;
}

export function AddBlockButton({ onAdd, disabled }: AddBlockButtonProps) {
  const handleAddBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: generateBlockId(),
      type,
      content: '',
    };
    onAdd(newBlock);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Plus className="h-4 w-4 mr-2" />
          Add Block
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {blockTypes.map((type) => (
          <DropdownMenuItem key={type} onClick={() => handleAddBlock(type)}>
            <BlockTypeIcon type={type} className="h-4 w-4 mr-2" />
            {getBlockTypeLabel(type)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
