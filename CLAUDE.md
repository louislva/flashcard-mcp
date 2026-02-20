# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
npm install
npm run build    # tsc → dist/
npm start        # node dist/index.js (stdio mode)
```

No test framework is configured.

## Architecture

This is a **dual-mode MCP (Model Context Protocol) flashcard server** — it runs either locally via stdio or as Vercel serverless functions over HTTP, with OAuth 2.1 auth.

### Two entry points

- **`src/index.ts`** — CLI/stdio mode. Uses `FileStore` (reads/writes `flashcards.json` locally). Intended for direct MCP client connections (e.g. Claude Desktop).
- **`api/mcp.ts`** — HTTP mode. Uses `KVStore` (Upstash Redis). Deployed as a Vercel serverless function with OAuth 2.1 Bearer token validation.

### Storage abstraction

`StoreBackend` interface (`src/store.ts`) abstracts persistence. Two implementations:
- `FileStore` (`src/store.ts`) — local JSON file
- `KVStore` (`src/kv-store.ts`) — Upstash Redis via `@upstash/redis`

Both store the same shape: `{ projects: Project[], flashcards: Flashcard[] }`.

### Tool registration

`src/tools.ts` exports `registerTools(server, store)` which wires up all 8 MCP tools (CRUD for projects/flashcards, due card retrieval, review recording). The tools are framework-agnostic — they take a `StoreBackend` and work identically in both modes.

### Spaced repetition

`src/sr.ts` implements SM-2. Quality 1-2 resets progress; quality 3-4 advances intervals (1d → 3d → ease_factor multiplier). Ease factor floors at 1.3.

### OAuth 2.1 (Vercel only)

PKCE-only flow for public clients. The `api/` directory contains the full OAuth server:
- `api/authorize.ts` — login form + authorization code grant
- `api/token.ts` — code-for-token exchange with PKCE verification
- `api/register.ts` — dynamic client registration
- `api/oauth-metadata.ts` / `api/resource-metadata.ts` — `.well-known` endpoints
- `src/oauth.ts` — shared utilities (PKCE, token validation, client management)

All OAuth state (codes, tokens, clients) stored in Upstash Redis with TTLs.

## Environment Variables

For Vercel/HTTP mode:
- `KV_REST_API_URL` — Upstash Redis REST endpoint (required)
- `KV_REST_API_TOKEN` — Upstash REST API token (required)
- `FLASHCARD_API_KEY` — optional static Bearer token (legacy, OAuth preferred)

## Key Conventions

- ES Modules throughout (`"type": "module"` in package.json)
- TypeScript strict mode, target ES2022, module Node16
- Vercel functions live in `api/`, compiled source in `src/` → `dist/`
