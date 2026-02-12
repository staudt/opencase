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

### Phase 2: Runs Light
Create runs, record results, attachments, progress views

### Phase 3: Automation & Integrations
CLI polish, webhooks, Playwright reporter, GitHub Checks

### Phase 4: AI Enablement
Knowledge export, AI suggestions, diff review workflow
