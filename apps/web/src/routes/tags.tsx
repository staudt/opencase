import { Tags } from 'lucide-react';

export function TagsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tags</h2>
        <p className="text-muted-foreground mt-1">
          Organize and categorize your test cases
        </p>
      </div>

      <div className="bg-card rounded-lg border p-12 text-center">
        <Tags className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Coming Soon</h3>
        <p className="text-muted-foreground">
          Tag management will be available in a future release.
          <br />
          You'll be able to create tags and apply them to test cases.
        </p>
      </div>
    </div>
  );
}
