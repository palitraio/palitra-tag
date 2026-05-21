import type { PixelEvent } from "./types.ts";
import { MAX_PAYLOAD_BYTES } from "./types.ts";

interface TransportConfig {
  endpoint: string;
  token: string;
  debug: boolean;
}

interface PendingRetry {
  body: string;
  attempt: number;
  timer: ReturnType<typeof setTimeout>;
}

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 30_000;

export class Transport {
  private readonly pending = new Set<PendingRetry>();

  constructor(private readonly config: TransportConfig) {}

  async send(event: PixelEvent): Promise<void> {
    const body = JSON.stringify(event);
    const size = new Blob([body]).size;
    if (size > MAX_PAYLOAD_BYTES) {
      console.warn(`[palitra] dropped oversize event "${event.event}":`, size);
      return;
    }
    await this.attempt(body, 1);
  }

  flushOnUnload(): void {
    if (typeof navigator.sendBeacon !== "function") return;
    const url = `${this.config.endpoint}/collect?token=${this.config.token}`;
    for (const pending of this.pending) {
      clearTimeout(pending.timer);
      navigator.sendBeacon(url, new Blob([pending.body], { type: "application/json" }));
    }
    this.pending.clear();
  }

  private async attempt(body: string, attempt: number): Promise<void> {
    let response: Response | undefined;
    try {
      response = await fetch(`${this.config.endpoint}/collect`, {
        method: "POST",
        keepalive: true,
        headers: {
          "X-Palitra-Pixel-Token": this.config.token,
          "Content-Type": "application/json",
        },
        body,
      });
    } catch {
      // Network error — fall through to retry logic.
    }

    if (response && response.ok) {
      return;
    }
    if (response && response.status >= 400 && response.status < 500 && response.status !== 429) {
      if (this.config.debug) {
        console.warn(`[palitra] dropped event: ${response.status}`);
      }
      return;
    }
    if (attempt >= MAX_ATTEMPTS) {
      if (this.config.debug) {
        console.warn(`[palitra] gave up after ${MAX_ATTEMPTS} attempts`);
      }
      return;
    }

    const delay = computeDelay(response, attempt);
    await new Promise<void>((resolve) => {
      const entry: PendingRetry = {
        body,
        attempt,
        timer: setTimeout(() => {
          this.pending.delete(entry);
          this.attempt(body, attempt + 1).then(resolve, resolve);
        }, delay),
      };
      this.pending.add(entry);
    });
  }
}

function computeDelay(response: Response | undefined, attempt: number): number {
  const retryAfter = response?.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_BACKOFF_MS);
    }
  }
  return Math.min(2 ** (attempt - 1) * 1000, MAX_BACKOFF_MS);
}
