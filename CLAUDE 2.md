# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Lesson Coach for **Workplace Edge** — a communication skills training chatbot. Admins upload `.docx` lesson documents; learners chat with an AI that answers strictly from those lesson materials. Uses Google Gemini (gemini-2.5-flash) as the LLM backend.

## Architecture

**Monorepo with two independent packages:**

- **Root (`/`)** — React 18 + Vite frontend (TypeScript, Tailwind CSS)
- **`/server`** — Express API server (TypeScript, tsx for dev)

Each has its own `package.json`, `tsconfig.json`, and `node_modules`. Install dependencies separately.

**Frontend** routes (`react-router-dom`):
- `/chat` — learner chat interface
- `/admin` — lesson upload/management

**Server** API routes (all under `/api`):
- `POST /api/chat` — send message, returns AI response (manages sessions)
- `POST /api/upload` — upload `.docx` file (multer, mammoth for text extraction)
- `GET /api/lessons` — list lessons
- `DELETE /api/lessons/:id` — delete a lesson

**Data flow for chat:** User message → keyword-based intent detection (`lib/intent.ts`) matches relevant lessons → full conversation history + matched lesson content sent as Gemini system instruction → response stored and returned.

**Database:** Prisma ORM with Turso (LibSQL) adapter at runtime (`server/src/lib/db.ts`). Schema at `server/prisma/schema.prisma` defines Session, Message, IntentLog, Lesson, and Rating models. The schema's datasource reads `env("PRISMA_DATABASE_URL")` (defaults to `file:./dev.db` for the Prisma CLI when unset); the running server ignores that and connects to Turso via `TURSO_DATABASE_URL`. Migration history lives in `server/prisma/migrations/` and is deployed to Turso with `npm run db:migrate:deploy` — see "Database migrations" below.

## Development Commands

```bash
# Frontend (from repo root)
npm install
npm run dev          # Vite dev server on :5173

# Server (from /server)
npm install          # also runs `prisma generate` via postinstall hook
npm run dev          # tsx watch on :3000

# Build
npm run build        # Frontend: tsc + vite build (root)
cd server && npm run build   # Server: tsc → dist/
```

### Database migrations

Migration history is committed to `server/prisma/migrations/`. The pipeline has two halves:

**Authoring locally:** `npm run db:migrate:dev -- --name <change>` from `/server`. This runs Prisma's standard `migrate dev` against a local SQLite file (`PRISMA_DATABASE_URL`, defaults to `file:./dev.db`) and produces a new directory under `prisma/migrations/`.

**Deploying to Turso:** `npm run db:migrate:deploy` from `/server`. Prisma's native `migrate deploy` does not yet support libSQL over HTTP, so this runs `scripts/applyTursoMigrations.ts`, which uses `@libsql/client` to apply pending migrations and tracks state in a `_prisma_migrations` table (schema-compatible with Prisma's, so we can swap to native `migrate deploy` if/when it lands).

> ⚠️ `db:migrate:deploy` writes to whatever `TURSO_DATABASE_URL` is in your `.env`. Confirm the URL before running — there is no built-in confirmation prompt.

Other scripts:
- `npm run db:push:local` — escape hatch; pushes the schema to the local SQLite file without generating a migration. Useful for fast iteration; never use against production.
- `npm run db:migrate:deploy -- --dry` — print pending migrations without applying.

The baseline migration `20260426000000_init/migration.sql` uses `CREATE TABLE IF NOT EXISTS` so applying it against a Turso DB that was provisioned via the previous manual `prisma migrate diff | turso db shell` workflow is a safe no-op (the `_prisma_migrations` row gets recorded and future migrations apply cleanly).

## Environment

Single `.env` file at repo root (copied from `.env.example`). The server loads it from `path.join(__dirname, "..", "..", ".env")`.

Required variables: `VITE_API_URL`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `GEMINI_API_KEY`. Optional: `PRISMA_DATABASE_URL` for the Prisma CLI (defaults to `file:./dev.db`).

## Key Conventions

- Frontend API client: `src/api.ts` — axios instance with `VITE_API_URL` base
- CORS whitelist is hardcoded in `server/src/index.ts` (localhost:5173 + Vercel deploy URL)
- File uploads limited to `.docx` only, max 25MB
- Frontend deployed to Vercel (`vercel.json` SPA rewrite); server deployed separately
