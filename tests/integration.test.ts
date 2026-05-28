import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createDispatcher } from "../src/core.ts";

type WindowBag = Record<string, unknown>;
type Palitra = ((...args: unknown[]) => void) & { q?: unknown[][] };

describe("integration: snippet -> bundle drain", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    history.replaceState(null, "", "/?utm_source=google&utm_campaign=spring");
    fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 })));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const w = window as unknown as WindowBag;
    delete w["palitra"];
    delete w["PalitraObject"];
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("queued calls drain in order after the bundle loads", async () => {
    const w = window as unknown as WindowBag;
    w["PalitraObject"] = "palitra";
    const stub: Palitra = function (...args: unknown[]): void {
      (stub.q = stub.q || []).push(args);
    };
    stub.q = [];
    w["palitra"] = stub;

    const palitra = w["palitra"] as Palitra;
    palitra("init", "ptok_xyz");
    palitra("identify", "U-99");
    palitra("event", "early_signup", { plan: "pro" });

    await import("../src/index.ts");
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const bodies = fetchMock.mock.calls
      .filter((c) => String(c[0]).endsWith("/collect"))
      .map((c) => JSON.parse(String(c[1]?.body ?? "null")));

    const signup = bodies.find((b) => b.event === "early_signup");
    expect(signup).toBeDefined();
    expect(signup).toMatchObject({
      event: "early_signup",
      properties: { plan: "pro" },
      source: "google",
      campaign_id: "spring",
    });
    expect(signup.linked_ids).toContainEqual({ id_type: "user_id", id_value: "U-99" });
  });

  it("end-to-end: GA _ga cookie flows through value_pattern into linked_ids", async () => {
    document.cookie = "_ga=GA1.2.123456.789";

    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("/config")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                identity_config: [
                  {
                    id_type: "ga_client_id",
                    source: "cookie",
                    key: "_ga",
                    value_pattern: "^GA\\d\\.\\d\\.(.+)$",
                  },
                ],
              },
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(null, { status: 202 }));
    });

    const dispatch = createDispatcher();
    dispatch(["init", "ptok_ok", { autoPageView: false }]);
    await new Promise((r) => setTimeout(r, 0));
    dispatch(["event", "purchase", { value: 49 }]);
    await new Promise((r) => setTimeout(r, 0));

    const collectCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/collect"));
    expect(collectCall).toBeDefined();
    const body = JSON.parse((collectCall![1] as RequestInit).body as string);
    expect(body.linked_ids).toContainEqual({ id_type: "ga_client_id", id_value: "123456.789" });
  });

  it("end-to-end: empty identity_config still lets the Tag run", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("/config")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 202 }));
    });

    const dispatch = createDispatcher();
    dispatch(["init", "ptok_ok", { autoPageView: false }]);
    await new Promise((r) => setTimeout(r, 0));
    dispatch(["event", "click"]);
    await new Promise((r) => setTimeout(r, 0));

    const collectCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/collect"));
    expect(collectCall).toBeDefined();
    const body = JSON.parse((collectCall![1] as RequestInit).body as string);
    expect(body.linked_ids).toBeUndefined();
  });

  it("end-to-end: archived project — 401 on bootstrap stops collect calls and warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    const dispatch = createDispatcher();
    dispatch(["init", "ptok_archived"]);
    await new Promise((r) => setTimeout(r, 0));
    dispatch(["event", "page_view"]);
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("/collect"))).toHaveLength(0);
    expect(error).not.toHaveBeenCalled();
    // 401 must surface to the site owner unconditionally — it means the tag
    // is doing nothing and the install is broken.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("401"));
  });

  it("end-to-end: bootstrap URL has no project_id and no Authorization header", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("/config")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 202 }));
    });

    const dispatch = createDispatcher();
    dispatch(["init", "ptok_ok", { autoPageView: false }]);
    await new Promise((r) => setTimeout(r, 0));

    const configCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/config"));
    expect(configCall).toBeDefined();
    const [url, init] = configCall!;
    expect(String(url)).toMatch(/\/pixel\/config\?token=ptok_ok$/);
    expect(String(url)).not.toMatch(/projects?\//i);
    const headers = (init as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.["Authorization"]).toBeUndefined();
    expect(headers?.["authorization"]).toBeUndefined();
  });

  it("never calls /pixel/status", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("/config")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 202 }));
    });

    const dispatch = createDispatcher();
    dispatch(["init", "ptok_ok"]);
    await new Promise((r) => setTimeout(r, 0));
    dispatch(["event", "page_view"]);
    await new Promise((r) => setTimeout(r, 0));

    const statusCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/status"));
    expect(statusCalls).toHaveLength(0);
  });
});
