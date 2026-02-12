import {
  ListOrdered,
  CheckCircle,
  StickyNote,
  AlertCircle,
  Table,
  Paperclip,
  type LucideIcon,
} from 'lucide-react';
import type { ContentBlock } from '@/lib/api';

type BlockType = ContentBlock['type'];

const iconMap: Record<BlockType, LucideIcon> = {
  step: ListOrdered,
  expected: CheckCircle,
  note: StickyNote,
  precondition: AlertCircle,
  table: Table,
  attachment: Paperclip,
};

const labelMap: Record<BlockType, string> = {
  step: 'Step',
  expected: 'Expected',
  note: 'Note',
  precondition: 'Precondition',
  table: 'Table',
  attachment: 'Attachment',
};

interface BlockTypeIconProps {
  type: BlockType;
  className?: string;
}

export function BlockTypeIcon({ type, className }: BlockTypeIconProps) {
  const Icon = iconMap[type];
  return <Icon className={className} />;
}

export function getBlockTypeLabel(type: BlockType): string {
  return labelMap[type];
}

export const blockTypes: BlockType[] = ['step', 'expected', 'note', 'precondition', 'table', 'attachment'];
