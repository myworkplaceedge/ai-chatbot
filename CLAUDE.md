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

<!-- GSD:project-start source:PROJECT.md -->
## Project

**AI Lesson Coach (Workplace Edge)**

An LLM-grounded chat coach for **Workplace Edge** communication-skills training. Admins upload `.docx` lesson documents through an admin UI; learners chat with an AI assistant that answers strictly from those lesson materials. The product ships as a standalone web app (`/chat`, `/admin`) and as an embedded chat widget inside LearnWorlds course pages.

**Core Value:** A learner asks a workplace-communication question and gets an answer that is grounded in the uploaded lessons — never invented, never off-topic, never harmful — and a thoughtful follow-up that keeps the practice loop going.

### Constraints

- **Tech stack**: React 18 + Vite frontend (root), Express + Prisma + Turso libSQL backend (`/server`). No framework swaps in v1.1 — fixes only.
- **Backend deploy**: Server hosts on Railway; lacks built-in cron and pub/sub. Single-instance assumption holds for v1.1 (cache invalidation strategy chosen accordingly).
- **Frontend deploy**: Vercel (SPA via `vercel.json` rewrite). Frontend bundle size is a soft concern — Phase 4 removes ~5 MB of Prisma deps that were never used in the bundle.
- **DB**: Turso (libSQL) is the runtime DB; native `prisma migrate deploy` doesn't yet support libSQL HTTP, so `server/scripts/applyTursoMigrations.ts` applies migrations. libSQL has known quirks with `ALTER TABLE` for FK changes — Phase 2 schema migration may need `PRAGMA foreign_keys=OFF` + table-rebuild rather than raw `ALTER`.
- **LLM**: Google Gemini `gemini-2.5-flash` via `@google/generative-ai`. No multi-provider abstraction in v1.1; Gemini is the only backend.
- **Security**: `.env` was never committed (verified `git log -- .env` empty in security review LOW). Leak risk is local-disk only, but rotation is still part of Phase 1 hygiene.
- **Compatibility**: Embedded chat widget runs inside LearnWorlds iframes in older browser contexts — Phase 3 needs a `crypto.randomUUID()` polyfill for stable React keys.
- **Tenancy**: LearnWorlds tenants may share a single egress IP — Phase 1 rate limits (30/min/IP for `/api/chat`, 5/min/IP for `/api/upload`) could lock out a whole organization. Documented; pair with session bucket if usage warrants.
- **Branching**: `branching_strategy: "none"` in `config.json`. All v1.1 phase work appends to the current branch `dani/start-commands`.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.8.2 - Used in both frontend (`src/**/*.ts`, `src/**/*.tsx`) and server (`server/src/**/*.ts`)
- JavaScript - Configuration files, postinstall hooks (`run-prisma.cjs`)
- Shell (Bash) - Build and deployment scripts (`start.sh`)
- SQL - Prisma migrations (`server/prisma/migrations/**/*.sql`)
## Runtime
- Node.js 18+ (per README; no `.nvmrc` or `engines` field enforces this)
- Vite dev server on port 5173 (frontend)
- Express on port 3000 (server, configurable via `PORT` env var)
- npm (monorepo with separate `package.json` and `node_modules` for root and `/server`)
- Lockfiles: `package-lock.json` (root) and `server/package-lock.json` present
## Frameworks
- React 18.3.1 - UI framework; entry point `src/` (no `src/index.tsx` found; likely in root)
- Vite 8.0.3 - Build tool and dev server; config at `vite.config.ts`
- React Router 6.30.1 - Client-side routing (`react-router-dom`); routes `/chat`, `/admin`
- Tailwind CSS 3.4.17 - Utility-first CSS; config via `tailwind.config.ts` (implied)
- PostCSS 8.5.3 - CSS processing for Tailwind
- Autoprefixer 10.4.20 - Vendor prefixing
- React i18next 17.0.2 - Internationalization framework (declarations present; implementation TBD)
- Express 4.21.0 - HTTP server framework; entry point `server/src/index.ts`
- Prisma 6.19.2 - ORM; schema at `server/prisma/schema.prisma`
- TypeScript 5.8.2 - Type safety
- Vitest 4.1.4 - Test runner (server-side); config at `server/vitest.config.ts`
- Supertest 7.2.2 - HTTP assertion library for Express route testing
- Global test environment: Node (no browser testing framework detected)
- tsx 4.19.2 - TypeScript executor for development and scripts (`npm run dev` via `tsx watch`)
- TSC (TypeScript 5.8.2) - Type checking and compilation
- Vite 8.0.3 - Frontend bundling
## Key Dependencies
- `@google/generative-ai` 0.21.0 - Google Gemini 2.5 Flash LLM client; used in `server/src/lib/gemini.ts`
- `@prisma/client` 6.19.2 - Prisma database client (server); generated from schema
- `@libsql/client` 0.14.0 (server) / 0.17.2 (root) - LibSQL HTTP client for Turso; version drift noted
- `@prisma/adapter-libsql` 6.0.0 (server) / 7.6.0 (root) - Prisma adapter for LibSQL; major version mismatch between root (7.x, unused) and server (6.x)
- `cors` 2.8.5 - CORS middleware for Express; hardcoded whitelist in `server/src/index.ts:26-42`
- `express` 4.21.0 - HTTP framework
- `multer` 1.4.5-lts.1 - File upload middleware; max 25 MB, `.docx` filter in `server/src/routes/upload.ts`
- `mammoth` 1.8.0 - `.docx` → text extractor; used in `server/src/routes/upload.ts:28-44`
- `pdfkit` 0.18.0 - PDF generation (referenced in imports but usage TBD)
- `dotenv` 17.3.1 - Environment variable loader (`server/src/env.ts` loads from `../../.env`)
- `better-sqlite3` 12.8.0 - SQLite driver (local dev); adapter at `@prisma/adapter-better-sqlite3@7.6.0` (server lockfile shows v7, major version mismatch with Prisma v6)
- `axios` 1.8.4 - HTTP client; instance at `src/api.ts` with `VITE_API_URL` base
- `clsx` 2.1.1 - Conditional class name builder
- `react-dom` 18.3.1 - React DOM bindings
- `i18next` 26.0.4 - i18n engine (not currently wired to content)
- `react-i18next` 17.0.2 - React bindings for i18next
- `@types/react` 18.3.20, `@types/react-dom` 18.3.6 - React types
- `@types/express` 4.17.21, `@types/cors` 2.8.17, `@types/multer` 1.4.12, `@types/node` 22.9.0 - Server types
- `@types/pdfkit` 0.17.6 - PDFKit types
- `@types/supertest` 7.2.0 - Supertest types
- `@vitejs/plugin-react` 6.0.1 - React Fast Refresh for Vite
- `typescript` 5.8.2 - TypeScript compiler (both root and server)
## Configuration
- `VITE_API_URL` - Frontend API base URL (dev: `http://localhost:3000`)
- `TURSO_DATABASE_URL` - LibSQL database URL (production)
- `TURSO_AUTH_TOKEN` - Turso JWT token (production)
- `GEMINI_API_KEY` - Google AI Studio API key for Gemini 2.5 Flash
- `PRISMA_DATABASE_URL` - Local SQLite URL for Prisma CLI (defaults to `file:./dev.db`)
- `ALLOWED_ORIGINS` - Comma-separated extra CORS origins (default: `*.vercel.app`, `localhost:5173`)
- `PORT` - Server listen port (default: 3000)
- `target: ES2022`, `module: ESNext` (frontend)
- `strict: true` (both)
- Missing: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noImplicitOverride` (noted in REVIEW-config.md)
- `target: ES2022`, `module: NodeNext`
- `strict: true`
- `rootDir: src`, `outDir: dist`
- Excludes test files but misses `server/scripts/**/*.ts` (not compiled)
- No dev proxy, no sourcemap settings, no build target pin
- Bare config; relies on Vite defaults
- SPA rewrite only; no custom headers or environment configuration
- Captures `/api/*` if ever co-hosted (noted in REVIEW-config.md)
- Datasource: `provider = "sqlite"`, `url = env("PRISMA_DATABASE_URL")`
- Runtime adapter injected in `server/src/lib/db.ts`: LibSQL (Turso) for production
- Migrations at `server/prisma/migrations/`; deployment via `npm run db:migrate:deploy` (uses `scripts/applyTursoMigrations.ts`)
## Platform Requirements
- Node.js 18+ (no enforcement via `.nvmrc` or `engines` field)
- npm CLI
- Bash 4.3+ for `start.sh` (currently assumes `#!/usr/bin/env bash`)
- TURSO_DATABASE_URL + TURSO_AUTH_TOKEN for local testing against production Turso (optional; can use local SQLite)
- Vercel deployment (`vercel.json` configured for SPA routes)
- Static hosting; environment variables via Vercel project settings (`VITE_API_URL` at build time)
- Node.js 18+ runtime
- Railway or custom host (per README); environment variables via host secret manager
- Prisma migrations require `tsx` (currently in devDependencies; noted as deployment issue in REVIEW-config.md)
- Turso database (LibSQL HTTP)
- Google Gemini 2.5 Flash (API endpoint, requires `GEMINI_API_KEY`)
- Turso (LibSQL) for production; local SQLite for development
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components: `PascalCase` (e.g., `ChatMessage.tsx`, `ChatInput.tsx`, `UploadZone.tsx`)
- Utility modules: `camelCase` (e.g., `api.ts`, `types.ts`, `intent.ts`, `breadth.ts`)
- Route modules: `camelCase` (e.g., `chat.ts`, `upload.ts`, `lessons.ts`)
- Test files: `[module].test.ts` or `[module].integration.test.ts` in `src/__tests__/` directory
- Utility functions: `camelCase` (e.g., `detectIntent`, `filterMessage`, `stripPII`, `classifyBreadth`)
- React hooks: `camelCase` with `use` prefix when custom (e.g., `useMemo` in ChatMessage.tsx)
- Handler functions: `camelCase` prefixed with event context (e.g., `onSubmit`, `onKeyDown`, `onFollowUpClick`)
- Helper sub-functions: `PascalCase` when they're component sub-functions (e.g., `AssistantAvatar()`, `ThumbIcon()`, `HandoutSuggestion()`)
- Local constants: `UPPER_SNAKE_CASE` for module-level constants (e.g., `DOMAIN_KEYWORDS` in `intent.ts`)
- Set collections: `camelCase` for logic (e.g., `stopwords`, `lessonTokens`)
- Props objects: `camelCase` (e.g., `onFollowUpClick`, `onRate`, `timeoutMs`)
- Type guard prefixes: `is` or `has` (e.g., `isUser = message.role === "user"`)
- React component props: `{ComponentName}Props` (e.g., `ChatMessageProps`, `ChatInputProps`)
- Domain types: `PascalCase` (e.g., `ChatRole`, `Handout`, `ChatMessageType`, `Intent`, `IntentResult`)
- Type unions: `PascalCase` (e.g., `ToastType = "success" | "error"`)
- Enums-like unions: `camelCase` for discriminant values (e.g., `"thumbs_up" | "thumbs_down"`)
## Code Style
- **No ESLint or Prettier config exists** — TypeScript catches type errors but not formatting, unused imports, or React hooks rules
- **Implicit conventions inferred from code:**
- **No linter active** — TypeScript `strict: true` is enabled in both root (`tsconfig.app.json:14`) and server (`server/tsconfig.json:8`), which catches:
- **Known gaps:** No enforcement for:
## Import Organization
- No path aliases configured in either `tsconfig.app.json` or `server/tsconfig.json`
- Relative imports used throughout: `../lib/intent`, `../types`, `../routes/chat`
## Error Handling
- API calls wrapped in `try/catch` at component level or via axios interceptor
- Error responses assumed to have `{ error: string }` shape (from `src/api.ts` types)
- No standardized error boundary — errors bubble to caller
- **Route pattern:** `try/catch` wrapping entire async handler (see `chat.ts:37-176`, `upload.ts:21-54`)
- **Error response shape:** `{ error: err.message }` with status code set (typically `400`, `500`)
- **Security issue (flagged in review):** `err.message` is returned to client, leaking implementation details (e.g., Prisma constraint errors, Gemini API details, filesystem paths)
- **Recommendation (HIGH):** Log full error server-side, return generic message to client:
- **Validation pattern:** Guards return early with `400` status (e.g., `chat.ts:41-43`)
- **No centralized error middleware** — each route handles its own errors
## Logging
- No structured logging — console.log used ad hoc if at all
- No correlation IDs or request tracing
- **Framework:** `console.log` and `console.error` only
- **Pattern:** Free-form strings, no JSON structure
- **What gets logged:**
- **Issue (flagged as ME-11):** No structured logs, no levels, no audit trail — makes production debugging difficult and violates compliance requirements for auth-gated routes
- **Recommendation:** Adopt `pino` or equivalent for JSON-structured logs with request IDs
## Comments
- Complex algorithm explanation (see `intent.ts` for intent detection logic)
- Non-obvious design choice (e.g., `chat.ts:106-110` on breadth classification timing)
- Security boundary or invariant (e.g., `upload.ts:31-38` on lesson cleanup)
- Disabled code or temporary workaround (observed but sparse in codebase)
- **Sparse usage** — only on public functions that need documentation
- **Examples:**
- **Not used for obvious functions** — `onSubmit`, `filterMessage`, simple getters are uncommented
## Function Design
- Utility functions: typically 10-40 lines (e.g., `stripPII` in `privacy.ts`)
- Route handlers: 40-180 lines with internal helpers (e.g., `chat.ts:37-177`)
- Component render: 30-100 lines including nested sub-components
- **No hard limit enforced**, but long functions are split into sub-helpers or extracted to modules
- Explicit typed params preferred over destructuring in complex cases
- Destructuring used for props in React components (e.g., `ChatMessage({ message, onFollowUpClick, onRate })`)
- Callback functions passed as individual props, not object destructured
- Explicit type annotations on functions (`function foo(): ReturnType`)
- Void functions common in event handlers
- Promise-returning async functions are typed: `async function foo(): Promise<T>`
- Early returns used to flatten nested conditions (see `chat.ts:40-43`)
## Module Design
- Named exports for utility functions (e.g., `export function stripPII(...)`)
- Default exports for React components (e.g., `export default ChatMessage`)
- Type exports mixed with value exports in shared files (e.g., `src/api.ts` exports both types and functions)
- No barrel file pattern at root (`src/index.ts` doesn't exist); imports go directly to modules
- Not used in frontend (`src/components/` has no `index.ts`)
- Server routes are individual files without barrel export
- Explicit imports from each file preferred over re-exports
## TypeScript-Specific Patterns
- `strict: true` enabled in both `tsconfig.app.json` and `server/tsconfig.json`
- No `any` type casts in observable code (very strict, enforced by implicit convention)
- Optional properties marked with `?` (e.g., `followUp?: string` in ChatMessageType)
- Union types used for discriminated variants (e.g., `ChatRole = "user" | "assistant"`)
- Used on constants that should not be widened: `as const` on string literal arrays
- Not observed in current codebase but would be appropriate for `DOMAIN_KEYWORDS`, `STOPWORDS`
- `typeof` checks common (e.g., `typeof body.message === "string"`)
- `instanceof` used for error checking (e.g., `err instanceof Error`)
- No formal type guard functions (e.g., `is` functions) in codebase
## API Contracts
- Frontend defines types in `src/api.ts` alongside axios functions
- Named exports: `ChatRequestBody`, `ChatResponse`, `AnalyticsData`, `LessonVocabularySummary`
- Server routes use inline types on `req.body` (unvalidated, typed as `any` then narrowed)
- Error responses: `{ error: string }` — documented implicitly through code
- Defined in `src/api.ts:1-8` as exported `api` instance
- Base URL set from `VITE_API_URL` env var
- Timeout: 15 seconds (hardcoded)
- Used by all frontend API calls via named function wrappers (e.g., `postChat`, `rateMessage`, `getAnalytics`)
## Styling Conventions
- Tailwind CSS used exclusively (no CSS files, no styled-components)
- `clsx` for conditional class composition (imported in components that use conditionals)
- Component classes: shadow/rounded/spacing via Tailwind utilities
- Color tokens: custom Tailwind theme (e.g., `brand-gradient`, `brand-navy`, `brand-ink`, `brand-mist`)
- No inline `style` prop observed except for `aria-hidden` SVG attributes
- No styling (backend API only)
## Accessibility
- `aria-label` on icon-only buttons (e.g., `ChatMessage.tsx:107` on thumbs buttons)
- `aria-hidden` on decorative SVGs (observed throughout)
- No ARIA landmarks or region roles observed
- Semantic HTML: buttons are `<button>`, links are `<a>`, forms are `<form>`
- **No ESLint a11y plugin** — accessibility checks not automated
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| ChatPage | Learner chat interface, session management, role-play modes | `src/pages/ChatPage.tsx` |
| AdminPage | Lesson upload, lesson management, analytics dashboard | `src/pages/AdminPage.tsx` |
| EmbedChatPage | Embeddable chat widget (iframe) | `src/pages/EmbedChatPage.tsx` |
| Chat Router | POST /api/chat endpoint, orchestrates intent detection → LLM → response | `server/src/routes/chat.ts` |
| Upload Router | POST /api/upload endpoint, .docx parsing, content cleaning | `server/src/routes/upload.ts` |
| Lessons Router | GET /api/lessons, lesson metadata, vocabulary extraction | `server/src/routes/lessons.ts` |
| Rating Router | POST /api/rating endpoint, thumbs up/down feedback | `server/src/routes/rating.ts` |
| Analytics Router | GET /api/analytics endpoint, session/message stats | `server/src/routes/analytics.ts` |
| Intent Detection | Keyword-based intent classification (8 types) | `server/src/lib/intent.ts` |
| Complexity Classifier | Simple vs. complex prompt detection | `server/src/lib/complexity.ts` |
| Breadth Classifier | Broad vs. focused question detection | `server/src/lib/breadth.ts` |
| Escalation Checker | Detects safety/crisis keywords | `server/src/lib/escalation.ts` |
| Content Filter | Blocks off-topic messages | `server/src/lib/contentFilter.ts` |
| Privacy Module | PII redaction before storage | `server/src/lib/privacy.ts` |
| Gemini Integration | LLM calls with system instruction | `server/src/lib/gemini.ts` |
| Handout Manager | Contextual worksheet suggestions | `server/src/lib/handouts.ts` |
| Vocabulary Extractor | Glossary parsing from lessons | `server/src/lib/vocabulary.ts` |
| Database | Prisma client with Turso adapter | `server/src/lib/db.ts` |
## Pattern Overview
- Single-origin API communication (axios) between frontend and Express backend
- Content-filtered, PII-redacted, safety-escalated message flow
- Intent-driven lesson matching: user message → keyword detection → relevant lesson docs → system instruction for Gemini
- Role-play and coaching modes with progressive disclosure
- Session persistence: each learner gets a CUID session ID that persists across page reloads
- Multi-language support (i18n) on frontend, single language backend responses
## Layers
- Purpose: User-facing learner interface + admin console
- Location: `src/`
- Contains: React components (TSX), pages, API client, localization, styles (Tailwind CSS)
- Depends on: Express backend via `src/api.ts`, i18n, react-router-dom
- Used by: Browser clients, embedded iframes
- Purpose: REST endpoint handler, session routing, request validation
- Location: `server/src/index.ts`
- Contains: CORS configuration, error handling, route mounting
- Depends on: Route handlers, Prisma, middleware (express.json, cors)
- Used by: Frontend, external integrations
- Purpose: HTTP request → business logic → response
- Location: `server/src/routes/`
- Contains: chat.ts (main intelligence flow), upload.ts (file processing), lessons.ts (lesson queries), rating.ts (feedback), analytics.ts (telemetry), rating.ts
- Depends on: Intent detection, LLM calls, Prisma, content filtering, privacy
- Used by: Express app
- Purpose: Determine learner intent, prompt complexity, escalation triggers
- Location: `server/src/lib/intent.ts`, `complexity.ts`, `breadth.ts`, `escalation.ts`
- Contains: Heuristic classifiers, keyword matching, rule engines
- Depends on: None (pure functions)
- Used by: Chat route to customize response behavior
- Purpose: Filter messages, redact PII, prevent off-topic responses
- Location: `server/src/lib/contentFilter.ts`, `privacy.ts`
- Contains: Regex filters, keyword blocklists, anonymization rules
- Depends on: None (pure functions)
- Used by: Chat route before message storage
- Purpose: System instruction building, Gemini API calls, response generation
- Location: `server/src/lib/gemini.ts`
- Contains: System prompt templates, model invocation, streaming response handling
- Depends on: Complexity/breadth classifiers, lesson context, conversation history
- Used by: Chat route to generate learner responses
- Purpose: Object-relational mapping, migrations, database queries
- Location: `server/src/lib/db.ts`, `server/prisma/`
- Contains: Prisma client, schema definition, migrations
- Depends on: Turso database (libSQL) at runtime
- Used by: All route handlers, cleanup scripts
## Data Flow
### Primary Request Path: Chat Message
### Secondary Flow: Lesson Upload
### Tertiary Flow: Analytics
- GET /api/analytics aggregates intentLog + message counts
- Tracks intent distribution, lesson popularity, feedback summary
### Cleanup Flow
- POST /api/cleanup runs `cleanExpiredSessions()` from `lib/privacy.ts`
- Deletes sessions > 30 days old (data retention)
- Tracked separately for manual or cron-triggered execution
## Key Abstractions
- Purpose: Represents learner's underlying need (feedback, boundary-setting, clarification, etc.)
- Examples: `lib/intent.ts` exports 8 intent types
- Pattern: Exhaustive type discrimination, matched against keyword rules
- Purpose: Customize response depth and disclosure strategy without asking user
- Examples: `lib/complexity.ts` (simple vs. complex), `lib/breadth.ts` (broad vs. focused)
- Pattern: Heuristic scoring (word count, keywords, question marks, etc.), returns numeric score + signals
- Purpose: Worksheet reference with title and optional URL
- Examples: `lib/handouts.ts` defines `type Handout = { title: string; url?: string }`
- Pattern: Parsed from lesson content at upload, encoded as JSON string in DB, suggested contextually
- Purpose: Grounding content for LLM system instruction
- Examples: Array of `{ name, content }` selected by intent matching
- Pattern: Deduped across matched lessons, limits to 1-3 most relevant
- Purpose: Safety banner prepended to response if crisis keywords detected
- Examples: `lib/escalation.ts` returns `{ escalated, category, message }`
- Pattern: Detected before LLM call, appended after response, affects logging
## Entry Points
- Location: `src/main.tsx`
- Triggers: Browser load
- Responsibilities: Hydrate React root, initialize BrowserRouter, load i18n
- Location: `src/App.tsx`
- Routes: `/` → `/chat` (default), `/admin`, `/embed`, `/widget`
- Pages: ChatPage (learner), AdminPage (admin), EmbedChatPage (iframe), WidgetPage (iframe variant)
- Location: `server/src/index.ts`
- Triggers: `npm run dev` (tsx watch) or node process start
- Responsibilities: Create Express app, mount routers, listen on PORT (default 3000)
- Route: `POST /api/chat`
- Endpoint: `server/src/routes/chat.ts` line 37
- Handler: Async function that processes request body through full intelligence pipeline
- Route: `POST /api/upload`
- Endpoint: `server/src/routes/upload.ts` line 21
- Handler: Multer middleware → mammoth extraction → DB storage
## Architectural Constraints
- **Threading:** Single-threaded event loop (Node.js). Chat requests are async but sequential per session. No explicit worker threads.
- **Global state:** Prisma client singleton in `server/src/lib/db.ts` (module-level export). Environment validation on startup.
- **Circular imports:** None detected. Layers have clean dependency hierarchy: routes → lib → pure functions.
- **Message size limits:** 25MB file upload limit (multer config), no hard message content limit but Gemini API has token constraints.
- **Session persistence:** In-memory session creation (CUID), persisted to Turso immediately. Session ID can be reused across frontend page reloads.
- **Role-play modes:** Frontend passes `mode: "roleplay" | "roleplay_feedback"` to chat route. System instruction shape differs but same flow.
- **Concurrency:** All database operations go through Prisma ORM. No explicit transaction boundaries in chat flow (single request = single session update).
## Anti-Patterns
### Storing Blocked Content
### Deduping Handouts with Manual IntentLog Rows
### PII Redaction Before Storage (Misplaced Timing)
## Error Handling
- Message validation: return 400 with "message is required"
- File upload validation: multer filters + handler checks (return 400 if missing)
- Database errors: catch and return 500 with error text
- LLM errors: catch from Gemini call, pass to frontend in response
- Missing env vars: throw on startup in `server/src/lib/db.ts` (fail-fast)
## Cross-Cutting Concerns
- Message: required, non-empty string (line 40-44 chat.ts)
- Files: MIME type + extension check (upload.ts lines 11-15)
- Intent: type discrimination (intent.ts Intent union type)
- Env vars: checked on startup, throws if missing
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| gstack | \| Fast headless browser for QA testing and site dogfooding. Navigate pages, interact with elements, verify state, diff before/after, take annotated screenshots, test responsive layouts, forms, uploads, dialogs, and capture bug evidence. Use when asked to open or test a site, verify a deployment, dogfood a user flow, or file a bug with screenshots. (gstack) | `.claude/skills/gstack/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
