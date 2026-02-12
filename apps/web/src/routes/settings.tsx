import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure workspace and application settings
        </p>
      </div>

      <div className="bg-card rounded-lg border p-12 text-center">
        <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Coming Soon</h3>
        <p className="text-muted-foreground">
          Settings will be available in a future release.
          <br />
          You'll be able to configure workspace preferences, integrations, and more.
        </p>
      </div>
    </div>
  );
}
