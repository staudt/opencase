import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  ChevronsUpDown,
  ChevronsDownUp,
  Folder,
  FolderOpen,
  Inbox,
  FileText,
  Tag,
  GripVertical,
} from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { SuiteNode, TestSummary, GroupedTestsResponse } from '@/lib/api';

interface TestTreeViewProps {
  projectId: string;
  suites: SuiteNode[];
  groupedTests: GroupedTestsResponse;
  scrollToSuiteId: string | null;
  onScrollComplete: () => void;
  activeDragType: string | null;
}

export function TestTreeView({
  projectId,
  suites,
  groupedTests,
  scrollToSuiteId,
  onScrollComplete,
  activeDragType,
}: TestTreeViewProps) {
  const [expandedSuiteIds, setExpandedSuiteIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize all suites as expanded on first load
  useEffect(() => {
    if (suites.length > 0) {
      const allIds = collectAllSuiteIds(suites);
      setExpandedSuiteIds(new Set(allIds));
    }
  }, []); // Only on mount

  // Scroll to suite when scrollToSuiteId changes
  useEffect(() => {
    if (scrollToSuiteId) {
      // Ensure the suite and its ancestors are expanded
      setExpandedSuiteIds((prev) => {
        const next = new Set(prev);
        next.add(scrollToSuiteId);
        expandAncestors(next, scrollToSuiteId, suites);
        return next;
      });

      // Small delay to let the DOM update after expanding
      requestAnimationFrame(() => {
        const element = document.getElementById(`suite-section-${scrollToSuiteId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        onScrollComplete();
      });
    }
  }, [scrollToSuiteId, suites, onScrollComplete]);

  const toggleSuite = (suiteId: string) => {
    setExpandedSuiteIds((prev) => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSuiteIds(new Set(collectAllSuiteIds(suites)));
  };

  const collapseAll = () => {
    setExpandedSuiteIds(new Set());
  };

  // Build a lookup map from suiteId to tests
  const testsBySuite = new Map<string, TestSummary[]>();
  for (const group of groupedTests.suites) {
    testsBySuite.set(group.suiteId, group.tests);
  }

  const totalTests = groupedTests.suites.reduce((sum, g) => sum + g.tests.length, 0) + groupedTests.unassigned.length;

  if (totalTests === 0 && suites.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No tests found</h3>
        <p className="text-muted-foreground text-sm">
          Create your first test to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/20">
        <span className="text-sm text-muted-foreground">
          {totalTests} {totalTests === 1 ? 'test' : 'tests'} across {suites.length} {suites.length === 1 ? 'suite' : 'suites'}
          {groupedTests.unassigned.length > 0 && ` + ${groupedTests.unassigned.length} unassigned`}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={expandAll} title="Expand all">
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} title="Collapse all">
            <ChevronsDownUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
        <div className="p-4 space-y-0">
          {/* Suite sections */}
          {suites.map((suite) => (
            <SuiteSection
              key={suite.id}
              suite={suite}
              level={0}
              testsBySuite={testsBySuite}
              expandedSuiteIds={expandedSuiteIds}
              onToggle={toggleSuite}
              projectId={projectId}
              activeDragType={activeDragType}
            />
          ))}

          {/* Unassigned section */}
          {groupedTests.unassigned.length > 0 && (
            <UnassignedSection
              tests={groupedTests.unassigned}
              projectId={projectId}
              activeDragType={activeDragType}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Suite Section ============

interface SuiteSectionProps {
  suite: SuiteNode;
  level: number;
  testsBySuite: Map<string, TestSummary[]>;
  expandedSuiteIds: Set<string>;
  onToggle: (suiteId: string) => void;
  projectId: string;
  activeDragType: string | null;
}

function SuiteSection({
  suite,
  level,
  testsBySuite,
  expandedSuiteIds,
  onToggle,
  projectId,
  activeDragType,
}: SuiteSectionProps) {
  const isExpanded = expandedSuiteIds.has(suite.id);
  const tests = testsBySuite.get(suite.id) || [];
  const hasChildren = suite.children && suite.children.length > 0;
  const hasContent = tests.length > 0 || hasChildren;

  // Count all tests recursively for display
  const totalTestCount = countTestsRecursive(suite, testsBySuite);

  // This suite section is a droppable zone for tests
  const { setNodeRef, isOver } = useDroppable({
    id: `main-${suite.id}`,
    data: { type: 'suite-drop-zone', suiteId: suite.id },
  });

  const showDropHighlight = isOver && activeDragType === 'test';

  return (
    <div id={`suite-section-${suite.id}`}>
      {/* Suite header */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors group',
          showDropHighlight && 'ring-2 ring-primary bg-primary/10'
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => onToggle(suite.id)}
      >
        {/* Expand/collapse chevron */}
        <ChevronRight
          className={cn(
            'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90',
            !hasContent && 'invisible'
          )}
        />

        {/* Folder icon */}
        {isExpanded && hasContent ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0 text-primary" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}

        {/* Suite name */}
        <span className="font-medium text-sm flex-1 truncate">{suite.name}</span>

        {/* Test count */}
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
          {totalTestCount}
        </span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div>
          {/* Tests in this suite */}
          {tests.map((test) => (
            <DraggableTestRow
              key={test.id}
              test={test}
              projectId={projectId}
              level={level + 1}
            />
          ))}

          {/* Child suites */}
          {hasChildren &&
            suite.children!.map((child) => (
              <SuiteSection
                key={child.id}
                suite={child}
                level={level + 1}
                testsBySuite={testsBySuite}
                expandedSuiteIds={expandedSuiteIds}
                onToggle={onToggle}
                projectId={projectId}
                activeDragType={activeDragType}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ============ Unassigned Section ============

interface UnassignedSectionProps {
  tests: TestSummary[];
  projectId: string;
  activeDragType: string | null;
}

function UnassignedSection({ tests, projectId, activeDragType }: UnassignedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { setNodeRef, isOver } = useDroppable({
    id: 'main-unassigned',
    data: { type: 'suite-drop-zone', suiteId: null },
  });

  const showDropHighlight = isOver && activeDragType === 'test';

  return (
    <div id="suite-section-unassigned" className="mt-2 pt-2 border-t">
      {/* Header */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors',
          showDropHighlight && 'ring-2 ring-primary bg-primary/10'
        )}
        style={{ paddingLeft: '8px' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
        <Inbox className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="font-medium text-sm flex-1 text-muted-foreground">Unassigned</span>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
          {tests.length}
        </span>
      </div>

      {/* Tests */}
      {isExpanded && (
        <div>
          {tests.map((test) => (
            <DraggableTestRow key={test.id} test={test} projectId={projectId} level={1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Draggable Test Row ============

interface DraggableTestRowProps {
  test: TestSummary;
  projectId: string;
  level: number;
}

function DraggableTestRow({ test, projectId, level }: DraggableTestRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `test-${test.id}`,
    data: { type: 'test', test },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group flex items-center gap-3 py-2 px-2 rounded-md transition-colors',
        isDragging ? 'opacity-30' : 'hover:bg-muted/30'
      )}
      style={{ paddingLeft: `${level * 20 + 28}px` }}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'h-5 w-5 flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing transition-opacity',
          'opacity-0 group-hover:opacity-100'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Test code + title + tags as a clickable link */}
      <Link
        to={`/projects/${projectId}/tests/${test.id}`}
        className="flex-1 flex items-center gap-3 min-w-0"
        onClick={(e) => {
          // Don't navigate if we're dragging
          if (isDragging) e.preventDefault();
        }}
      >
        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0">
          {test.code}
        </span>
        <span className="text-sm truncate flex-1">{test.title}</span>

        {test.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {test.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: `${tag.color}20`,
                  borderColor: tag.color,
                  color: tag.color,
                }}
              >
                <Tag className="h-3 w-3" />
                {tag.name}
              </span>
            ))}
            {test.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{test.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </Link>
    </div>
  );
}

// ============ Helpers ============

function collectAllSuiteIds(suites: SuiteNode[]): string[] {
  const ids: string[] = [];
  function walk(nodes: SuiteNode[]) {
    for (const node of nodes) {
      ids.push(node.id);
      if (node.children) walk(node.children);
    }
  }
  walk(suites);
  return ids;
}

function expandAncestors(expandedIds: Set<string>, targetId: string, suites: SuiteNode[]) {
  // Find the path to the target suite and expand all ancestors
  function findAndExpand(nodes: SuiteNode[]): boolean {
    for (const node of nodes) {
      if (node.id === targetId) return true;
      if (node.children && findAndExpand(node.children)) {
        expandedIds.add(node.id);
        return true;
      }
    }
    return false;
  }
  findAndExpand(suites);
}

function countTestsRecursive(suite: SuiteNode, testsBySuite: Map<string, TestSummary[]>): number {
  let count = (testsBySuite.get(suite.id) || []).length;
  if (suite.children) {
    for (const child of suite.children) {
      count += countTestsRecursive(child, testsBySuite);
    }
  }
  return count;
}
