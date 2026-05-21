# Palitra Tag

Client-side script that collects browser events for the Palitra platform. Also known as Palitra Pixel — endpoint paths retain the historical `/pixel/` prefix for stability.

## What it does

- Sends browser events (`page_view`, `purchase`, etc.) to `POST /api/v1/pixel/collect`.
- Resolves traffic source on the client side before sending. Priority: `palitra` URL parameter → `plt||` prefix in `utm_content` → plain UTM parameters → `document.referrer` → direct.
- After capturing the `palitra=` parameter, strips it from the address bar via `history.replaceState`.
- Source fields are fixed at the session entry point and inherited by every subsequent event in the session.
- Fetches project configuration from `GET /api/v1/pixel/config` (cookie/localStorage keys from connected analytics connectors).
- Automatically reads user identifiers from cookies/localStorage and sends them as `linked_ids`.
- Supports manual identity linking via `palitra('link', idType, idValue)`.

## Authentication

The public pixel token is passed via the `X-Palitra-Pixel-Token` header or the `?token=` query parameter. `project_id` is intentionally absent from the URL — the project is resolved from the token.

## Limits

- Payload ≤ 64 KB.
- Rate limits: 50 RPS per IP, 1,000 RPS per project.

## License

[MIT](./LICENSE) © Palitra
