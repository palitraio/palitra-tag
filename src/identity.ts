import type { LinkedId, PixelConfig } from "./types.ts";
import { ID_TYPE_PATTERN, MAX_LINKED_IDS } from "./types.ts";

export const UID_KEY = "_plt_uid";
export const LINKS_KEY = "_plt_links";

export function setUserId(userId: string): void {
  if (typeof userId !== "string" || userId.length === 0) {
    return;
  }
  localStorage.setItem(UID_KEY, userId);
}

function readLinks(): Record<string, string> {
  const raw = localStorage.getItem(LINKS_KEY);
  if (raw === null) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeLinks(links: Record<string, string>): void {
  localStorage.setItem(LINKS_KEY, JSON.stringify(links));
}

export function addLink(idType: string, idValue: string): void {
  if (!ID_TYPE_PATTERN.test(idType)) return;
  if (typeof idValue !== "string" || idValue.length === 0 || idValue.length > 1024) return;
  const links = readLinks();
  links[idType] = idValue;
  writeLinks(links);
}

function readCookie(name: string): string | null {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const eq = cookie.indexOf("=");
    if (eq === -1) continue;
    const key = cookie.slice(0, eq).trim();
    if (key === name) {
      return cookie.slice(eq + 1);
    }
  }
  return null;
}

export function collectLinkedIds(config: PixelConfig): LinkedId[] {
  const collected = new Map<string, string>();

  // Lowest priority: auto-read from configured cookies/localStorage.
  for (const entry of config.identity) {
    if (!ID_TYPE_PATTERN.test(entry.id_type)) continue;
    const value =
      entry.storage === "cookie" ? readCookie(entry.key) : localStorage.getItem(entry.key);
    if (value && value.length > 0) {
      collected.set(entry.id_type, value);
    }
  }

  // Mid priority: manual link() entries.
  for (const [idType, idValue] of Object.entries(readLinks())) {
    if (ID_TYPE_PATTERN.test(idType) && idValue) {
      collected.set(idType, idValue);
    }
  }

  // Highest priority: identify().
  const userId = localStorage.getItem(UID_KEY);
  if (userId) {
    collected.set("user_id", userId);
  }

  const result: LinkedId[] = [];
  for (const [idType, idValue] of collected) {
    if (result.length >= MAX_LINKED_IDS) break;
    result.push({ id_type: idType, id_value: idValue });
  }
  return result;
}
