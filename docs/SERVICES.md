# Services & Costs Inventory

A single source of truth for every external service the AI Lesson Coach project depends on -- what each service does, how much it costs, who owns the account, and what to do when we hit a tier limit.

**Last updated:** 2026-04-26

> All prices below are taken from each provider's public pricing page. Prices and free-tier limits change frequently; for anything load-bearing, cross-check the linked pricing page before making a budgeting decision. Items marked `verify on provider dashboard` are values that depend on the specific account/plan and cannot be confirmed from the repo alone.

## Inventory

| Service | What we use it for | Current tier / plan | Pricing | Account owner / credentials | Upgrade path |
|---|---|---|---|---|---|
| **Google Gemini API** ([pricing](https://ai.google.dev/gemini-api/docs/pricing)) | LLM inference. Every `/api/chat` request hits `gemini-2.5-flash` with the conversation history + matched lesson content as a system instruction. See `server/src/lib/gemini.ts`. | Free tier via Google AI Studio (default for an API key with no billing account attached). Production should be on the paid tier. `verify on provider dashboard`. | Free tier: rate-limited (RPM/RPD caps that change periodically; check the pricing page). Paid `gemini-2.5-flash`: priced per million input/output tokens; rates change -- consult the pricing page above. No monthly minimum on pay-as-you-go. | Key: `GEMINI_API_KEY` env var (root `.env`). Issued from Google AI Studio. Owner: `verify on provider dashboard`. | Attach a billing account in Google AI Studio / Google Cloud to move from free tier to pay-as-you-go. For higher throughput, request quota increase or move to Vertex AI. |
| **Turso** (LibSQL) ([pricing](https://turso.tech/pricing)) | Production database. Stores `Session`, `Message`, `IntentLog`, and `Lesson` rows via Prisma + `@prisma/adapter-libsql`. See `server/prisma/schema.prisma` and `server/src/lib/db.ts`. | `verify on provider dashboard` -- likely Starter/Hobby (free) given hobby-scale usage. | Free Starter tier: bounded number of databases, total storage, monthly row reads/writes (limits change -- see pricing page). Paid plans (Scaler / Pro) start at a fixed monthly fee with higher quotas; overage billed per million row reads/writes. | Keys: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` env vars (root `.env`). Owner: `verify on provider dashboard`. | Upgrade plan in the Turso dashboard. If row-read volume becomes the binding constraint, add caching in front of read-heavy endpoints (`/api/lessons`, analytics) before paying for a higher tier. |
| **Vercel** ([pricing](https://vercel.com/pricing)) | Frontend hosting (React + Vite SPA). `vercel.json` rewrites all paths to `/` for client-side routing. Preview deploys on every PR. | `verify on provider dashboard` -- Hobby (free) is consistent with the current setup; no team features in use. | Hobby: free, with bandwidth, build-minute, and serverless-invocation caps (limits on the pricing page). Pro: USD 20 / member / month plus usage-based overages. | Vercel project linked to the GitHub repo. Owner: `verify on provider dashboard`. No secrets stored in the repo; `VITE_API_URL` is set in the Vercel project's environment-variable UI. | Upgrade to Pro from the Vercel dashboard. Most likely trigger: bandwidth or build minutes if traffic / PR volume grows. |
| **Server hosting** (Express API) | Hosts the Node/Express API at the URL the frontend's `VITE_API_URL` points at. The README and `server/src/index.ts` reference Railway as the intended target ("Server can be deployed to Railway, Render, or any Node.js hosting"); there is no `railway.json`, `render.yaml`, `fly.toml`, `Procfile`, or `Dockerfile` in the repo, so the live deployment target is `verify on provider dashboard`. | `verify on provider dashboard`. | If on **Railway**: usage-based, with a small monthly free credit on the Hobby plan and a USD 5 / month minimum thereafter; CPU + memory + egress metered. ([pricing](https://railway.com/pricing)) <br> If on **Render**: free web-service tier sleeps on idle; Starter paid tier starts at USD 7 / month per service. ([pricing](https://render.com/pricing)) | Provider account + deploy credentials live with whoever set up the deploy. Required runtime env vars: `GEMINI_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `PORT` (optional), `ALLOWED_ORIGINS` (optional). | Upgrade plan in the provider dashboard. If memory becomes the binding constraint, profile lesson-text loading first -- it is the largest payload sent per request. Add a `Dockerfile` / `railway.json` to the repo so the deploy target is checked in. |
| **GitHub** ([pricing](https://github.com/pricing)) | Source hosting + PR review for `Gurehmat/AI-Chatbot`. Required for Vercel's Git integration to function. | Free (public-repo features sufficient). | Free for public repos. Team/Enterprise plans for orgs that need SSO, advanced security, or higher Actions minutes. | Repo: `Gurehmat/AI-Chatbot`. Owner: `Gurehmat` (org/user). | Upgrade in GitHub billing settings if Actions minutes, Codespaces, or advanced security become needed. |

## Services explicitly **not** in use

These would normally appear in an inventory like this; they are not wired up today, so adding any of them is a deliberate decision that should also update this doc:

- No analytics SDK (no PostHog, Mixpanel, GA, Segment).
- No error/perf monitoring (no Sentry, Datadog, New Relic).
- No transactional email or SMS (no SendGrid, Postmark, Twilio, Resend).
- No object storage / CDN beyond Vercel's built-in (no S3, R2, Cloudinary). Uploaded `.docx` content is parsed in-memory by `mammoth` and the extracted text is stored as a column on `Lesson`; the original file is discarded.
- No payment processor (no Stripe).

## How to keep this current

This doc is only useful if it stays accurate. Update it in the **same PR** as any of the following changes, and bump `Last updated` to that PR's date:

1. **A new env var lands in `.env.example`** -- almost always implies a new external service. Add a row.
2. **A new SDK dependency lands in `package.json` or `server/package.json`** that calls a hosted service (LLM, DB, analytics, monitoring, email, payments, storage, queues). Add a row.
3. **The deploy target changes** for the frontend or the server (e.g., a `Dockerfile`, `railway.json`, `render.yaml`, `fly.toml`, or new Vercel project). Update the relevant row.
4. **A plan / tier changes on any provider dashboard.** Update the row and the `Last updated` date.
5. **A service is removed.** Delete the row rather than leaving a stale entry; note it in the PR description.

Quarterly (or before any budgeting / capacity-planning conversation), re-verify every `verify on provider dashboard` entry against the live account and refresh `Last updated`.
