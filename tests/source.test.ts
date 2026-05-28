import { describe, it, expect, vi } from "vitest";
import { resolveSource } from "../src/source.ts";

describe("resolveSource", () => {
  it("returns direct when no URL or referrer signals", () => {
    expect(resolveSource("https://shop.test/", "")).toEqual({ kind: "direct" });
  });

  it("falls back to plain UTM when no palitra= and no plt||", () => {
    expect(
      resolveSource(
        "https://shop.test/?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_content=ad42&utm_term=shoes",
        "https://other.test/",
      ),
    ).toEqual({
      kind: "utm",
      fields: {
        source: "google",
        medium: "cpc",
        campaign_id: "spring",
        ad_id: "ad42",
        keyword: "shoes",
      },
    });
  });

  it("uses referrer host when no UTM signals", () => {
    expect(resolveSource("https://shop.test/", "https://news.example/article/1")).toEqual({
      kind: "referral",
      host: "news.example",
    });
  });

  it("treats same-host referrer as direct", () => {
    expect(resolveSource("https://shop.test/page", "https://shop.test/other")).toEqual({
      kind: "direct",
    });
  });
});

describe("resolveSource — Palitra Linker", () => {
  const canonical =
    "v1||yd||cpc||123||456||789||купить+кроссовки||network||mail.ru||sidebar";
  const expectedFields = {
    source: "yd",
    medium: "cpc",
    campaign_id: "123",
    adgroup_id: "456",
    ad_id: "789",
    keyword: "купить+кроссовки",
    placement: "network",
    site: "mail.ru",
    slot: "sidebar",
  };

  it("parses palitra= URL parameter (highest priority — wins over utm_content)", () => {
    expect(
      resolveSource(
        `https://shop.test/?palitra=${encodeURIComponent(canonical)}&utm_content=plt||v1||google||cpc`,
        "https://referrer.test/",
      ),
    ).toEqual({ kind: "linker", origin: "palitra", fields: expectedFields });
  });

  it("parses plt|| prefix in utm_content when palitra= absent", () => {
    expect(
      resolveSource(
        `https://shop.test/?utm_content=${encodeURIComponent("plt||" + canonical)}&utm_source=facebook`,
        "https://referrer.test/",
      ),
    ).toEqual({ kind: "linker", origin: "plt", fields: expectedFields });
  });

  it("produces identical fields from palitra= and plt|| for the same Linker value (parity guarantee)", () => {
    const fromPalitra = resolveSource(
      `https://shop.test/?palitra=${encodeURIComponent(canonical)}`,
      "",
    );
    const fromPlt = resolveSource(
      `https://shop.test/?utm_content=${encodeURIComponent("plt||" + canonical)}`,
      "",
    );
    if (fromPalitra.kind !== "linker" || fromPlt.kind !== "linker") {
      throw new Error("expected linker kind from both locations");
    }
    expect(fromPalitra.fields).toEqual(fromPlt.fields);
  });

  it("omits empty macro segments (||||)", () => {
    const url = `https://shop.test/?palitra=${encodeURIComponent("v1||yd||cpc||||||555")}`;
    expect(resolveSource(url, "")).toEqual({
      kind: "linker",
      origin: "palitra",
      fields: { source: "yd", medium: "cpc", ad_id: "555" },
    });
  });

  it("falls through to UTM fallback when palitra= has unknown version (silent without debug)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const url = `https://shop.test/?palitra=${encodeURIComponent("v99||yd||cpc")}&utm_source=fb&utm_medium=cpc`;
    expect(resolveSource(url, "")).toEqual({
      kind: "utm",
      fields: { source: "fb", medium: "cpc" },
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns on unknown linker version when debug=true", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const url = `https://shop.test/?palitra=${encodeURIComponent("v99||yd||cpc")}`;
    resolveSource(url, "", true);
    expect(warn).toHaveBeenCalledWith("[palitra] unknown linker version:", "v99");
    warn.mockRestore();
  });
});
