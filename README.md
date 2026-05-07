# AI Lesson Coach - Workplace Edge

An AI-powered communication skills training chatbot for Workplace Edge. Admins upload `.docx` lesson documents; learners chat with an AI that answers strictly from those lesson materials using the Google Gemini APi. 

## Architecture

```
┌────────────────┐       ┌─────────────────┐       ┌───────────────┐
│ React Frontend │──API──│  Express Server │──LLM──│ Google Gemini │
│ (Vite + TS)    │       │  (TypeScript)   │       │ (2.5 Flash)   │
└────────────────┘       └────────┬────────┘       └───────────────┘
                                  │
                          ┌───────┴────────┐
                          │ SQLite / Turso │
                          │ (Prisma ORM)   │
                          └────────────────┘
```

**Monorepo** with two independent packages:
- **Root (`/`)** -- React 18 + Vite frontend (TypeScript, Tailwind CSS)
- **`/server`** -- Express API server (TypeScript)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, Tailwind CSS, react-i18next |
| Backend | Express, TypeScript, tsx (dev) |
| LLM | Google Gemini 2.5 Flash |
| Database | Prisma ORM + Turso (LibSQL) / SQLite |
| File Parsing | Mammoth (.docx to text) |
| Deployment | Vercel (frontend), Railway/custom (server) |

## Features

- **Chat Interface** with intent-based coaching (Give Feedback, Set Boundaries, Push Back, Clarify Tasks, General Coaching)
- **Three-beat coaching structure** (validate, teach, suggest practice) shaped by an internal scaffolding framework that is intentionally never named to the learner
- **Follow-up Suggestion Chips** parsed from AI responses
- **Practice Mode** -- 2-turn role-play with AI-as-difficult-coworker + coaching feedback
- **Thumbs Up/Down Rating** on AI responses
- **Content Safety Filter** blocks inappropriate content before LLM
- **Escalation Detection** for sensitive topics (harassment, self-harm, legal)
- **PII Redaction** strips personal data before database storage
- **HR Disclaimer** in UI and system prompt
- **Admin Dashboard** with lesson management and analytics
- **SCORM/iframe Embed** route for LMS integration
- **Collapsible Widget** mode for embedding as a floating chat button
- **i18n Framework** ready for multilingual expansion

## Prerequisites

- Node.js 18+
- npm

## Setup

1. Clone the repository:
```bash
git clone https://github.com/Gurehmat/AI-Chatbot.git
cd AI-Chatbot
```

2. Copy environment file and fill in values:
```bash
cp .env.example .env
```

Required variables:
- `VITE_API_URL` -- API server URL (e.g., `http://localhost:3000`)
- `TURSO_DATABASE_URL` -- Turso database URL (or `file:./dev.db` for local SQLite)
- `TURSO_AUTH_TOKEN` -- Turso auth token
- `GEMINI_API_KEY` -- Google AI Studio API key
- `ADMIN_API_TOKEN` -- Shared bearer token used to unlock `/admin` and call protected admin API routes

3. Install dependencies:
```bash
npm install                # Frontend
cd server && npm install   # Server (auto-runs `prisma generate` via postinstall)
```

4. Provision your Turso database:

Migration history is committed to `server/prisma/migrations/`. To apply it to a fresh (or existing) Turso database:

```bash
cd server
npm run db:migrate:deploy
```

This applies any pending migrations to whatever `TURSO_DATABASE_URL` is in your `.env` and tracks state in a `_prisma_migrations` table. The baseline migration uses `CREATE TABLE IF NOT EXISTS`, so it is safe against a database that was previously provisioned via the old manual `turso db shell` workflow.

> ⚠️ `db:migrate:deploy` writes to whatever `TURSO_DATABASE_URL` is in your `.env`. Confirm the URL before running.

For schema changes during development, see [CLAUDE.md → Database migrations](./CLAUDE.md#database-migrations) — author migrations locally with `npm run db:migrate:dev`, commit the generated `prisma/migrations/` directory, then deploy with `db:migrate:deploy`.

5. Start development servers:
```bash
# Terminal 1 -- Frontend (port 5173)
npm run dev

# Terminal 2 -- Server (port 3000)
cd server && npm run dev
```

## Project Structure

```
/
├── src/                    # Frontend source
│   ├── pages/              # ChatPage, AdminPage, EmbedChatPage, WidgetPage
│   ├── components/         # Reusable UI components
│   ├── api.ts              # Axios API client
│   ├── types.ts            # TypeScript interfaces
│   ├── i18n.ts             # i18n configuration
│   └── locales/en.json     # English translations
├── server/
│   ├── src/
│   │   ├── routes/         # Express route handlers
│   │   ├── lib/            # Core logic (gemini, intent, escalation, etc.)
│   │   └── __tests__/      # Vitest test suite
│   └── prisma/schema.prisma
├── docs/                   # Documentation
└── .env.example
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/chat` | Send message, get AI response |
| GET | `/api/admin/session` | Validate admin token (admin token required) |
| POST | `/api/upload` | Upload .docx lesson file (admin token required) |
| GET | `/api/lessons` | List all lessons |
| DELETE | `/api/lessons/:id` | Delete a lesson (admin token required) |
| POST | `/api/rating` | Rate an AI response |
| GET | `/api/analytics` | Get telemetry/analytics data (admin token required) |
| POST | `/api/cleanup` | Delete expired sessions (30-day retention, admin token required) |

## Frontend Routes

| Path | Description |
|------|-------------|
| `/chat` | Main learner chat interface |
| `/admin` | Token-unlocked lesson upload/management + analytics |
| `/embed` | Minimal chrome chat for iframe embedding |
| `/widget` | Collapsible floating chat widget |

## Testing

```bash
cd server
npm test           # Run all tests
npm run test:watch # Watch mode
```

## Build & Deploy

```bash
# Frontend build (outputs to dist/)
npm run build

# Server build (outputs to server/dist/)
cd server && npm run build
```

Frontend is configured for Vercel deployment (`vercel.json` handles SPA routing). Server can be deployed to Railway, Render, or any Node.js hosting.

## Documentation

- [User Guide](docs/USER_GUIDE.md)
- [Admin Guide](docs/ADMIN_GUIDE.md)
- [SCORM Integration](docs/SCORM_INTEGRATION.md)
- [Technical Report](docs/TECHNICAL_REPORT.md)
- [Ethical Analysis](docs/ETHICAL_ANALYSIS.md)
- [Stakeholder Presentation](docs/PRESENTATION.md)
