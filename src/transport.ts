import type { Logger } from "./logger.ts";
import { ACTIVE_LOGGER } from "./logger.ts";
import type { PixelEvent, PixelToken } from "./types.ts";
import { MAX_PAYLOAD_BYTES } from "./types.ts";

interface TransportConfig {
  endpoint: string;
  token: PixelToken;
  logger: Logger;
}

interface PendingEntry {
  body: string;
  size: number;
  timer: ReturnType<typeof setTimeout> | null;
  abandoned: boolean;
}

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 30_000;
const MAX_PENDING = 256;

const encoder = new TextEncoder();

export class Transport {
  private readonly pending = new Set<PendingEntry>();

  constructor(private readonly config: TransportConfig) {}

  async send(event: PixelEvent): Promise<void> {
    const body = JSON.stringify(event);
    const size = encoder.encode(body).length;
    if (size > MAX_PAYLOAD_BYTES) {
      ACTIVE_LOGGER.warn(`[palitra] dropped oversize event "${event.event}":`, size);
      return;
    }
    if (this.pending.size >= MAX_PENDING) {
      ACTIVE_LOGGER.warn(`[palitra] dropped event "${event.event}": pending queue full`);
      return;
    }
    const entry: PendingEntry = { body, size, timer: null, abandoned: false };
    this.pending.add(entry);
    try {
      await this.attempt(entry, 1);
    } finally {
      this.pending.delete(entry);
    }
  }

  flushOnUnload(): void {
    if (typeof navigator.sendBeacon !== "function") return;
    const url = `${this.config.endpoint}/collect?token=${encodeURIComponent(this.config.token)}`;
    for (const entry of this.pending) {
      if (entry.timer !== null) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      if (entry.size > MAX_PAYLOAD_BYTES) continue;
      const blob = new Blob([entry.body], { type: "application/json" });
      const queued = navigator.sendBeacon(url, blob);
      if (queued) {
        entry.abandoned = true;
      } else {
        this.config.logger.warn("[palitra] sendBeacon refused payload on unload");
      }
    }
  }

  private async attempt(entry: PendingEntry, attempt: number): Promise<void> {
    let response: Response | undefined;
    try {
      response = await fetch(`${this.config.endpoint}/collect`, {
        method: "POST",
        keepalive: true,
        headers: {
          "X-Palitra-Pixel-Token": this.config.token,
          "Content-Type": "application/json",
        },
        body: entry.body,
      });
    } catch (err) {
      this.config.logger.warn("[palitra] /collect fetch failed:", err);
    }

    if (entry.abandoned) return;
    if (response && response.ok) return;
    if (response && response.status >= 400 && response.status < 500 && response.status !== 429) {
      this.config.logger.warn(`[palitra] dropped event: ${response.status}`);
      return;
    }
    if (attempt >= MAX_ATTEMPTS) {
      this.config.logger.warn(`[palitra] gave up after ${MAX_ATTEMPTS} attempts`);
      return;
    }

    const delay = computeDelay(response, attempt);
    await new Promise<void>((resolve) => {
      entry.timer = setTimeout(() => {
        entry.timer = null;
        if (entry.abandoned) {
          resolve();
          return;
        }
        this.attempt(entry, attempt + 1).then(resolve, resolve);
      }, delay);
    });
  }
}

function computeDelay(response: Response | undefined, attempt: number): number {
  const retryAfter = response?.headers.get("Retry-After");
  if (retryAfter) {
    const trimmed = retryAfter.trim();
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_BACKOFF_MS);
    }
    const httpDate = Date.parse(trimmed);
    if (Number.isFinite(httpDate)) {
      const wait = httpDate - Date.now();
      if (wait > 0) return Math.min(wait, MAX_BACKOFF_MS);
    }
  }
  return Math.min(2 ** (attempt - 1) * 1000, MAX_BACKOFF_MS);
}
