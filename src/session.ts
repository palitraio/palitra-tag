import { resolveSource } from "./source.ts";
import { stripPalitraParam } from "./url.ts";
import type { ResolvedSource, SourceFields } from "./types.ts";
import { RESOLVED_SOURCE_KINDS, toSourceFields } from "./types.ts";

export const SESSION_KEY = "_plt_sess";

let cached: ResolvedSource | null = null;
let memoryOnly = false;

export function ensureSession(referrer: string, debug = false): void {
  const stored = readStorage();
  if (stored !== null) {
    cached = stored;
    return;
  }
  if (memoryOnly && cached !== null) return;
  const src = resolveSource(location.href, referrer, debug);
  cached = src;
  writeStorage(src);
  stripPalitraParam();
}

export function getSourceFields(): SourceFields {
  const stored = readStorage();
  if (stored !== null) {
    cached = stored;
    return toSourceFields(cached);
  }
  if (memoryOnly && cached !== null) return toSourceFields(cached);
  cached = null;
  return {};
}

function readStorage(): ResolvedSource | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isResolvedSource(parsed)) return parsed;
  } catch {
    // fall through to cleanup
  }
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* unreadable storage; in-memory cache takes over */
  }
  return null;
}

function isResolvedSource(value: unknown): value is ResolvedSource {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === "string" && RESOLVED_SOURCE_KINDS.has(kind as ResolvedSource["kind"]);
}

function writeStorage(src: ResolvedSource): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(src));
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
}
