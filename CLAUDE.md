# CLAUDE.md — Conspire Proof SDK

CIA's self-hosted fork of [EveryInc/proof-sdk](https://github.com/EveryInc/proof-sdk) (MIT license).
Collaborative markdown editor for the **Conspire** platform — Milkdown (ProseMirror) editor, Yjs CRDTs for real-time collaboration, and an agent bridge API for programmatic document editing.

## How to Run

```bash
npm install
npm run serve        # Express server on port 4000
npm run dev          # Vite dev server (frontend) on port 3000
npm run build        # Production frontend build → dist/
npm test             # Run test suite
```

Database: `proof-share.db` (SQLite via better-sqlite3). Override path with `DATABASE_PATH` env var.

CORS: set `PROOF_CORS_ALLOW_ORIGINS` (comma-separated origins). Defaults to localhost:3000/4000.

## Key Architecture

| File | Role |
|------|------|
| `server/index.ts` | Express server entry, CORS, route mounting, WebSocket setup |
| `server/db.ts` | SQLite document storage (better-sqlite3) |
| `server/agent-routes.ts` | Agent bridge API endpoints |
| `server/bridge.ts` | Bridge mount router (`/d/:slug`, `/documents/:slug`) |
| `server/collab.ts` | Yjs collaboration runtime (Hocuspocus) |
| `server/routes.ts` | Core API routes |
| `server/document-engine.ts` | Document lifecycle operations |
| `server/agent-edit-v2.ts` | Block-level edit engine (v2) |
| `server/agent-snapshot.ts` | Snapshot generation for v2 edits |
| `server/ws.ts` | WebSocket handler for collab |
| `src/` | Milkdown editor frontend (Vite + React) |
| `packages/` | Workspace packages (doc-core, doc-editor, doc-server, doc-store-sqlite, agent-bridge) |

## Agent API Surface

Full docs: `docs/agent-docs.md` and `AGENT_CONTRACT.md`.

| Endpoint | What |
|----------|------|
| `POST /documents` | Create a new document (JSON or raw markdown) |
| `GET /documents/:slug/state` | Read document state + metadata |
| `GET /documents/:slug/snapshot` | Block-level snapshot with stable refs + revision |
| `POST /documents/:slug/edit` | Structured edit (append/replace/insert) |
| `POST /documents/:slug/edit/v2` | Block-level editing with revision locking (preferred) |
| `POST /documents/:slug/ops` | Comments, suggestions, rewrite |
| `POST /documents/:slug/presence` | Agent presence |
| `GET /documents/:slug/events/pending` | Poll for changes |
| `POST /documents/:slug/events/ack` | Acknowledge processed events |

Auth: `Authorization: Bearer <token>` or `x-share-token: <token>` (token from shared URL).

Editing guidance: **Use Edit V2** (`GET /snapshot` then `POST /edit/v2`) for most tasks. It uses stable block refs and handles concurrent edits cleanly. Avoid `rewrite.apply` when collaborators are connected.

## Deployment

- **Platform**: Railway (Docker)
- **Dockerfile**: Node 22-slim, builds frontend, runs `npx tsx server/index.ts`
- **Repo**: `cdeistopened/conspire-proof`
- **Env vars**: `PORT` (default 4000), `DATABASE_PATH` (default `/app/data/proof-share.db` in Docker), `PROOF_CORS_ALLOW_ORIGINS`

## Relationship to Conspire

Conspire is the CIA intelligence collaboration platform. Proof is the document layer:

- **Conspire dashboard** embeds the Proof editor in an iframe
- **Convex** holds document metadata (status, platform, tags, routing)
- **Proof** holds document content (rich WYSIWYG markdown with agent editing capabilities)
- Documents are linked by `proof_slug` field
- Agents access content via Proof bridge API, metadata via Convex HTTP API

```
Conspire Dashboard (Convex)
  ├── Document metadata, status, tags
  └── proof_slug ──→ Proof SDK (this repo)
                       ├── Rich markdown content
                       ├── Real-time collab (Yjs/WebSocket)
                       └── Agent bridge API
```

## Workspace Packages

| Package | Path |
|---------|------|
| doc-core | `packages/doc-core` |
| doc-editor | `packages/doc-editor` |
| doc-server | `packages/doc-server` |
| doc-store-sqlite | `packages/doc-store-sqlite` |
| agent-bridge | `packages/agent-bridge` |

Example app: `apps/proof-example` (run with `npm --workspace proof-example run demo:agent`).

## Tests

```bash
npm test                          # All tests
npm run test:proof-sdk            # Agent bridge client tests
npm run test:server-routes-share  # Server routes + share tests
```

## Upstream

Forked from EveryInc/proof-sdk. MIT license. See `LICENSE` and `TRADEMARKS.md`.
