import { useState, useEffect } from 'react';
import { Plus, X, Tag as TagIcon, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { tagApi, type Tag } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
  projectId: string;
  selectedTags: Tag[];
  onChange: (tags: Tag[]) => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6366f1', // indigo (default)
  '#64748b', // slate
];

export function TagSelector({
  projectId,
  selectedTags,
  onChange,
  disabled,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTags();
    }
  }, [isOpen, projectId]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const response = await tagApi.list(projectId);
      setAvailableTags(response.data);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTag = (tag: Tag) => {
    const isSelected = selectedTags.some((t) => t.id === tag.id);
    if (isSelected) {
      onChange(selectedTags.filter((t) => t.id !== tag.id));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTags.filter((t) => t.id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      setCreating(true);
      const response = await tagApi.create(projectId, {
        name: newTagName.trim(),
        color: newTagColor,
      });
      setAvailableTags([...availableTags, response.data]);
      onChange([...selectedTags, response.data]);
      setNewTagName('');
      setNewTagColor('#6366f1');
      setShowCreateForm(false);
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Selected tags display */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            {!disabled && (
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-0.5 hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}

        {!disabled && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                {selectedTags.length === 0 ? 'Add tags' : 'Edit'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TagIcon className="h-4 w-4" />
                  Manage Tags
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Available tags */}
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableTags.length === 0 && !showCreateForm ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No tags yet. Create one below.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map((tag) => {
                          const isSelected = selectedTags.some((t) => t.id === tag.id);
                          return (
                            <button
                              key={tag.id}
                              onClick={() => handleToggleTag(tag)}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
                                isSelected
                                  ? 'text-white ring-2 ring-offset-1'
                                  : 'text-white opacity-60 hover:opacity-100'
                              )}
                              style={{
                                backgroundColor: tag.color,
                                '--tw-ring-color': isSelected ? tag.color : undefined,
                              } as React.CSSProperties}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Create new tag form */}
                {showCreateForm ? (
                  <div className="space-y-3 border-t pt-3">
                    <Input
                      placeholder="Tag name..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateTag();
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={cn(
                            'h-6 w-6 rounded-full transition-all',
                            newTagColor === color && 'ring-2 ring-offset-2 ring-gray-400'
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewTagName('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleCreateTag}
                        disabled={!newTagName.trim() || creating}
                      >
                        {creating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Create'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowCreateForm(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create new tag
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
