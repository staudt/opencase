# OpenCase

Open source, self-hosted test case management for teams.

## Core Principles

1. **API-First**: Everything is scriptable. The UI is a client of the API.
2. **Immutable History**: Test changes create new versions. History is never destroyed.
3. **Import/Export First-Class**: Round-trip safe. Your data is portable.
4. **AI-Friendly**: Structured for LLM consumption, but humans review all changes.
5. **Simple Self-Hosting**: One command to run. Docker-first.

## Project Structure

```
apps/
  api/          # Fastify backend (port 3001)
  web/          # React + Vite frontend (port 5173)
packages/
  db/           # Prisma schema and client
  shared/       # Shared types and utilities
  content/      # Test content model (blocks, diff)
  api-client/   # Generated API client
tools/
  cli/          # CLI for import/export/CI
```

## Key Entities

- **Workspace** → contains Projects
- **Project** → contains SuiteNodes, Tests, Tags, Runs
- **Test** → stable identity, points to current TestVersion
- **TestVersion** → immutable snapshot of test content
- **SuiteNode** → tree structure with LexoRank ordering
- **Run** → collection of RunItems referencing specific TestVersions
- **Result** → execution outcome with status, notes, attachments

## Content Model

Tests use block-based JSON content:
```json
{
  "blocks": [
    { "id": "...", "type": "step", "content": "Click login button" },
    { "id": "...", "type": "expected", "content": "Login modal appears" },
    { "id": "...", "type": "note", "content": "Requires valid session" }
  ]
}
```

Blocks have stable IDs for diffing. Content serializes deterministically.

## Development

```bash
# Start infrastructure
docker-compose up db

# Install dependencies
pnpm install

# Run migrations
pnpm db:migrate

# Seed demo data
pnpm db:seed

# Start development
pnpm dev          # Runs api + web concurrently
pnpm dev:api      # API only (port 3001)
pnpm dev:web      # Frontend only (port 5173)

# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint
```

## API Conventions

- All endpoints under `/api`
- Auth via `Authorization: Bearer <token>` header
- Pagination: cursor-based with `cursor` and `limit` params
- Errors: `{ error: { code: string, message: string } }`
- Bulk endpoints accept arrays, return `{ succeeded: [], failed: [] }`

## Key Technical Decisions

- **LexoRank** for tree ordering (no reindexing on drag-drop)
- **Content hashing** for detecting duplicate versions
- **Source tracking** on versions: "human", "ai", "import"
- **Audit log** for all significant actions
- **Fastify** for backend (lightweight, plugin-based)
- **TanStack Query + Zustand** for frontend state
- **shadcn/ui + Tailwind** for UI components
- **dnd-kit** for drag-and-drop

## Database

PostgreSQL with Prisma ORM. Schema at `packages/db/prisma/schema.prisma`.

Key indexes:
- Suite tree: `(projectId, parentId, orderKey)`
- Tests by project: `(projectId, code)`
- Audit logs: `(projectId, createdAt)`, `(entityType, entityId)`

## Roadmap

### Phase 0: Foundation ✓
Monorepo, Docker, Prisma, Auth, API shell, UI shell

### Phase 1: Test Management Core ✓
- ✓ Suite tree (drag-drop with LexoRank)
- ✓ Test editor (block-based with drag-drop reordering)
- ✓ Versioning (immutable versions with content hashing)
- ✓ History (version comparison, diff viewer, restore)
- ✓ Bulk ops (create, update, delete)
- ✓ Tags (CRUD API, test tagging UI)
- ✓ Delete test (single delete with confirmation)
- ✓ Export/Import (JSON export, import with conflict resolution, dry-run preview)

### Phase 1.5: Test Tree View ✓
- ✓ Main view shows all tests organized as tree by suite (not a flat filtered list)
- ✓ Clicking suite in sidebar scrolls to that section in main tree
- ✓ Expand/collapse individual suites and expand/collapse all
- ✓ Unassigned section at bottom for tests not in any suite
- ✓ Drag-and-drop tests across suites (main view ↔ sidebar, shared DndContext)
- ✓ API: GET /tests/grouped (all tests grouped by suite)
- ✓ API: POST /tests/:testId/move (move test between suites)

### Phase 2: Runs Light (in progress)
- ✓ Run CRUD with flexible test selection (all tests, by suite, by tag, manual pick)
- ✓ Record results (passed/failed/blocked/skipped/retest/untested) with inline status dropdowns
- ✓ Progress views and run statistics (stacked progress bar, per-status counts)
- ✓ Workspace-level runs list (cross-project, filterable by status/project)
- ✓ Run detail page with optimistic result recording
- ✓ API: GET/POST /projects/:projectId/runs, GET/PATCH/DELETE /runs/:runId
- ✓ API: PUT/DELETE /runs/:runId/items/:itemId/result
- ✓ API: GET /workspaces/:workspaceId/runs (workspace-level listing)
- Assign runs to users (run-level and individual test-level assignment)
- Step-through execution view (focused view, one test at a time, prev/next)
- Customizable steps per run (modify test steps for the specific run context)
- Attachments on results (screenshots, logs)

### Phase 3: API Polish & Automation
- REST API quality pass (automation-friendly endpoints for tests, suites, runs)
- CLI polish for import/export/CI integration
- Webhooks for run/result events
- Playwright reporter
- GitHub Checks integration

### Phase 4: AI Enablement
Knowledge export, AI suggestions, diff review workflow
