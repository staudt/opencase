import { FolderTree, FileText, FlaskConical, Clock } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome message */}
      <div>
        <h2 className="text-2xl font-bold">Welcome to OpenCase</h2>
        <p className="text-muted-foreground mt-1">Your test case management dashboard</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Projects" value={1} icon={<FolderTree className="h-6 w-6" />} description="Active projects" />
        <StatCard title="Test Cases" value={5} icon={<FileText className="h-6 w-6" />} description="Total test cases" />
        <StatCard title="Test Runs" value={1} icon={<FlaskConical className="h-6 w-6" />} description="Active runs" />
        <StatCard title="Last Activity" value="Just now" icon={<Clock className="h-6 w-6" />} description="Recent" />
      </div>

      {/* Quick actions */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="font-semibold mb-4">Getting Started</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium">1. Explore the Sample Project</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Check out the demo test cases and suite structure.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium">2. Create Your First Test</h4>
            <p className="text-sm text-muted-foreground mt-1">Add test cases with steps and expected results.</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium">3. Run Tests</h4>
            <p className="text-sm text-muted-foreground mt-1">Create test runs and record results.</p>
          </div>
        </div>
      </div>

      {/* Recent activity placeholder */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p>No recent activity to show.</p>
          <p className="text-sm mt-1">Start by exploring your projects!</p>
        </div>
      </div>
    </div>
  );
}
