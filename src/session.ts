import { resolveSource } from "./source.ts";
import { stripPalitraParam } from "./url.ts";
import type { SourceFields } from "./types.ts";

export const SESSION_KEY = "_plt_sess";

export function ensureSession(referrer: string): void {
  if (sessionStorage.getItem(SESSION_KEY) !== null) {
    return;
  }
  const fields = resolveSource(location.href, referrer);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(fields));
  stripPalitraParam();
}

export function getSourceFields(): SourceFields {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (raw === null) {
    return {};
  }
  try {
    return JSON.parse(raw) as SourceFields;
  } catch {
    return {};
  }
}
