import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Transport } from "../src/transport.ts";
import type { PixelEvent } from "../src/types.ts";

const TOKEN = "ptok_test";
const ENDPOINT = "https://api.test/api/v1/pixel";

function event(over: Partial<PixelEvent> = {}): PixelEvent {
  return { event: "page_view", url: "https://shop.test/", ...over };
}

describe("Transport.send", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let beaconMock: ReturnType<typeof vi.fn>;
  let transport: Transport;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    beaconMock = vi.fn(() => true);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(navigator, "sendBeacon", { value: beaconMock, configurable: true });
    transport = new Transport({ endpoint: ENDPOINT, token: TOKEN, debug: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("posts to /collect with token header and JSON body", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    await transport.send(event());
    expect(fetchMock).toHaveBeenCalledWith(
      `${ENDPOINT}/collect`,
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        headers: expect.objectContaining({
          "X-Palitra-Pixel-Token": TOKEN,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("drops events over 64 KB and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const huge = event({ properties: { blob: "x".repeat(70 * 1024) } });
    await transport.send(huge);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("oversize"), expect.any(Number));
  });

  it("retries on 5xx with exponential backoff", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const pending = transport.send(event());
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("respects Retry-After on 429", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "3" } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const pending = transport.send(event());
    await vi.advanceTimersByTimeAsync(2999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400/401/413", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 400 }));
    await transport.send(event());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after 5 attempts", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const pending = transport.send(event());
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(60_000);
    }
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("flushes pending retries via sendBeacon on pagehide", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    transport.send(event({ event: "custom" }));
    await vi.advanceTimersByTimeAsync(0);
    transport.flushOnUnload();
    expect(beaconMock).toHaveBeenCalledWith(
      `${ENDPOINT}/collect?token=${TOKEN}`,
      expect.any(Blob),
    );
  });
});
