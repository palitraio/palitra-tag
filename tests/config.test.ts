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

  it("calls GET /pixel/config with ?token= and no project_id, no Authorization", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ identity_config: [] }), { status: 200 }),
    );
    await fetchConfig(ENDPOINT, TOKEN);
    expect(fetchMock.mock.calls.length).toBe(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${ENDPOINT}/config?token=${encodeURIComponent(TOKEN)}`);
    // Public bootstrap: project is resolved server-side from the token.
    expect(String(url)).not.toMatch(/projects?\//i);
    expect(String(url)).not.toMatch(/project_id/i);
    expect(init).toMatchObject({ method: "GET" });
    const headers = (init as RequestInit).headers as Record<string, string> | undefined;
    expect(headers?.["X-Palitra-Pixel-Token"]).toBeUndefined();
    expect(headers?.["Authorization"]).toBeUndefined();
    for (const v of Object.values(headers ?? {})) {
      expect(String(v).toLowerCase()).not.toContain("project");
    }
  });

  it("returns stopped on 401 (missing/unknown/archived token)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({ kind: "stopped", reason: "unauthorized" });
  });

  it("returns ready on 2xx", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ identity_config: [] }), { status: 200 }),
    );
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({
      kind: "ready",
      config: { identity_config: [] },
    });
  });

  it("returns parsed identity_config from response", async () => {
    const body = {
      identity_config: [
        { id_type: "ga_client_id", source: "cookie", key: "_ga", value_pattern: "^GA\\\\d\\\\.\\\\d\\\\.(.+)$" },
      ],
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({
      kind: "ready",
      config: { identity_config: body.identity_config },
    });
  });

  it("returns empty identity_config on non-2xx (non-401)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({
      kind: "ready",
      config: { identity_config: [] },
    });
  });

  it("returns empty identity_config on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({
      kind: "ready",
      config: { identity_config: [] },
    });
  });

  it("returns empty identity_config on malformed JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({
      kind: "ready",
      config: { identity_config: [] },
    });
  });

  it("drops malformed entries but keeps valid ones", async () => {
    const body = {
      identity_config: [
        { id_type: "ga_client_id", source: "cookie", key: "_ga" },
        { id_type: "broken" },
        null,
        { id_type: "x", source: "indexeddb", key: "k" },
        { id_type: "ym_uid", source: "local_storage", key: "ym_uid" },
        { id_type: "bad_pattern", source: "cookie", key: "_ga", value_pattern: 42 },
      ],
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
    const result = await fetchConfig(ENDPOINT, TOKEN);
    expect(result).toEqual({
      kind: "ready",
      config: {
        identity_config: [
          { id_type: "ga_client_id", source: "cookie", key: "_ga" },
          { id_type: "ym_uid", source: "local_storage", key: "ym_uid" },
        ],
      },
    });
  });

  it("logs failures under debug", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await fetchConfig(ENDPOINT, TOKEN, true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
