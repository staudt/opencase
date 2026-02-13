import type { ContentBlock } from '@/lib/api';
import { BlockTypeIcon, getBlockTypeLabel } from '@/components/test-editor/BlockTypeIcon';

interface ReadOnlyBlocksProps {
  blocks: ContentBlock[];
}

const blockBg: Record<string, string> = {
  step: 'bg-blue-500/5 border-blue-500/20',
  expected: 'bg-green-500/5 border-green-500/20',
  precondition: 'bg-amber-500/5 border-amber-500/20',
  note: 'bg-slate-500/5 border-slate-500/20',
  table: 'bg-purple-500/5 border-purple-500/20',
  attachment: 'bg-slate-500/5 border-slate-500/20',
};

export function ReadOnlyBlocks({ blocks }: ReadOnlyBlocksProps) {
  let stepCounter = 0;

  return (
    <div className="space-y-2">
      {blocks.map((block) => {
        const isStep = block.type === 'step';
        if (isStep) stepCounter++;

        return (
          <div
            key={block.id}
            className={`rounded-lg border p-3 ${blockBg[block.type] ?? 'bg-muted/30 border-border'}`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <BlockTypeIcon type={block.type} className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {isStep ? `Step ${stepCounter}` : getBlockTypeLabel(block.type)}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {block.content || '(empty)'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
