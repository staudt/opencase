import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { ChevronRight, Folder, FolderOpen, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { suiteApi, type SuiteNode, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface SuiteTreeProps {
  suites: SuiteNode[];
  selectedSuiteId: string | null;
  onSelectSuite: (suiteId: string | null) => void;
  onSuiteUpdated: () => void;
  projectId: string;
}

// Drop position: before, after, or inside a suite
type DropPosition = {
  targetId: string;
  position: 'before' | 'after' | 'inside';
} | null;

// Time in ms to hover before "inside" drop is triggered
const HOVER_INSIDE_DELAY = 1500;

export function SuiteTree({
  suites,
  selectedSuiteId,
  onSelectSuite,
  onSuiteUpdated,
  projectId,
}: SuiteTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);
  const [pointerY, setPointerY] = useState<number>(0);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const toggleExpanded = (suiteId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    // Track current pointer position
    if (event.activatorEvent instanceof PointerEvent) {
      setPointerY(event.activatorEvent.clientY + (event.delta?.y || 0));
    }
  };

  const handleDragOver = () => {
    // Drop position is calculated in SuiteTreeNode based on pointerY
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active } = event;
    const currentDropPosition = dropPosition;

    setActiveId(null);
    setDropPosition(null);

    if (!currentDropPosition || active.id === currentDropPosition.targetId) {
      return;
    }

    const activeNode = findSuiteInTree(suites, active.id as string);
    const targetNode = findSuiteInTree(suites, currentDropPosition.targetId);

    if (!activeNode || !targetNode) {
      return;
    }

    // Prevent dropping a node inside itself or its descendants
    if (currentDropPosition.position === 'inside') {
      if (isDescendantOf(suites, targetNode.id, activeNode.id)) {
        toast({
          title: 'Cannot move',
          description: 'Cannot move a suite inside itself or its children.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      let newParentId: string | null;
      let afterSuiteId: string | undefined;

      if (currentDropPosition.position === 'inside') {
        // Drop inside the target - make it a child of target
        newParentId = targetNode.id;
        // Insert at the end of target's children
        const targetChildren = targetNode.children || [];
        if (targetChildren.length > 0) {
          afterSuiteId = targetChildren[targetChildren.length - 1].id;
        }
        // Expand the target so user can see the moved item
        setExpandedIds(prev => new Set([...prev, targetNode.id]));
      } else if (currentDropPosition.position === 'before') {
        // Insert before target - same parent as target
        newParentId = targetNode.parentId;
        const siblings = getSiblingsInOrder(suites, targetNode.parentId);
        // Filter out the active node to get correct index
        const filteredSiblings = siblings.filter(s => s.id !== activeNode.id);
        const targetIndex = filteredSiblings.findIndex(s => s.id === targetNode.id);
        if (targetIndex > 0) {
          afterSuiteId = filteredSiblings[targetIndex - 1].id;
        }
        // If targetIndex is 0 or -1, afterSuiteId stays undefined (insert at beginning)
      } else {
        // Insert after target - same parent as target
        newParentId = targetNode.parentId;
        afterSuiteId = targetNode.id;
      }

      await suiteApi.move(projectId, active.id as string, {
        parentId: newParentId,
        afterSuiteId,
      });
      onSuiteUpdated();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to move suite';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDropPosition(null);
  };

  const activeSuite = activeId ? findSuiteInTree(suites, activeId) : null;

  if (suites.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No suites yet</p>
        <p className="text-xs mt-1">Create a suite to organize your tests</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-0.5">
        {/* "All Tests" option */}
        <button
          onClick={() => onSelectSuite(null)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
            selectedSuiteId === null
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent text-muted-foreground hover:text-foreground'
          )}
        >
          <Folder className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 truncate">All Tests</span>
        </button>

        {/* Suite tree */}
        {suites.map((suite, index) => (
          <SuiteTreeNode
            key={suite.id}
            suite={suite}
            level={0}
            expandedIds={expandedIds}
            selectedSuiteId={selectedSuiteId}
            activeId={activeId}
            dropPosition={dropPosition}
            pointerY={pointerY}
            isLastInGroup={index === suites.length - 1}
            onToggle={toggleExpanded}
            onSelect={onSelectSuite}
            onDropPositionChange={setDropPosition}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeSuite && (
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm bg-background border-2 border-primary shadow-lg">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Folder className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="truncate font-medium">{activeSuite.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface SuiteTreeNodeProps {
  suite: SuiteNode;
  level: number;
  expandedIds: Set<string>;
  selectedSuiteId: string | null;
  activeId: string | null;
  dropPosition: DropPosition;
  pointerY: number;
  isLastInGroup: boolean;
  onToggle: (suiteId: string) => void;
  onSelect: (suiteId: string) => void;
  onDropPositionChange: (position: DropPosition) => void;
}

function SuiteTreeNode({
  suite,
  level,
  expandedIds,
  selectedSuiteId,
  activeId,
  dropPosition,
  pointerY,
  isLastInGroup,
  onToggle,
  onSelect,
  onDropPositionChange,
}: SuiteTreeNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHoverDelayMet, setIsHoverDelayMet] = useState(false);

  const hasChildren = suite.children && suite.children.length > 0;
  const isExpanded = expandedIds.has(suite.id);
  const isSelected = selectedSuiteId === suite.id;
  const isDragging = activeId === suite.id;

  const showDropBefore = dropPosition?.targetId === suite.id && dropPosition.position === 'before';
  const showDropAfter = dropPosition?.targetId === suite.id && dropPosition.position === 'after';
  const showDropInside = dropPosition?.targetId === suite.id && dropPosition.position === 'inside';

  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: suite.id,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: suite.id,
  });

  // Start/reset hover timer for "inside" mode
  useEffect(() => {
    if (isOver && !isDragging) {
      // Start timer for "inside" mode
      hoverTimerRef.current = setTimeout(() => {
        setIsHoverDelayMet(true);
      }, HOVER_INSIDE_DELAY);
    } else {
      // Clear timer and reset
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      setIsHoverDelayMet(false);
    }

    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, [isOver, isDragging]);

  // Calculate drop position based on pointer Y relative to this node
  const calculateDropPosition = useCallback(() => {
    if (!isOver || isDragging || !nodeRef.current) return;

    const rect = nodeRef.current.getBoundingClientRect();

    // If hover delay is met, switch to "inside" mode
    if (isHoverDelayMet) {
      onDropPositionChange({ targetId: suite.id, position: 'inside' });
      return;
    }

    // Otherwise, calculate before/after based on pointer position
    const middleY = rect.top + rect.height / 2;
    const position = pointerY < middleY ? 'before' : 'after';
    onDropPositionChange({ targetId: suite.id, position });
  }, [isOver, isDragging, pointerY, suite.id, onDropPositionChange, isHoverDelayMet]);

  useEffect(() => {
    calculateDropPosition();
  }, [calculateDropPosition]);

  // Clear drop position when not over
  useEffect(() => {
    if (!isOver && dropPosition?.targetId === suite.id) {
      // Don't clear if we're over a child
    }
  }, [isOver, dropPosition, suite.id]);

  // Combine refs
  const setNodeRef = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
    (nodeRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  return (
    <div className="relative">
      {/* Drop indicator - before */}
      {showDropBefore && (
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{
            top: 0,
            marginLeft: `${level * 12 + 8}px`,
          }}
        >
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div className="flex-1 h-0.5 bg-primary rounded-full" />
          </div>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer group',
          isSelected && !isDragging
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent text-foreground',
          isDragging && 'opacity-30',
          // Only show highlight ring when in "inside" mode (after hover delay)
          showDropInside && 'ring-2 ring-primary bg-primary/10'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(suite.id)}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className={cn(
            'h-4 w-4 flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing transition-opacity',
            'opacity-0 group-hover:opacity-100'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>

        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              onToggle(suite.id);
            }
          }}
          className={cn(
            'h-4 w-4 flex items-center justify-center flex-shrink-0',
            !hasChildren && 'invisible'
          )}
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
        </button>

        {/* Folder icon */}
        {isExpanded && hasChildren ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0 text-primary" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0" />
        )}

        {/* Suite name */}
        <span className="flex-1 truncate">{suite.name}</span>

        {/* Test count */}
        {suite.itemCount !== undefined && suite.itemCount > 0 && (
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded-full',
              isSelected && !isDragging
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {suite.itemCount}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {suite.children!.map((child, index) => (
            <SuiteTreeNode
              key={child.id}
              suite={child}
              level={level + 1}
              expandedIds={expandedIds}
              selectedSuiteId={selectedSuiteId}
              activeId={activeId}
              dropPosition={dropPosition}
              pointerY={pointerY}
              isLastInGroup={index === suite.children!.length - 1}
              onToggle={onToggle}
              onSelect={onSelect}
              onDropPositionChange={onDropPositionChange}
            />
          ))}
        </div>
      )}

      {/* Drop indicator - after (only show for last item in group or items without expanded children) */}
      {showDropAfter && (isLastInGroup || !hasChildren || !isExpanded) && (
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{
            bottom: 0,
            marginLeft: `${level * 12 + 8}px`,
          }}
        >
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div className="flex-1 h-0.5 bg-primary rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to find a suite in the tree
function findSuiteInTree(suites: SuiteNode[], id: string): SuiteNode | null {
  for (const suite of suites) {
    if (suite.id === id) {
      return suite;
    }
    if (suite.children) {
      const found = findSuiteInTree(suite.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Helper to get siblings of a node in order
function getSiblingsInOrder(suites: SuiteNode[], parentId: string | null): SuiteNode[] {
  if (parentId === null) {
    return suites;
  }

  const parent = findSuiteInTree(suites, parentId);
  return parent?.children || [];
}

// Helper to check if targetId is a descendant of ancestorId
function isDescendantOf(suites: SuiteNode[], targetId: string, ancestorId: string): boolean {
  const ancestor = findSuiteInTree(suites, ancestorId);
  if (!ancestor || !ancestor.children) return false;

  for (const child of ancestor.children) {
    if (child.id === targetId) return true;
    if (isDescendantOf([child], targetId, child.id)) return true;
  }
  return false;
}
