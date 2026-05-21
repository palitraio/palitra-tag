import type { PixelConfig } from "./types.ts";

const EMPTY: PixelConfig = { identity: [] };

export async function fetchConfig(endpoint: string, token: string): Promise<PixelConfig> {
  try {
    const response = await fetch(`${endpoint}/config`, {
      method: "GET",
      headers: { "X-Palitra-Pixel-Token": token },
    });
    if (!response.ok) return EMPTY;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !Array.isArray((data as PixelConfig).identity)) {
      return EMPTY;
    }
    return data as PixelConfig;
  } catch {
    return EMPTY;
  }
}
