import { describe, it, expect } from "vitest";
import {
  asEventName,
  asIdType,
  asIdValue,
  asPixelToken,
  toSourceFields,
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
  it("projects palitra to flat fields", () => {
    expect(toSourceFields({ kind: "palitra", ad_id: "a99" })).toEqual({
      source: "palitra",
      ad_id: "a99",
    });
  });

  it("projects plt by copying fields", () => {
    const fields = { source: "g", campaign_id: "c1" };
    const out = toSourceFields({ kind: "plt", fields });
    expect(out).toEqual(fields);
    expect(out).not.toBe(fields);
  });

  it("projects utm by copying fields", () => {
    expect(toSourceFields({ kind: "utm", fields: { source: "google" } })).toEqual({
      source: "google",
    });
  });

  it("projects referral with medium=referral", () => {
    expect(toSourceFields({ kind: "referral", host: "news.example" })).toEqual({
      source: "news.example",
      medium: "referral",
    });
  });

  it("projects direct", () => {
    expect(toSourceFields({ kind: "direct" })).toEqual({ source: "direct" });
  });
});
