import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createDispatcher } from "../src/core.ts";

const TOKEN = "ptok_test";

describe("createDispatcher", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let dispatch: (args: unknown[]) => void;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    history.replaceState(null, "", "/start");
    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    dispatch = createDispatcher();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("init fetches /config and fires initial page_view", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    dispatch(["init", TOKEN]);
    await new Promise((r) => setTimeout(r, 0));
    const configCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/config"));
    const collectCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/collect"));
    expect(configCall).toBeDefined();
    expect(collectCall).toBeDefined();
    const body = JSON.parse(collectCall![1].body as string);
    expect(body.event).toBe("page_view");
  });

  it("init is idempotent — second call is a no-op", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }));
    dispatch(["init", TOKEN]);
    dispatch(["init", TOKEN]);
    await new Promise((r) => setTimeout(r, 0));
    const configCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/config"));
    expect(configCalls.length).toBe(1);
  });

  it("event sends with source fields from session", async () => {
    history.replaceState(null, "", "/start?utm_source=google");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }));
    dispatch(["init", TOKEN]);
    await new Promise((r) => setTimeout(r, 0));
    dispatch(["event", "purchase", { value: 100 }]);
    await new Promise((r) => setTimeout(r, 0));
    const purchase = fetchMock.mock.calls
      .map((c) => JSON.parse(String(c[1]?.body ?? "null")))
      .find((b) => b?.event === "purchase");
    expect(purchase).toMatchObject({
      event: "purchase",
      value: 100,
      source: "google",
    });
    expect(purchase.properties).toBeUndefined();
  });

  it("lifts GA4 event-level fields and items to top level, keeps custom keys in properties", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }));
    dispatch(["init", TOKEN]);
    await new Promise((r) => setTimeout(r, 0));
    dispatch([
      "event",
      "purchase",
      {
        value: 5900,
        currency: "RUB",
        transaction_id: "ord-1",
        items: [{ item_id: "sku-1", price: 5900, quantity: 1 }],
        affiliate_network: "cj",
      },
    ]);
    await new Promise((r) => setTimeout(r, 0));
    const purchase = fetchMock.mock.calls
      .map((c) => JSON.parse(String(c[1]?.body ?? "null")))
      .find((b) => b?.event === "purchase");
    expect(purchase).toMatchObject({
      event: "purchase",
      value: 5900,
      currency: "RUB",
      transaction_id: "ord-1",
      items: [{ item_id: "sku-1", price: 5900, quantity: 1 }],
      properties: { affiliate_network: "cj" },
    });
  });

  it("identify attaches user_id linked_id to subsequent events", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }));
    dispatch(["init", TOKEN]);
    await new Promise((r) => setTimeout(r, 0));
    dispatch(["identify", "U-7"]);
    dispatch(["event", "purchase"]);
    await new Promise((r) => setTimeout(r, 0));
    const purchase = fetchMock.mock.calls
      .map((c) => JSON.parse(String(c[1]?.body ?? "null")))
      .find((b) => b?.event === "purchase");
    expect(purchase.linked_ids).toContainEqual({ id_type: "user_id", id_value: "U-7" });
  });

  it("link adds external IDs to subsequent events", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }));
    dispatch(["init", TOKEN]);
    await new Promise((r) => setTimeout(r, 0));
    dispatch(["link", "ga4_client_id", "1.42"]);
    dispatch(["event", "click"]);
    await new Promise((r) => setTimeout(r, 0));
    const click = fetchMock.mock.calls
      .map((c) => JSON.parse(String(c[1]?.body ?? "null")))
      .find((b) => b?.event === "click");
    expect(click.linked_ids).toContainEqual({ id_type: "ga4_client_id", id_value: "1.42" });
  });

  it("commands before init are buffered and replayed after init resolves", async () => {
    let resolveConfig!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { resolveConfig = resolve; }),
    );
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    dispatch(["init", TOKEN]);
    dispatch(["identify", "U-9"]);
    dispatch(["event", "early"]);
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/collect")).length,
    ).toBe(0);
    resolveConfig(new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const earlyCall = fetchMock.mock.calls
      .map((c) => JSON.parse(String(c[1]?.body ?? "null")))
      .find((b) => b?.event === "early");
    expect(earlyCall.linked_ids).toContainEqual({ id_type: "user_id", id_value: "U-9" });
  });

  it("event without init is silently dropped", async () => {
    dispatch(["event", "orphan"]);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops init on 401: no /collect calls, no page_view, queued commands dropped", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Override the global fetchMock to return 401 on /config
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("/config")) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      return Promise.resolve(new Response(null, { status: 202 }));
    });

    dispatch(["init", TOKEN, { autoPageView: true }]);
    dispatch(["event", "purchase", { value: 1 }]);

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const collectCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/collect"));
    expect(collectCalls).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("401"));
    warn.mockRestore();
  });

  it("auto page_view fires on history.pushState after init", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { identity_config: [] } }), { status: 200 }));
    dispatch(["init", TOKEN]);
    await new Promise((r) => setTimeout(r, 0));
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    history.pushState(null, "", "/new-page");
    await new Promise((r) => setTimeout(r, 0));
    const pv = fetchMock.mock.calls
      .map((c) => JSON.parse(String(c[1]?.body ?? "null")))
      .find((b) => b?.event === "page_view");
    expect(pv).toBeTruthy();
    expect(pv.url).toContain("/new-page");
  });
});
