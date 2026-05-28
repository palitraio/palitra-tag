import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseUtm, getPalitraParam, getPltContent, parsePalitraLinker, stripPalitraParam } from "../src/url.ts";

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

describe("getPltContent", () => {
  it("returns fields after plt|| prefix in utm_content", () => {
    expect(getPltContent("plt||source=google|campaign_id=c1|ad_id=a1")).toEqual({
      source: "google",
      campaign_id: "c1",
      ad_id: "a1",
    });
  });

  it("returns null when utm_content does not start with plt||", () => {
    expect(getPltContent("plain_ad_id")).toBeNull();
  });

  it("returns null on undefined input", () => {
    expect(getPltContent(undefined)).toBeNull();
  });

  it("ignores malformed segments without =", () => {
    expect(getPltContent("plt||source=g|garbage|ad_id=a")).toEqual({ source: "g", ad_id: "a" });
  });
});

describe("parsePalitraLinker", () => {
  it("parses the canonical Yandex example from data-stitching.md", () => {
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

  it("returns null and warns on unknown version", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parsePalitraLinker("v2||yd||cpc")).toBeNull();
    expect(warn).toHaveBeenCalledWith("[palitra] unknown linker version:", "v2");
    warn.mockRestore();
  });

  it("returns null on empty or missing input without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parsePalitraLinker("")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null on single-segment input (no version)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parsePalitraLinker("anything")).toBeNull();
    expect(warn).toHaveBeenCalledWith("[palitra] unknown linker version:", "anything");
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
});

describe("stripPalitraParam", () => {
  beforeEach(() => {
    history.replaceState(null, "", "/");
  });

  it("removes palitra= and calls history.replaceState", () => {
    history.replaceState(null, "", "/page?palitra=abc&foo=bar");
    const spy = vi.spyOn(history, "replaceState");
    stripPalitraParam();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(location.search).toBe("?foo=bar");
  });

  it("removes trailing question mark when palitra was the only param", () => {
    history.replaceState(null, "", "/page?palitra=abc");
    stripPalitraParam();
    expect(location.pathname + location.search).toBe("/page");
  });

  it("is a no-op when palitra= is absent", () => {
    history.replaceState(null, "", "/page?foo=bar");
    const spy = vi.spyOn(history, "replaceState");
    stripPalitraParam();
    expect(spy).not.toHaveBeenCalled();
  });
});
