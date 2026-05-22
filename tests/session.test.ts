import { describe, it, expect, beforeEach, vi } from "vitest";
import { ensureSession, getSourceFields, SESSION_KEY } from "../src/session.ts";

describe("ensureSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
    history.replaceState(null, "", "/");
  });

  it("creates a new session on first call and stores source fields", () => {
    history.replaceState(null, "", "/?utm_source=google&utm_campaign=spring");
    ensureSession("https://other.test/");
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    expect(stored).toEqual({
      kind: "utm",
      fields: { source: "google", campaign_id: "spring" },
    });
  });

  it("does not recompute source on subsequent calls", () => {
    history.replaceState(null, "", "/?utm_source=google");
    ensureSession("");
    history.replaceState(null, "", "/?utm_source=facebook");
    ensureSession("");
    expect(getSourceFields()).toEqual({ source: "google" });
  });

  it("strips palitra= from the URL after capturing it", () => {
    history.replaceState(null, "", "/page?palitra=abc&keep=1");
    ensureSession("");
    expect(location.pathname + location.search).toBe("/page?keep=1");
    expect(getSourceFields()).toEqual({ source: "palitra", ad_id: "abc" });
  });

  it("returns empty object from getSourceFields when no session", () => {
    expect(getSourceFields()).toEqual({});
  });

  it("rehydrates source fields from sessionStorage across module reloads", async () => {
    history.replaceState(null, "", "/?utm_source=google&utm_campaign=spring");
    ensureSession("");
    // simulate a fresh page load: storage persists, module state resets
    vi.resetModules();
    const fresh = await import("../src/session.ts");
    expect(fresh.getSourceFields()).toEqual({ source: "google", campaign_id: "spring" });
  });

  it("rejects storage entry without a valid kind tag and rebuilds", () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ source: "old", campaign_id: "stale" }));
    history.replaceState(null, "", "/?utm_source=fresh");
    ensureSession("");
    expect(getSourceFields()).toEqual({ source: "fresh" });
  });

  it("falls back to direct when sessionStorage.setItem throws", async () => {
    const setItem = sessionStorage.setItem.bind(sessionStorage);
    sessionStorage.setItem = () => { throw new Error("quota"); };
    try {
      history.replaceState(null, "", "/?utm_source=google");
      ensureSession("");
      expect(getSourceFields()).toEqual({ source: "google" });
    } finally {
      sessionStorage.setItem = setItem;
    }
  });
});
