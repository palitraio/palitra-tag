import { ACTIVE_LOGGER } from "./logger.ts";
import type { SourceFields, SourceFieldKey } from "./types.ts";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

function safeParse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function parseUtm(url: string): UtmParams {
  const parsed = safeParse(url);
  if (!parsed) return {};
  const params = parsed.searchParams;
  const out: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      out[key] = value;
    }
  }
  return out;
}

export function getPalitraParam(url: string): string | null {
  const parsed = safeParse(url);
  if (!parsed) return null;
  const value = parsed.searchParams.get("palitra");
  return value && value.length > 0 ? value : null;
}

// v1 positional Linker schema. Order is part of the public wire contract
// shared with backend stitching — do NOT reorder or insert positions; bump
// the version prefix instead.
const LINKER_POSITIONS: readonly SourceFieldKey[] = [
  "source",
  "medium",
  "campaign_id",
  "adgroup_id",
  "ad_id",
  "keyword",
  "placement",
  "site",
  "slot",
];

export function parsePalitraLinker(value: string | null | undefined): SourceFields | null {
  if (!value) return null;
  const segments = value.split("||");
  const version = segments[0];
  if (version !== "v1") {
    ACTIVE_LOGGER.warn("[palitra] unknown linker version:", version);
    return null;
  }
  const fields: SourceFields = {};
  let assigned = 0;
  for (const [i, key] of LINKER_POSITIONS.entries()) {
    const segment = segments[i + 1];
    if (segment) {
      fields[key] = segment;
      assigned++;
    }
  }
  if (assigned === 0) {
    ACTIVE_LOGGER.warn("[palitra] linker has no non-empty fields:", value);
    return null;
  }
  return fields;
}

// The address bar keeps `palitra=` until third-party counters (Yandex Metrika,
// call tracking, …) have read the landing URL: they initialise from async
// scripts, often injected by a tag manager on `load`.
export const PALITRA_STRIP_DELAY_MS = 3000;

let stripScheduled = false;

export function withoutPalitraParam(href: string): string {
  const url = safeParse(href);
  if (!url || !url.searchParams.has("palitra")) return href;
  url.searchParams.delete("palitra");
  return url.href;
}

export function schedulePalitraStrip(): void {
  if (stripScheduled || withoutPalitraParam(location.href) === location.href) return;
  stripScheduled = true;
  const startDelay = (): void => {
    setTimeout(stripPalitraParam, PALITRA_STRIP_DELAY_MS);
  };
  if (document.readyState === "complete") startDelay();
  else window.addEventListener("load", startDelay, { once: true });
}

function stripPalitraParam(): void {
  const next = withoutPalitraParam(location.href);
  if (next === location.href) return;
  try {
    history.replaceState(history.state, "", next);
  } catch {
    /* sandboxed iframe — leave URL as-is */
  }
}
