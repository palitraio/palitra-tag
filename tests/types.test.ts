import { describe, it, expect } from "vitest";
import {
  asEventName,
  asIdType,
  asIdValue,
  asPixelToken,
  toSourceFields,
  type ResolvedSource,
} from "../src/types.ts";

describe("smart constructors", () => {
  it("asPixelToken accepts non-empty strings", () => {
    expect(asPixelToken("ptok_x")).toBe("ptok_x");
    expect(asPixelToken("")).toBeNull();
    expect(asPixelToken(42)).toBeNull();
    expect(asPixelToken(null)).toBeNull();
  });

  it("asIdType enforces ^[a-z][a-z0-9_]{0,63}$", () => {
    expect(asIdType("ga4_client_id")).toBe("ga4_client_id");
    expect(asIdType("a")).toBe("a");
    expect(asIdType("BAD")).toBeNull();
    expect(asIdType("0starts_with_digit")).toBeNull();
    expect(asIdType("has-dash")).toBeNull();
    expect(asIdType("a".repeat(65))).toBeNull();
  });

  it("asIdValue enforces non-empty and length cap", () => {
    expect(asIdValue("v")).toBe("v");
    expect(asIdValue("")).toBeNull();
    expect(asIdValue("x".repeat(1024))).not.toBeNull();
    expect(asIdValue("x".repeat(1025))).toBeNull();
    expect(asIdValue(42)).toBeNull();
  });

  it("asEventName accepts any non-empty string", () => {
    expect(asEventName("page_view")).toBe("page_view");
    expect(asEventName("")).toBeNull();
    expect(asEventName(undefined)).toBeNull();
  });
});

describe("toSourceFields", () => {
  it("emits all linker fields verbatim (palitra= origin)", () => {
    const resolved: ResolvedSource = {
      kind: "linker",
      origin: "palitra",
      fields: {
        source: "yd",
        medium: "cpc",
        campaign_id: "123",
        adgroup_id: "456",
        ad_id: "789",
        keyword: "kw",
        placement: "net",
        site: "mail.ru",
        slot: "sidebar",
      },
    };
    expect(toSourceFields(resolved)).toEqual({
      source: "yd",
      medium: "cpc",
      campaign_id: "123",
      adgroup_id: "456",
      ad_id: "789",
      keyword: "kw",
      placement: "net",
      site: "mail.ru",
      slot: "sidebar",
    });
  });

  it("emits identical payload for palitra= and plt|| origins on the same fields", () => {
    const fields = { source: "yd", medium: "cpc", ad_id: "555" };
    const fromPalitra = toSourceFields({ kind: "linker", origin: "palitra", fields });
    const fromPlt = toSourceFields({ kind: "linker", origin: "plt", fields });
    expect(fromPalitra).toEqual(fromPlt);
    expect(fromPalitra).not.toBe(fields);
  });

  it("emits utm fields as-is", () => {
    expect(
      toSourceFields({ kind: "utm", fields: { source: "google", medium: "cpc" } }),
    ).toEqual({ source: "google", medium: "cpc" });
  });

  it("emits referral as host + referral medium", () => {
    expect(toSourceFields({ kind: "referral", host: "news.example" })).toEqual({
      source: "news.example",
      medium: "referral",
    });
  });

  it("emits direct as source=direct", () => {
    expect(toSourceFields({ kind: "direct" })).toEqual({ source: "direct" });
  });
});
