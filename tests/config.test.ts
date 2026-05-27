import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchConfig } from "../src/config.ts";
import type { PixelToken } from "../src/types.ts";

const ENDPOINT = "https://api.test/api/v1/pixel";
const TOKEN = "ptok_test" as PixelToken;

function envelope(identity_config: unknown[]): string {
  return JSON.stringify({ data: { identity_config } });
}

describe("fetchConfig", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("calls GET /pixel/config with ?token= and no project_id, no Authorization", async () => {
    fetchMock.mockResolvedValueOnce(new Response(envelope([]), { status: 200 }));
    await fetchConfig(ENDPOINT, TOKEN);
    expect(fetchMock.mock.calls.length).toBe(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${ENDPOINT}/config?token=${encodeURIComponent(TOKEN)}`);
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

  it("returns stopped on 401 (missing/unknown/archived token) and does not warn", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({ kind: "stopped", reason: "unauthorized" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns ready with empty entries on 2xx with empty identity_config", async () => {
    fetchMock.mockResolvedValueOnce(new Response(envelope([]), { status: 200 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({
      kind: "ready",
      config: { identity_config: [] },
    });
  });

  it("unwraps the { data: { identity_config: [...] } } envelope and compiles value_pattern", async () => {
    const body = envelope([
      { id_type: "ga_client_id", source: "cookie", key: "_ga", value_pattern: "^GA\\d\\.\\d\\.(.+)$" },
    ]);
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const result = await fetchConfig(ENDPOINT, TOKEN);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") throw new Error("unreachable");
    const [entry] = result.config.identity_config;
    expect(entry).toMatchObject({ id_type: "ga_client_id", source: "cookie", key: "_ga" });
    expect(entry?.value_pattern).toBeInstanceOf(RegExp);
    const match = "GA1.2.123456.789".match(entry!.value_pattern!);
    expect(match?.[1]).toBe("123456.789");
  });

  it("returns empty identity_config and warns on non-2xx (non-401)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({
      kind: "ready",
      config: { identity_config: [] },
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("500"));
  });

  it("network errors are silent unless debug=true", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({
      kind: "ready",
      config: { identity_config: [] },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns unconditionally on malformed JSON (server bug)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({
      kind: "ready",
      config: { identity_config: [] },
    });
    expect(warn).toHaveBeenCalled();
  });

  it("warns unconditionally on un-enveloped payload (wrong shape)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ identity_config: [] }), { status: 200 }),
    );
    expect(await fetchConfig(ENDPOINT, TOKEN)).toEqual({
      kind: "ready",
      config: { identity_config: [] },
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("wrong shape"), expect.anything());
  });

  it("drops malformed entries but keeps valid ones", async () => {
    const body = envelope([
      { id_type: "ga_client_id", source: "cookie", key: "_ga" },
      { id_type: "broken" },
      null,
      { id_type: "x", source: "indexeddb", key: "k" },
      { id_type: "ym_uid", source: "local_storage", key: "ym_uid" },
      { id_type: "bad_pattern", source: "cookie", key: "_ga", value_pattern: 42 },
    ]);
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const result = await fetchConfig(ENDPOINT, TOKEN);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") throw new Error("unreachable");
    expect(result.config.identity_config).toEqual([
      { id_type: "ga_client_id", source: "cookie", key: "_ga" },
      { id_type: "ym_uid", source: "local_storage", key: "ym_uid" },
    ]);
  });

  it("drops entries with an invalid regex value_pattern and warns", async () => {
    const body = envelope([
      { id_type: "ga_client_id", source: "cookie", key: "_ga", value_pattern: "(unbalanced" },
    ]);
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const result = await fetchConfig(ENDPOINT, TOKEN);
    expect(result).toEqual({ kind: "ready", config: { identity_config: [] } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not a valid regex"));
  });

  it("drops entries whose value_pattern has no capture group and warns", async () => {
    const body = envelope([
      { id_type: "ga_client_id", source: "cookie", key: "_ga", value_pattern: "^GA" },
      { id_type: "ym_uid", source: "cookie", key: "_ym", value_pattern: "^(?:foo)$" },
    ]);
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const result = await fetchConfig(ENDPOINT, TOKEN);
    expect(result).toEqual({ kind: "ready", config: { identity_config: [] } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no capture group"));
  });

  it("accepts named capture groups", async () => {
    const body = envelope([
      { id_type: "ga_client_id", source: "cookie", key: "_ga", value_pattern: "^(?<v>GA.+)$" },
    ]);
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const result = await fetchConfig(ENDPOINT, TOKEN);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") throw new Error("unreachable");
    expect(result.config.identity_config).toHaveLength(1);
  });

  it("logs malformed-entry detail only under debug", async () => {
    const body = envelope([{ id_type: "broken" }]);
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    await fetchConfig(ENDPOINT, TOKEN, false);
    expect(warn).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(new Response(envelope([{ id_type: "broken" }]), { status: 200 }));
    await fetchConfig(ENDPOINT, TOKEN, true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("dropped malformed entry"),
      expect.anything(),
    );
  });
});
