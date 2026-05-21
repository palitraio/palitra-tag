import { describe, it, expect } from "vitest";
import { resolveSource } from "../src/source.ts";

describe("resolveSource", () => {
  it("returns direct when no URL or referrer signals", () => {
    expect(resolveSource("https://shop.test/", "")).toEqual({ source: "direct" });
  });

  it("uses palitra= when present (highest priority)", () => {
    expect(
      resolveSource(
        "https://shop.test/?palitra=ptag_abc&utm_source=fb&utm_content=plt||source=ig",
        "https://referrer.test/",
      ),
    ).toEqual({ source: "palitra", ad_id: "ptag_abc" });
  });

  it("falls back to plt|| when palitra= absent", () => {
    expect(
      resolveSource(
        "https://shop.test/?utm_content=plt||source=google|campaign_id=spring|ad_id=a99&utm_source=facebook",
        "https://referrer.test/",
      ),
    ).toEqual({ source: "google", campaign_id: "spring", ad_id: "a99" });
  });

  it("falls back to plain UTM when no palitra= and no plt||", () => {
    expect(
      resolveSource(
        "https://shop.test/?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_content=ad42&utm_term=shoes",
        "https://other.test/",
      ),
    ).toEqual({
      source: "google",
      medium: "cpc",
      campaign_id: "spring",
      ad_id: "ad42",
      keyword: "shoes",
    });
  });

  it("uses referrer host when no UTM signals", () => {
    expect(resolveSource("https://shop.test/", "https://news.example/article/1")).toEqual({
      source: "news.example",
      medium: "referral",
    });
  });

  it("treats same-host referrer as direct", () => {
    expect(resolveSource("https://shop.test/page", "https://shop.test/other")).toEqual({ source: "direct" });
  });
});
