import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { testApi, type TestSummary, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface CreateTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  suiteId: string | null;
  onCreated: (test: TestSummary) => void;
}

export function CreateTestDialog({
  open,
  onOpenChange,
  projectId,
  suiteId,
  onCreated,
}: CreateTestDialogProps) {
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Test title is required',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await testApi.create(projectId, {
        title: title.trim(),
        suiteId: suiteId ?? undefined,
      });

      // Convert Test to TestSummary for the callback
      const testSummary: TestSummary = {
        id: response.data.id,
        projectId: response.data.projectId,
        code: response.data.code,
        title: response.data.title,
        tags: response.data.tags,
        createdAt: response.data.createdAt,
        updatedAt: response.data.updatedAt,
      };

      onCreated(testSummary);
      setTitle('');
      toast({
        title: 'Success',
        description: `Test ${response.data.code} created successfully`,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create test';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTitle('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Test</DialogTitle>
          <DialogDescription>
            Create a new test case. A test code will be automatically generated.
            {suiteId && ' This test will be added to the selected suite.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Test Title</Label>
              <Input
                id="title"
                placeholder="e.g., User can log in with valid credentials"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Test'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
