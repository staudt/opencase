import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BlockList } from './BlockList';
import { AddBlockButton } from './AddBlockButton';
import type { ContentBlock } from '@/lib/api';

interface TestEditorProps {
  title: string;
  description: string;
  blocks: ContentBlock[];
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onBlocksChange: (blocks: ContentBlock[]) => void;
  disabled?: boolean;
}

export function TestEditor({
  title,
  description,
  blocks,
  onTitleChange,
  onDescriptionChange,
  onBlocksChange,
  disabled,
}: TestEditorProps) {
  const handleAddBlock = (block: ContentBlock) => {
    onBlocksChange([...blocks, block]);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="test-title">Test Title</Label>
        <Input
          id="test-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Enter test title..."
          disabled={disabled}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="test-description">Description</Label>
        <Textarea
          id="test-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe what this test case covers..."
          className="min-h-[100px]"
          disabled={disabled}
        />
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Test Steps</Label>
          <AddBlockButton onAdd={handleAddBlock} disabled={disabled} />
        </div>
        <BlockList blocks={blocks} onChange={onBlocksChange} disabled={disabled} />
      </div>
    </div>
  );
}
