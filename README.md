# OpenCase

**Open source, self-hosted test case management for small to mid-sized teams.**

A modern alternative to Qase with a focus on simplicity, scriptability, and data ownership.

## Features

- **Suite Tree**: Organize tests in a hierarchical tree with drag-and-drop reordering
- **Block Editor**: Structured test content with steps, expected results, and notes
- **Version History**: Every edit creates an immutable version with full diff support
- **API-First**: Complete REST API with OpenAPI spec and generated TypeScript SDK
- **Import/Export**: Round-trip safe JSON export. Adapters for Qase and TestRail.
- **AI-Ready**: Structured exports for LLM consumption, with human review for AI suggestions
- **Simple Hosting**: Single `docker-compose up` to run everything

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for development)
- pnpm 9+ (for development)

### Run with Docker

```bash
# Clone the repository
git clone https://github.com/yourorg/opencase.git
cd opencase

# Copy environment file
cp docker/.env.example docker/.env

# Start everything
docker-compose up

# Open http://localhost:5173
```

### Development Setup

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
docker-compose up db

# Run migrations and seed
pnpm db:migrate
pnpm db:seed

# Start development servers
pnpm dev

# API: http://localhost:3001
# Web: http://localhost:5173
# API Docs: http://localhost:3001/docs
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React     │────▶│   Fastify   │────▶│  PostgreSQL │
│   (Vite)    │     │   API       │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       └───────────▶│   OpenAPI   │
                    │   + SDK     │
                    └─────────────┘
```

## CLI Usage

```bash
# Export a project
opencase export --project my-project --output ./export.json

# Import tests
opencase import --project my-project --input ./tests.json

# Create a run from CI
opencase run create --project my-project --suite "Smoke Tests"

# Post results from Playwright
opencase results post --run <run-id> --file ./results.json
```

## API Examples

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# List projects
curl http://localhost:3001/api/workspaces/my-workspace/projects \
  -H "Authorization: Bearer <token>"

# Create a test
curl -X POST http://localhost:3001/api/projects/<id>/tests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "User can login", "content": {"blocks": [...]}}'
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | Secret for signing tokens | (required) |
| `PORT` | API server port | `3001` |
| `STORAGE_TYPE` | `local` or `s3` | `local` |
| `S3_BUCKET` | S3 bucket for attachments | - |

## Project Structure

```
opencase/
├── apps/
│   ├── api/         # Fastify backend
│   └── web/         # React + Vite frontend
├── packages/
│   ├── db/          # Prisma schema + client
│   ├── shared/      # Shared types and utilities
│   ├── content/     # Test content model
│   └── api-client/  # Generated API client
├── tools/
│   └── cli/         # CLI for import/export
└── docker/          # Docker configuration
```

## Contributing

Contributions are welcome! Please read our contributing guide before submitting PRs.

```bash
# Run tests
pnpm test

# Run linting
pnpm lint

# Type check
pnpm typecheck
```

## License

MIT License - see LICENSE file for details.

## Acknowledgments

Built as an open-source alternative to Qase for teams who value data ownership and simplicity.
