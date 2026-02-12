import { useState, useRef } from 'react';
import { Download, Upload, MoreVertical, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { exportApi, type ExportSchema, type ImportOptions, type ImportPreview } from '@/lib/api';

interface ImportExportMenuProps {
  projectId: string;
  projectSlug: string;
  onImportComplete?: () => void;
}

export function ImportExportMenu({ projectId, projectSlug, onImportComplete }: ImportExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<ExportSchema | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    mode: 'merge',
    conflictResolution: {
      tests: 'skip',
      suites: 'skip',
      tags: 'skip',
    },
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const data = await exportApi.exportProject(projectId);

      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectSlug}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      setImportResult(null);
      const text = await file.text();
      const data = JSON.parse(text) as ExportSchema;

      // Basic validation
      if (!data.version || !data.tests || !data.suites || !data.tags) {
        throw new Error('Invalid export file format');
      }

      setImportFile(data);
      setImportFileName(file.name);
      setShowImportDialog(true);

      // Get preview
      const preview = await exportApi.previewImport(projectId, data, importOptions);
      setImportPreview(preview.data);
    } catch (err) {
      console.error('Failed to parse import file:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse import file');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    try {
      setIsImporting(true);
      setError(null);
      const result = await exportApi.importProject(projectId, importFile, importOptions);

      const summary = result.data.summary;
      const totalCreated = summary.tests.created + summary.suites.created + summary.tags.created;
      const totalUpdated = summary.tests.updated + summary.suites.updated + summary.tags.updated;
      const totalSkipped = summary.tests.skipped + summary.suites.skipped + summary.tags.skipped;

      setImportResult({
        success: true,
        message: `Import complete: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped`,
      });

      // Refresh the page data
      onImportComplete?.();
    } catch (err) {
      console.error('Import failed:', err);
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseImportDialog = () => {
    setShowImportDialog(false);
    setImportFile(null);
    setImportFileName('');
    setImportPreview(null);
    setImportResult(null);
    setError(null);
  };

  const updateConflictResolution = async (
    entity: 'tests' | 'suites' | 'tags',
    value: 'skip' | 'overwrite' | 'create_new'
  ) => {
    const newOptions = {
      ...importOptions,
      conflictResolution: {
        ...importOptions.conflictResolution,
        [entity]: value,
      },
    };
    setImportOptions(newOptions);

    // Refresh preview
    if (importFile) {
      try {
        const preview = await exportApi.previewImport(projectId, importFile, newOptions);
        setImportPreview(preview.data);
      } catch (err) {
        console.error('Failed to update preview:', err);
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileSelect}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Project'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import Data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showImportDialog} onOpenChange={handleCloseImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Import Project Data
            </DialogTitle>
            <DialogDescription>
              Importing from: {importFileName}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {importResult && (
            <div className={`flex items-center gap-2 p-3 text-sm rounded-md ${
              importResult.success
                ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
                : 'text-destructive bg-destructive/10'
            }`}>
              {importResult.success ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              )}
              {importResult.message}
            </div>
          )}

          {importPreview && !importResult && (
            <div className="space-y-4">
              {/* Preview summary */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <PreviewCard
                  title="Tests"
                  preview={importPreview.preview.tests}
                  conflictMode={importOptions.conflictResolution.tests}
                  onConflictModeChange={(v) => updateConflictResolution('tests', v)}
                  allowCreateNew
                />
                <PreviewCard
                  title="Suites"
                  preview={importPreview.preview.suites}
                  conflictMode={importOptions.conflictResolution.suites}
                  onConflictModeChange={(v) => updateConflictResolution('suites', v)}
                  allowCreateNew
                />
                <PreviewCard
                  title="Tags"
                  preview={importPreview.preview.tags}
                  conflictMode={importOptions.conflictResolution.tags as 'skip' | 'overwrite'}
                  onConflictModeChange={(v) => updateConflictResolution('tags', v as 'skip' | 'overwrite')}
                />
              </div>

              {/* Mode selection */}
              <div className="space-y-2">
                <Label>Import Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={importOptions.mode === 'merge' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImportOptions({ ...importOptions, mode: 'merge' })}
                  >
                    Merge
                  </Button>
                  <Button
                    variant={importOptions.mode === 'replace' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImportOptions({ ...importOptions, mode: 'replace' })}
                  >
                    Replace All
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {importOptions.mode === 'merge'
                    ? 'Add to existing data, handling conflicts based on settings above'
                    : 'Delete all existing data and import fresh (use with caution)'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseImportDialog}>
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && (
              <Button onClick={handleImport} disabled={isImporting || !importFile}>
                {isImporting ? 'Importing...' : 'Import'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PreviewCardProps {
  title: string;
  preview: {
    toCreate: string[];
    toUpdate: string[];
    toSkip: string[];
    conflicts: string[];
  };
  conflictMode: 'skip' | 'overwrite' | 'create_new';
  onConflictModeChange: (mode: 'skip' | 'overwrite' | 'create_new') => void;
  allowCreateNew?: boolean;
}

function PreviewCard({ title, preview, conflictMode, onConflictModeChange, allowCreateNew }: PreviewCardProps) {
  const hasConflicts = preview.conflicts.length > 0;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="font-medium">{title}</div>
      <div className="text-xs space-y-1 text-muted-foreground">
        <div className="flex justify-between">
          <span>New:</span>
          <span className="text-green-600">{preview.toCreate.length}</span>
        </div>
        {preview.toUpdate.length > 0 && (
          <div className="flex justify-between">
            <span>Update:</span>
            <span className="text-blue-600">{preview.toUpdate.length}</span>
          </div>
        )}
        {preview.toSkip.length > 0 && (
          <div className="flex justify-between">
            <span>Skip:</span>
            <span className="text-muted-foreground">{preview.toSkip.length}</span>
          </div>
        )}
        {hasConflicts && (
          <div className="flex justify-between">
            <span>Conflicts:</span>
            <span className="text-amber-600">{preview.conflicts.length}</span>
          </div>
        )}
      </div>
      {hasConflicts && (
        <div className="pt-2 border-t">
          <Label className="text-xs">On conflict:</Label>
          <select
            className="w-full mt-1 text-xs border rounded px-2 py-1"
            value={conflictMode}
            onChange={(e) => onConflictModeChange(e.target.value as 'skip' | 'overwrite' | 'create_new')}
          >
            <option value="skip">Skip</option>
            <option value="overwrite">Overwrite</option>
            {allowCreateNew && <option value="create_new">Create New</option>}
          </select>
        </div>
      )}
    </div>
  );
}
