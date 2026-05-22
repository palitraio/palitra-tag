import type { LinkedId, PixelConfig } from "./types.ts";
import { asIdType, asIdValue, MAX_LINKED_IDS } from "./types.ts";

export const UID_KEY = "_plt_uid";
export const LINKS_KEY = "_plt_links";

let memoryUid: string | null = null;
let memoryLinks: Record<string, string> | null = null;

export function setUserId(userId: string): void {
  if (typeof userId !== "string" || userId.length === 0) return;
  try {
    localStorage.setItem(UID_KEY, userId);
  } catch {
    memoryUid = userId;
  }
}

function readLinks(): Record<string, string> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LINKS_KEY);
  } catch {
    return memoryLinks ?? {};
  }
  if (raw === null) return memoryLinks ?? {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string>;
    }
  } catch {
    try {
      localStorage.removeItem(LINKS_KEY);
    } catch { /* in-memory fallback below */ }
  }
  return memoryLinks ?? {};
}

function writeLinks(links: Record<string, string>): void {
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify(links));
    memoryLinks = null;
  } catch {
    memoryLinks = { ...links };
  }
}

function readUid(): string | null {
  try {
    return localStorage.getItem(UID_KEY) ?? memoryUid;
  } catch {
    return memoryUid;
  }
}

export function addLink(idType: string, idValue: string): void {
  if (asIdType(idType) === null) return;
  if (asIdValue(idValue) === null) return;
  const links = readLinks();
  links[idType] = idValue;
  writeLinks(links);
}

function readCookie(name: string): string | null {
  let cookieString: string;
  try {
    cookieString = document.cookie;
  } catch {
    return null;
  }
  for (const cookie of cookieString.split(";")) {
    const eq = cookie.indexOf("=");
    if (eq === -1) continue;
    const key = cookie.slice(0, eq).trim();
    if (key === name) {
      return cookie.slice(eq + 1);
    }
  }
  return null;
}

// Map.set is last-write-wins, so we layer from lowest priority to highest:
// auto-read → manual link() → identify().
export function collectLinkedIds(config: PixelConfig): LinkedId[] {
  const collected = new Map<string, string>();

  for (const entry of config.identity) {
    if (asIdType(entry.id_type) === null) continue;
    let value: string | null;
    if (entry.storage === "cookie") {
      value = readCookie(entry.key);
    } else {
      try {
        value = localStorage.getItem(entry.key);
      } catch {
        value = null;
      }
    }
    if (value && value.length > 0) {
      collected.set(entry.id_type, value);
    }
  }

  for (const [idType, idValue] of Object.entries(readLinks())) {
    if (asIdType(idType) !== null && idValue) {
      collected.set(idType, idValue);
    }
  }

  const userId = readUid();
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
