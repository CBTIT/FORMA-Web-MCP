# GAMEPLAN.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

FORMA-Web-MCP is a **Model Context Protocol (MCP) server** that gives AI assistants (Claude Desktop, Copilot agents) structured access to Autodesk FORMA project data. It handles 3-legged APS OAuth, queries FORMA's GraphQL API for building data (elements, rooms, areas, departments), and can spin up a local Autodesk Viewer session in the browser.

**Example queries this enables:**
- *"Compare Project A and Project B — which has more circulation area?"*
- *"List all rooms in the Residential tower by department with their areas."*
- *"Open the model for Project X in the viewer."*

---

## Stack

- **Runtime**: Node.js with TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk` (stdio transport)
- **Auth**: Autodesk Platform Services (APS) 3-legged OAuth 2.0
- **Data**: FORMA GraphQL API
- **Viewer**: Autodesk Viewer (APS Viewer v7) served via local Express page
- **GraphQL client**: `graphql-request`

---

## Environment Variables

Create a `.env` file in the project root (never commit it). Required variables:

```env
# APS Application credentials (registered at https://aps.autodesk.com)
APS_CLIENT_ID=
APS_CLIENT_SECRET=
APS_CALLBACK_URL=http://localhost:3000/auth/callback

# Local server port (OAuth callback + Viewer pages)
PORT=3000

# FORMA GraphQL endpoint (confirm from FORMA API docs)
FORMA_GRAPHQL_URL=https://developer.api.autodesk.com/forma/v1alpha/graphql
```

---

## Dev Commands

```bash
npm install          # install dependencies
npm run dev          # run with hot reload (tsx watch)
npm run build        # compile TypeScript to dist/
npm start            # run compiled server (node dist/index.js)
npm run lint         # eslint
npm test             # run tests
npm run test:watch   # run a single test file in watch mode
```

---

## Connecting to Claude Desktop

Add to Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "forma": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/FORMA-Web-MCP",
      "env": { "NODE_ENV": "production" }
    }
  }
}
```

For development, use `tsx src/index.ts` as the command instead.

---

## Architecture

```
Claude / Copilot Agent
        │  MCP (stdio)
        ▼
┌─────────────────────────────────┐
│        MCP Server (index.ts)    │
│   registers tools & resources   │
└────────┬──────────┬─────────────┘
         │          │
    ┌────▼───┐  ┌───▼──────────────┐
    │  Auth  │  │  Tool Handlers   │
    │ layer  │  │ (hubs, elements, │
    │        │  │  compare, viewer)│
    └────┬───┘  └───┬──────────────┘
         │          │
    ┌────▼──────────▼────────────┐
    │   APS OAuth  │  FORMA      │
    │   3-legged   │  GraphQL    │
    │   (+ token   │  API        │
    │    cache)    │             │
    └──────────────┴─────────────┘
                        │
              (open_viewer tool only)
                        │
              ┌─────────▼──────────┐
              │  Local Express     │
              │  server (port 3000)│
              │  serving APS       │
              │  Viewer HTML page  │
              └────────────────────┘
```

---

## Project Structure

```
src/
  index.ts              # MCP server entry — registers all tools, starts stdio transport
  auth/
    oauth.ts            # Spins up temporary Express server for OAuth callback flow
    tokens.ts           # Token storage (.tokens.json), refresh logic
  tools/
    hubs.ts             # list_hubs, list_projects
    elements.ts         # get_project_elements, get_area_breakdown
    compare.ts          # compare_projects (computes property diffs across two projects)
    viewer.ts           # open_viewer, highlight_elements_in_viewer — starts Express viewer server, opens browser; communicates with open Viewer session via a small WebSocket or REST endpoint on the same Express server
  graphql/
    client.ts           # Authenticated graphql-request client
    queries/            # One .ts file per domain (projects.ts, elements.ts, areas.ts)
  viewer/
    server.ts           # Express server that serves the Viewer HTML
    template.html       # Autodesk Viewer v7 embed template
  types/
    forma.ts            # TypeScript types mirroring FORMA GraphQL schema
.tokens.json            # Cached OAuth tokens (gitignored)
.env                    # Credentials (gitignored)
```

---

## MCP Tools

| Tool | Description |
|---|---|
| `authenticate` | Launches APS 3-legged OAuth in the browser; stores token to `.tokens.json` |
| `list_hubs` | Returns all accessible FORMA hubs for the authenticated user |
| `list_projects(hub_id)` | Lists all projects within a hub |
| `get_area_breakdown(project_id)` | Returns area totals grouped by element type / department |
| `get_project_elements(project_id, type?)` | Fetches elements with their properties; optional type filter (room, space, etc.) |
| `get_elements_by_category(project_id, category)` | Returns all items of a specific category — e.g. `doors`, `windows`, `walls`, `columns`, `stairs`. Returns count, IDs, and key properties per item |
| `get_element_properties(project_id, element_id)` | Returns all properties for a single element by its ID (dimensions, material, fire rating, etc.) |
| `search_elements(project_id, filters)` | Filtered element search — combine category, property name, and value (e.g. all doors with `fireRating = "60min"`) |
| `get_project_model_urn(project_id)` | Returns the model URN for a specific project (required for viewer) |
| `compare_projects(project_a_id, project_b_id, property)` | Side-by-side comparison of a named property (e.g. `area`, `circulation_area`) |
| `open_viewer(project_id, model_urn?)` | Starts the local Express viewer. If `model_urn` is omitted, auto-fetches from project |
| `highlight_elements_in_viewer(element_ids)` | Highlights a set of element IDs in an already-open Viewer session (used after a query to visualise results) |

---

## OAuth Flow Details

3-legged OAuth cannot use a pure stdio server because it requires a browser redirect. The pattern used here:

1. `authenticate` tool call → server starts a **temporary Express listener** on `PORT`
2. Opens `https://developer.api.autodesk.com/authentication/v2/authorize?...` in the browser
3. User logs in and approves → APS redirects to `APS_CALLBACK_URL`
4. Express handler captures `code`, exchanges it for `access_token` + `refresh_token`
5. Tokens written to `.tokens.json`, temporary server shuts down
6. All subsequent tool calls load the token from `.tokens.json`, refreshing automatically if expired

**Required APS OAuth scopes:** `data:read`, `data:write`, `data:create`, `viewables:read`

---

## FORMA GraphQL Notes

- FORMA elements have typed properties — areas, heights, department tags — exposed as GraphQL fields
- Area comparison queries aggregate `grossArea` or similar numeric properties across element collections
- The `FORMA_GRAPHQL_URL` endpoint requires a valid APS bearer token in the `Authorization` header
- Confirm the exact schema by introspecting the endpoint or checking the FORMA API docs

---

## Key Implementation Constraints

- The MCP server **must not block** the stdio transport while waiting for OAuth or the Express viewer server. Use async/await throughout; the temporary Express servers run concurrently.
- Token refresh must be **transparent** — tool handlers call a `getToken()` helper that handles refresh internally, never exposing raw token management to tool logic.
- The viewer Express server stays alive after `open_viewer` is called (the user may interact with it). Track its handle so it can be shut down if needed.
- All GraphQL queries live in `src/graphql/queries/` as tagged template literals — keep query definitions separate from the tool logic that calls them.
- **Query-then-visualize pattern**: a typical AI workflow will call `get_elements_by_category` to get a list of element IDs, then immediately call `highlight_elements_in_viewer` to light them up. The Express viewer server must expose a `/highlight` endpoint (or WebSocket message) so the MCP server can push element IDs into the already-open browser tab without a page reload.

---

## Development Workflow

### Commit discipline
Group all changes semantically before committing — do not mix work types in a single commit. Use these prefixes:

| Prefix | When to use |
|---|---|
| `feat:` | New MCP tool, new capability, new module |
| `fix:` | Bug fix |
| `auth:` | OAuth / token management changes |
| `graphql:` | Query additions or schema changes |
| `viewer:` | Viewer server or highlight logic |
| `config:` | Environment, tsconfig, package.json, MCP registration |
| `docs:` | CLAUDE.md, README, inline comments |
| `refactor:` | Internal restructure with no behaviour change |

### Feature tracker
Maintain a `FEATURES.md` file in the project root. Every feature, fix, or significant change gets a row linking to its commit hash once merged.

Format:

```markdown
## Feature Tracker

| # | Type | Description | Status | Commit |
|---|------|-------------|--------|--------|
| 1 | feat | Project scaffold — tsconfig, package.json, MCP entry point | ✅ done | abc1234 |
| 2 | auth | APS 3-legged OAuth flow + token cache | ✅ done | def5678 |
| 3 | feat | `list_hubs` and `list_projects` tools | 🔄 in progress | — |
```

Update `FEATURES.md` at the end of each work session — add new rows for planned work (status `⬜ planned`) and fill in commit hashes as work lands.
