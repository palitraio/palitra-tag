import { resolveSource } from "./source.ts";
import { stripPalitraParam } from "./url.ts";
import type { SourceFields } from "./types.ts";

export const SESSION_KEY = "_plt_sess";

let cached: SourceFields | null = null;

export function ensureSession(referrer: string): void {
  if (sessionStorage.getItem(SESSION_KEY) !== null) {
    return;
  }
  cached = null;
  const fields = resolveSource(location.href, referrer);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(fields));
  cached = fields;
  stripPalitraParam();
}

export function getSourceFields(): SourceFields {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (raw === null) {
    cached = null;
    return {};
  }
  if (cached !== null) return cached;
  try {
    cached = JSON.parse(raw) as SourceFields;
    return cached;
  } catch {
    return {};
  }
}
