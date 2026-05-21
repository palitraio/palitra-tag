# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

`palitra-tag` is the **client-side browser script** (the "Palitra Tag", historically called "Palitra Pixel") that collects browser events for the Palitra platform and ships them to the backend ingestion API.

The repo is **pre-implementation**: only `README.md` exists so far. No source, no package manifest, no build tooling. New work will introduce the actual tag implementation (JS/TS) from scratch — there is no legacy code to preserve.

## This Repository Is Public

`palitra-tag` is a **public** repository — the tag ships to end-user browsers, so the source is inherently exposed. Treat anything committed here as world-readable.

- Do **not** commit or reference closed-source internals: backend architecture details, infra layout, private service URLs, internal hostnames, non-public roadmap, customer names, credentials, or anything from the private `docs/` repo.
- Do **not** link to private repositories or internal docs from public files (`README.md`, public docs, code comments). The `docs/` symlink points to a private repo — never expose its paths or contents in anything checked into this repo.
- Public-facing surface (README, code comments, error messages, the public API) should describe only what is already public: the wire contract end users can observe by reading the script, and the install instructions.
- When in doubt, ask before publishing.

## Required Reading Before Coding

Before implementing or modifying tag behavior, read these specs (sourced via the `docs/` symlink to the platform docs repo):

- `docs/03-api/ingestion.md` — `/pixel/config` and `/pixel/collect` contracts, `PixelEvent` schema, `linked_ids` handling, auth (`X-Palitra-Pixel-Token` header or `?token=`), 64 KB payload limit, rate limits (50 RPS/IP, 1000 RPS/project).
- `docs/02-architecture/data-stitching.md` — traffic source resolution (Tagged vs Untagged), data maturity levels, identity graph. Drives how the tag derives `source` fields and `linked_ids`.
- `docs/01-ubiquitous-language.md` — canonical domain terms. Use these names in code and comments.

The `docs/` directory is a **symlink** to `/Users/agolosnichenko/Documents/Projects/palitra/docs`; it is not part of this repo's git tree.

## Key Behavioral Invariants

These come from the README and `docs/03-api/ingestion.md` — preserve them in any implementation:

- **Endpoints keep the `/pixel/` prefix** for stability. The product is "Palitra Tag", the endpoints are `/api/v1/pixel/collect` and `/api/v1/pixel/config`.
- **No `project_id` in URLs or payloads.** The project is resolved from the public pixel token.
- **Source resolution priority** (highest wins, evaluated once at session entry, then inherited by every event in the session):
  1. `palitra=` URL parameter
  2. `plt||` prefix in `utm_content`
  3. Plain UTM parameters
  4. `document.referrer`
  5. Direct
- **After reading `palitra=`**, strip it from the address bar via `history.replaceState` (do not navigate or reload).
- **Identifiers**: auto-read configured cookies/localStorage keys (delivered by `GET /pixel/config`) and attach as `linked_ids`. Manual linking via `palitra('link', idType, idValue)`.
- **Payload ≤ 64 KB** — enforce client-side before sending; do not silently drop oversize events without surfacing it.

## Public API Shape

The tag must expose a single global function compatible with this surface (from README):

```js
palitra('link', idType, idValue);
// event-sending methods (e.g. page_view, purchase) per docs/03-api/ingestion.md
```

When designing the implementation, follow the brainstorming workflow before locking in API decisions — this is greenfield code and the public surface is load-bearing for installs in the wild.

## Conventions

- Browser-only target. No Node-specific APIs at runtime (build tooling can use Node).
- Treat the backend contract in `docs/03-api/ingestion.md` as the source of truth; if a discrepancy appears, update the docs (see `docs/CLAUDE.md` for the cross-reference rules) rather than diverging silently.
