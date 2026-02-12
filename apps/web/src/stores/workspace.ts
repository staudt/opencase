import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace } from '@/lib/api';

interface WorkspaceState {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  clear: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspace: null,
      workspaces: [],
      setWorkspaces: (workspaces) =>
        set((state) => ({
          workspaces,
          // Auto-select first workspace if none selected
          currentWorkspace: state.currentWorkspace || workspaces[0] || null,
        })),
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      clear: () => set({ currentWorkspace: null, workspaces: [] }),
    }),
    {
      name: 'opencase-workspace',
      partialize: (state) => ({
        currentWorkspace: state.currentWorkspace,
      }),
    }
  )
);
