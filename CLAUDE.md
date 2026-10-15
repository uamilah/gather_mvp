# Gather MVP — rules for every AI agent (Claude Code, Replit Agent)

Two people vibecode this repo at the same time. These rules keep us from overwriting each other.

## Workflow
- `main` is the source of truth. Never commit straight to `main`.
- Pull `main` before starting anything. One small branch per feature: `<name>/<feature>` (e.g. `andrew/rsvp`).
- Merge through a pull request, within hours, not days. Small PRs beat big ones.
- Stay inside the area you said you're working on. Don't restructure folders, rename shared things, or reformat files you didn't need to touch.
- Database schema (`lib/db/src/schema`) and the API contract (`lib/api-spec`) are shared: say so before changing them, and only one person changes them at a time.

## Repo map
- `artifacts/group-events` — the web app (React + Vite + Tailwind)
- `artifacts/api-server` — API (Express 5), incl. Slack event extraction (`src/lib/slack-events.ts`)
- `artifacts/mockup-sandbox` — Replit's design canvas, not the product
- `lib/db` — Postgres schema (Drizzle). `lib/api-spec` — OpenAPI spec; `lib/api-zod` + `lib/api-client-react` are GENERATED from it
- Product spec: `PRD.md` (once added)

## Commands
- `pnpm install` — install (pnpm only, never npm/yarn)
- `pnpm run typecheck` — must pass before opening a PR
- `pnpm --filter @workspace/api-spec run codegen` — after editing the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push schema changes (dev DB only)
- Needs `DATABASE_URL`. Slack goes through Replit Connectors, so it only works inside Replit.
