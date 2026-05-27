import type { BootstrapResult, IdentityConfigEntry, PixelToken } from "./types.ts";

interface IdentityConfigEntryDto {
  id_type: string;
  source: "cookie" | "local_storage";
  key: string;
  value_pattern?: string;
}

interface PixelTagConfigDto {
  identity_config: IdentityConfigEntryDto[];
}

const EMPTY_READY: BootstrapResult = { kind: "ready", config: { identity_config: [] } };
const STOPPED: BootstrapResult = { kind: "stopped", reason: "unauthorized" };

export async function fetchConfig(
  endpoint: string,
  token: PixelToken,
  debug = false,
): Promise<BootstrapResult> {
  let response: Response;
  try {
    response = await fetch(`${endpoint}/config?token=${encodeURIComponent(token)}`, {
      method: "GET",
    });
  } catch (err) {
    if (debug) console.warn("[palitra] /config fetch failed:", err);
    return EMPTY_READY;
  }
  if (response.status === 401) {
    if (debug) console.warn("[palitra] /config rejected token (401) — stopping init");
    return STOPPED;
  }
  if (!response.ok) {
    console.warn(`[palitra] /config returned ${response.status}`);
    return EMPTY_READY;
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    console.warn("[palitra] /config returned invalid JSON:", err);
    return EMPTY_READY;
  }
  const inner = (body as { data?: unknown } | null)?.data;
  if (
    !inner ||
    typeof inner !== "object" ||
    !Array.isArray((inner as PixelTagConfigDto).identity_config)
  ) {
    console.warn("[palitra] /config payload has wrong shape:", body);
    return EMPTY_READY;
  }
  const entries: IdentityConfigEntry[] = [];
  for (const raw of (inner as PixelTagConfigDto).identity_config) {
    const parsed = parseEntry(raw);
    if (parsed !== null) {
      entries.push(parsed);
    } else if (debug) {
      console.warn("[palitra] /config dropped malformed entry:", raw);
    }
  }
  return { kind: "ready", config: { identity_config: entries } };
}

function parseEntry(entry: unknown): IdentityConfigEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  if (typeof e["id_type"] !== "string" || typeof e["key"] !== "string") return null;
  if (e["source"] !== "cookie" && e["source"] !== "local_storage") return null;
  const base = { id_type: e["id_type"], source: e["source"], key: e["key"] } as const;
  if (e["value_pattern"] === undefined) return base;
  if (typeof e["value_pattern"] !== "string") return null;
  const pattern = e["value_pattern"];
  let compiled: RegExp;
  try {
    compiled = new RegExp(pattern);
  } catch {
    console.warn(
      `[palitra] /config dropped "${e["id_type"]}": value_pattern is not a valid regex: ${pattern}`,
    );
    return null;
  }
  if (!hasCaptureGroup(pattern)) {
    console.warn(
      `[palitra] /config dropped "${e["id_type"]}": value_pattern has no capture group: ${pattern}`,
    );
    return null;
  }
  return { ...base, value_pattern: compiled };
}

// True if the pattern contains an unescaped capturing group — either `(...)` or `(?<name>...)`.
// Non-capturing groups `(?:...)` and lookarounds `(?=...)`, `(?!...)`, `(?<=...)`, `(?<!...)` don't count.
function hasCaptureGroup(pattern: string): boolean {
  let escaped = false;
  let inCharClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (inCharClass) {
      if (c === "]") inCharClass = false;
      continue;
    }
    if (c === "[") {
      inCharClass = true;
      continue;
    }
    if (c !== "(") continue;
    if (pattern[i + 1] !== "?") return true;
    if (pattern[i + 2] === "<" && pattern[i + 3] !== "=" && pattern[i + 3] !== "!") return true;
  }
  return false;
}
