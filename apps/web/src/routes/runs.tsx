import { FlaskConical } from 'lucide-react';

export function RunsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Test Runs</h2>
        <p className="text-muted-foreground mt-1">
          Execute and track test run progress
        </p>
      </div>

      <div className="bg-card rounded-lg border p-12 text-center">
        <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Coming Soon</h3>
        <p className="text-muted-foreground">
          Test runs will be available in a future release.
          <br />
          You'll be able to create runs, record results, and track progress.
        </p>
      </div>
    </div>
  );
}
