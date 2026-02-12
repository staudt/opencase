import { Link } from 'react-router-dom';
import { FileText, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TestSummary, SuiteNode } from '@/lib/api';

interface TestListProps {
  tests: TestSummary[];
  selectedSuiteId: string | null;
  suites: SuiteNode[];
  onSelectSuite: (suiteId: string | null) => void;
  projectId: string;
}

export function TestList({
  tests,
  selectedSuiteId,
  suites,
  projectId,
}: TestListProps) {
  // Find the selected suite name
  const selectedSuiteName = selectedSuiteId
    ? findSuiteName(suites, selectedSuiteId)
    : 'All Tests';

  if (tests.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No tests found</h3>
        <p className="text-muted-foreground text-sm">
          {selectedSuiteId
            ? 'This suite has no tests yet. Create one to get started.'
            : 'Create your first test to get started.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {selectedSuiteName}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({tests.length} {tests.length === 1 ? 'test' : 'tests'})
          </span>
        </h2>
      </div>

      <div className="border rounded-lg divide-y">
        {tests.map(test => (
          <Link
            key={test.id}
            to={`/projects/${projectId}/tests/${test.id}`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-shrink-0">
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                {test.code}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{test.title}</h3>
            </div>
            {test.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {test.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag.id}
                    className={cn(
                      'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                      'border'
                    )}
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
        ))}
      </div>
    </div>
  );
}

// Helper to find suite name in tree
function findSuiteName(suites: SuiteNode[], suiteId: string): string | null {
  for (const suite of suites) {
    if (suite.id === suiteId) {
      return suite.name;
    }
    if (suite.children && suite.children.length > 0) {
      const found = findSuiteName(suite.children, suiteId);
      if (found) return found;
    }
  }
  return null;
}
