import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

type WindowBag = Record<string, unknown>;
type Palitra = ((...args: unknown[]) => void) & { q?: unknown[][] };

describe("integration: snippet -> bundle drain", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    history.replaceState(null, "", "/?utm_source=google&utm_campaign=spring");
    fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ identity: [] }), { status: 200 })));
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
});
