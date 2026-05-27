import type { IdentityConfigEntry, PixelConfig, PixelToken } from "./types.ts";

const EMPTY: PixelConfig = { identity_config: [] };

export async function fetchConfig(
  endpoint: string,
  token: PixelToken,
  debug = false,
): Promise<PixelConfig> {
  let response: Response;
  try {
    response = await fetch(`${endpoint}/config?token=${encodeURIComponent(token)}`, {
      method: "GET",
    });
  } catch (err) {
    if (debug) console.warn("[palitra] /config fetch failed:", err);
    return EMPTY;
  }
  if (!response.ok) {
    if (debug) console.warn(`[palitra] /config returned ${response.status}`);
    return EMPTY;
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    if (debug) console.warn("[palitra] /config returned invalid JSON:", err);
    return EMPTY;
  }
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as PixelConfig).identity_config)
  ) {
    if (debug) console.warn("[palitra] /config payload has wrong shape:", data);
    return EMPTY;
  }
  const identity_config: IdentityConfigEntry[] = [];
  for (const entry of (data as PixelConfig).identity_config) {
    if (isValidEntry(entry)) {
      identity_config.push(entry);
    } else if (debug) {
      console.warn("[palitra] /config dropped malformed entry:", entry);
    }
  }
  return { identity_config };
}

function isValidEntry(entry: unknown): entry is IdentityConfigEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  if (typeof e["id_type"] !== "string" || typeof e["key"] !== "string") return false;
  if (e["source"] !== "cookie" && e["source"] !== "local_storage") return false;
  if (e["value_pattern"] !== undefined && typeof e["value_pattern"] !== "string") return false;
  return true;
}
