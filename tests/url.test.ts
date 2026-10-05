import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseUtm, getPalitraParam, parsePalitraLinker, withoutPalitraParam } from "../src/url.ts";

describe("parseUtm", () => {
  it("extracts utm_source, utm_medium, utm_campaign, utm_content, utm_term", () => {
    const url = "https://x.test/?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_content=ad1&utm_term=shoes";
    expect(parseUtm(url)).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
      utm_content: "ad1",
      utm_term: "shoes",
    });
  });

  it("returns empty object when no utm params", () => {
    expect(parseUtm("https://x.test/")).toEqual({});
  });

  it("ignores unrelated query params", () => {
    expect(parseUtm("https://x.test/?foo=bar&utm_source=g")).toEqual({ utm_source: "g" });
  });
});

describe("getPalitraParam", () => {
  it("returns value of ?palitra=", () => {
    expect(getPalitraParam("https://x.test/?palitra=abc123")).toBe("abc123");
  });

  it("returns null when missing", () => {
    expect(getPalitraParam("https://x.test/?utm_source=x")).toBeNull();
  });

  it("returns null on empty value", () => {
    expect(getPalitraParam("https://x.test/?palitra=")).toBeNull();
  });
});

describe("parsePalitraLinker", () => {
  it("parses the canonical Yandex example", () => {
    expect(
      parsePalitraLinker("v1||yd||cpc||123456||789||555||купить+кроссовки||network||mail.ru||sidebar"),
    ).toEqual({
      source: "yd",
      medium: "cpc",
      campaign_id: "123456",
      adgroup_id: "789",
      ad_id: "555",
      keyword: "купить+кроссовки",
      placement: "network",
      site: "mail.ru",
      slot: "sidebar",
    });
  });

  it("parses a Google Ads example", () => {
    expect(
      parsePalitraLinker("v1||google||cpc||c-1||g-1||a-1||shoes||search||||top"),
    ).toEqual({
      source: "google",
      medium: "cpc",
      campaign_id: "c-1",
      adgroup_id: "g-1",
      ad_id: "a-1",
      keyword: "shoes",
      placement: "search",
      slot: "top",
    });
  });

  it("omits empty segments (unfilled macros)", () => {
    expect(parsePalitraLinker("v1||yd||cpc||||||555||||network||mail.ru||")).toEqual({
      source: "yd",
      medium: "cpc",
      ad_id: "555",
      placement: "network",
      site: "mail.ru",
    });
  });

  it("omits absent trailing positions", () => {
    expect(parsePalitraLinker("v1||yd||cpc||123")).toEqual({
      source: "yd",
      medium: "cpc",
      campaign_id: "123",
    });
  });

  it("warns unconditionally on unknown version and returns null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parsePalitraLinker("v2||yd||cpc")).toBeNull();
    expect(warn).toHaveBeenCalledWith("[palitra] unknown linker version:", "v2");
    warn.mockRestore();
  });

  it("returns null on empty or missing input without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parsePalitraLinker("")).toBeNull();
    expect(parsePalitraLinker(null)).toBeNull();
    expect(parsePalitraLinker(undefined)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns unconditionally on single-segment input and returns null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parsePalitraLinker("anything")).toBeNull();
    expect(warn).toHaveBeenCalledWith("[palitra] unknown linker version:", "anything");
    warn.mockRestore();
  });

  it("returns null and warns when all positional segments are empty", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parsePalitraLinker("v1||||||||||||||||")).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "[palitra] linker has no non-empty fields:",
      "v1||||||||||||||||",
    );
    warn.mockRestore();
  });

  it("ignores positions beyond slot (index 9)", () => {
    expect(parsePalitraLinker("v1||yd||cpc||c||g||a||k||p||s||t||extra||more")).toEqual({
      source: "yd",
      medium: "cpc",
      campaign_id: "c",
      adgroup_id: "g",
      ad_id: "a",
      keyword: "k",
      placement: "p",
      site: "s",
      slot: "t",
    });
  });

  it("does not double-decode segments — receives already-decoded text from URLSearchParams", () => {
    // A real linker delivered via `?palitra=...` is URL-decoded once by
    // URLSearchParams before reaching the parser. The parser itself must not
    // decode again, so a segment containing literal `%20` or `&` is preserved.
    expect(parsePalitraLinker("v1||yd||cpc||c-1||g-1||a-1||hello%20world&utm=fake")).toEqual({
      source: "yd",
      medium: "cpc",
      campaign_id: "c-1",
      adgroup_id: "g-1",
      ad_id: "a-1",
      keyword: "hello%20world&utm=fake",
    });
  });
});

describe("withoutPalitraParam", () => {
  it("drops palitra= and keeps the other params and the hash", () => {
    expect(withoutPalitraParam("https://x.test/page?palitra=abc&foo=bar#top")).toBe(
      "https://x.test/page?foo=bar#top",
    );
  });

  it("drops the trailing question mark when palitra was the only param", () => {
    expect(withoutPalitraParam("https://x.test/page?palitra=abc")).toBe("https://x.test/page");
  });

  it("returns the URL untouched when palitra= is absent or the URL is unparseable", () => {
    expect(withoutPalitraParam("https://x.test/page?a=b%20c")).toBe("https://x.test/page?a=b%20c");
    expect(withoutPalitraParam("not a url")).toBe("not a url");
  });
});

describe("schedulePalitraStrip", () => {
  let url: typeof import("../src/url.ts");
  const path = (): string => location.pathname + location.search + location.hash;

  beforeEach(async () => {
    vi.useFakeTimers();
    history.replaceState(null, "", "/");
    vi.resetModules();
    url = await import("../src/url.ts");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps palitra= in the address bar until the delay after load has elapsed", () => {
    history.replaceState({ route: 1 }, "", "/page?palitra=abc&foo=bar#sec");
    url.schedulePalitraStrip();
    vi.advanceTimersByTime(url.PALITRA_STRIP_DELAY_MS - 1);
    expect(path()).toBe("/page?palitra=abc&foo=bar#sec");
    vi.advanceTimersByTime(1);
    expect(path()).toBe("/page?foo=bar#sec");
    expect(history.state).toEqual({ route: 1 });
  });

  it("starts the delay only once the page has finished loading", () => {
    Object.defineProperty(document, "readyState", { configurable: true, value: "interactive" });
    history.replaceState(null, "", "/page?palitra=abc");
    try {
      url.schedulePalitraStrip();
    } finally {
      Reflect.deleteProperty(document, "readyState");
    }
    vi.advanceTimersByTime(url.PALITRA_STRIP_DELAY_MS * 10);
    expect(path()).toBe("/page?palitra=abc");
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(url.PALITRA_STRIP_DELAY_MS - 1);
    expect(path()).toBe("/page?palitra=abc");
    vi.advanceTimersByTime(1);
    expect(path()).toBe("/page");
  });

  it("leaves the URL and state alone when an SPA navigated away from palitra= first", () => {
    history.replaceState(null, "", "/landing?palitra=abc");
    url.schedulePalitraStrip();
    history.pushState({ route: "cart" }, "", "/cart?step=2");
    const replace = vi.spyOn(history, "replaceState");
    vi.advanceTimersByTime(url.PALITRA_STRIP_DELAY_MS);
    expect(replace).not.toHaveBeenCalled();
    expect(path()).toBe("/cart?step=2");
    expect(history.state).toEqual({ route: "cart" });
  });

  it("strips the current URL, not the landing one, when an SPA kept palitra= on navigation", () => {
    history.replaceState({ route: "landing" }, "", "/landing?palitra=abc");
    url.schedulePalitraStrip();
    history.pushState({ route: "cart" }, "", "/cart?palitra=abc&step=2");
    vi.advanceTimersByTime(url.PALITRA_STRIP_DELAY_MS);
    expect(path()).toBe("/cart?step=2");
    expect(history.state).toEqual({ route: "cart" });
  });

  it("strips at most once per page load", () => {
    history.replaceState(null, "", "/page?palitra=abc");
    url.schedulePalitraStrip();
    url.schedulePalitraStrip();
    vi.advanceTimersByTime(url.PALITRA_STRIP_DELAY_MS);
    expect(path()).toBe("/page");
    history.pushState(null, "", "/next?palitra=again");
    url.schedulePalitraStrip();
    vi.advanceTimersByTime(url.PALITRA_STRIP_DELAY_MS);
    expect(path()).toBe("/next?palitra=again");
  });

  it("never touches history when palitra= is absent", () => {
    history.replaceState(null, "", "/page?foo=bar");
    const replace = vi.spyOn(history, "replaceState");
    url.schedulePalitraStrip();
    vi.advanceTimersByTime(url.PALITRA_STRIP_DELAY_MS);
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves the URL as-is when history.replaceState throws (sandboxed iframe)", () => {
    history.replaceState(null, "", "/page?palitra=abc");
    vi.spyOn(history, "replaceState").mockImplementation(() => {
      throw new DOMException("sandboxed", "SecurityError");
    });
    url.schedulePalitraStrip();
    expect(() => vi.advanceTimersByTime(url.PALITRA_STRIP_DELAY_MS)).not.toThrow();
    expect(path()).toBe("/page?palitra=abc");
  });
});
