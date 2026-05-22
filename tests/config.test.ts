import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchConfig } from "../src/config.ts";
import type { PixelToken } from "../src/types.ts";

const ENDPOINT = "https://api.test/api/v1/pixel";
const TOKEN = "ptok_test" as PixelToken;

describe("fetchConfig", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("calls GET /config with token header", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ identity: [] }), { status: 200 }),
    );
    await fetchConfig(ENDPOINT, TOKEN);
    expect(fetchMock).toHaveBeenCalledWith(
      `${ENDPOINT}/config`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "X-Palitra-Pixel-Token": TOKEN }),
      }),
    );
  });

  it("returns parsed identity from response", async () => {
    const body = { identity: [{ id_type: "ga4_client_id", storage: "cookie", key: "_ga" }] };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual(body);
  });

  it("returns empty identity on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({ identity: [] });
  });

  it("returns empty identity on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({ identity: [] });
  });

  it("returns empty identity on malformed JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({ identity: [] });
  });

  it("drops malformed entries but keeps valid ones", async () => {
    const body = {
      identity: [
        { id_type: "ga4_client_id", storage: "cookie", key: "_ga" },
        { id_type: "broken" },
        null,
        { id_type: "x", storage: "indexeddb", key: "k" },
        { id_type: "ym_uid", storage: "localStorage", key: "ym_uid" },
      ],
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
    const result = await fetchConfig(ENDPOINT, TOKEN);
    expect(result.identity).toEqual([
      { id_type: "ga4_client_id", storage: "cookie", key: "_ga" },
      { id_type: "ym_uid", storage: "localStorage", key: "ym_uid" },
    ]);
  });

  it("logs failures under debug", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await fetchConfig(ENDPOINT, TOKEN, true);
    expect(warn).toHaveBeenCalled();
  });
});
