import { useState, useEffect } from 'react';
import { UserCircle, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { workspaceApi, type WorkspaceMember } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';

interface UserPickerProps {
  value: string | null; // userId
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  compact?: boolean; // For table cells — shows just initials
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function UserPicker({ value, onChange, disabled, compact }: UserPickerProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  useEffect(() => {
    if (!currentWorkspace) return;
    workspaceApi
      .listMembers(currentWorkspace.id)
      .then((res) => setMembers(res.data))
      .catch(console.error);
  }, [currentWorkspace]);

  const selectedMember = members.find((m) => m.userId === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          className={`inline-flex items-center gap-1.5 rounded transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'
          } ${compact ? 'px-1 py-0.5' : 'px-2 py-1 -mx-2 -my-1'}`}
        >
          {selectedMember ? (
            <>
              <span className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                {getInitials(selectedMember.user.name)}
              </span>
              {!compact && (
                <span className="text-sm">{selectedMember.user.name}</span>
              )}
            </>
          ) : (
            <>
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              {!compact && (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {members.map((m) => (
          <DropdownMenuItem
            key={m.userId}
            onClick={() => onChange(m.userId)}
          >
            <span className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-medium mr-2 flex-shrink-0">
              {getInitials(m.user.name)}
            </span>
            <span className="text-sm">{m.user.name}</span>
            {m.userId === value && (
              <span className="ml-auto text-xs text-muted-foreground">Current</span>
            )}
          </DropdownMenuItem>
        ))}
        {value && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(null)}>
              <X className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm">Unassign</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
