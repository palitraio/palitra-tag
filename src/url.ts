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

export function stripPalitraParam(): void {
  const url = safeParse(location.href);
  if (!url || !url.searchParams.has("palitra")) return;
  url.searchParams.delete("palitra");
  const next =
    url.pathname +
    (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
    url.hash;
  try {
    history.replaceState(history.state, "", next);
  } catch {
    /* sandboxed iframe — leave URL as-is */
  }
}
