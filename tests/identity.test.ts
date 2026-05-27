import { describe, it, expect, beforeEach } from "vitest";
import { setUserId, addLink, collectLinkedIds, UID_KEY, LINKS_KEY } from "../src/identity.ts";
import type { PixelConfig } from "../src/types.ts";

const emptyConfig: PixelConfig = { identity_config: [] };

describe("identity", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie.split(";").forEach((c) => {
      const eq = c.indexOf("=");
      const name = eq > -1 ? c.slice(0, eq).trim() : c.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  });

  it("collectLinkedIds returns empty when nothing is set", () => {
    expect(collectLinkedIds(emptyConfig)).toEqual([]);
  });

  it("setUserId persists and surfaces as id_type=user_id", () => {
    setUserId("U-42");
    expect(localStorage.getItem(UID_KEY)).toBe("U-42");
    expect(collectLinkedIds(emptyConfig)).toEqual([{ id_type: "user_id", id_value: "U-42" }]);
  });

  it("addLink stores and surfaces external IDs", () => {
    addLink("ga4_client_id", "1.2");
    addLink("ym_uid", "9001");
    const ids = collectLinkedIds(emptyConfig);
    expect(ids).toContainEqual({ id_type: "ga4_client_id", id_value: "1.2" });
    expect(ids).toContainEqual({ id_type: "ym_uid", id_value: "9001" });
  });

  it("addLink dedups by id_type, latest wins", () => {
    addLink("ga4_client_id", "old");
    addLink("ga4_client_id", "new");
    expect(collectLinkedIds(emptyConfig)).toEqual([{ id_type: "ga4_client_id", id_value: "new" }]);
  });

  it("rejects invalid id_type silently", () => {
    addLink("BAD-TYPE", "x");
    addLink("", "x");
    addLink("0_starts_with_digit", "x");
    expect(collectLinkedIds(emptyConfig)).toEqual([]);
  });

  it("auto-reads cookies and localStorage per config (new field names)", () => {
    document.cookie = "_ga=GA1.2.123456.789";
    localStorage.setItem("ym_uid", "ym-7");
    const config: PixelConfig = {
      identity_config: [
        { id_type: "ga_client_id", source: "cookie", key: "_ga", value_pattern: "^GA\\d\\.\\d\\.(.+)$" },
        { id_type: "ym_uid", source: "local_storage", key: "ym_uid" },
      ],
    };
    const ids = collectLinkedIds(config);
    expect(ids).toContainEqual({ id_type: "ga_client_id", id_value: "123456.789" });
    expect(ids).toContainEqual({ id_type: "ym_uid", id_value: "ym-7" });
  });

  it("manual link() overrides auto-read for same id_type", () => {
    document.cookie = "_ga=auto-value";
    addLink("ga_client_id", "manual-value");
    const config: PixelConfig = {
      identity_config: [{ id_type: "ga_client_id", source: "cookie", key: "_ga" }],
    };
    expect(collectLinkedIds(config)).toEqual([{ id_type: "ga_client_id", id_value: "manual-value" }]);
  });

  it("user_id always takes precedence over any conflicting id_type=user_id", () => {
    addLink("user_id", "from-link");
    setUserId("from-identify");
    expect(collectLinkedIds(emptyConfig)).toEqual([{ id_type: "user_id", id_value: "from-identify" }]);
  });

  it("caps total at 32 entries (later entries dropped)", () => {
    for (let i = 0; i < 40; i++) {
      addLink(`type_${i.toString().padStart(2, "0")}`, `v${i}`);
    }
    expect(collectLinkedIds(emptyConfig).length).toBe(32);
  });

  it("addLink persists to localStorage under LINKS_KEY", () => {
    addLink("ym_uid", "persisted");
    const raw = localStorage.getItem(LINKS_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "null")).toEqual({ ym_uid: "persisted" });
  });

  it("skips entry when value_pattern does not match", () => {
    document.cookie = "_ga=garbage";
    const config: PixelConfig = {
      identity_config: [
        { id_type: "ga_client_id", source: "cookie", key: "_ga", value_pattern: "^GA\\d\\.\\d\\.(.+)$" },
      ],
    };
    expect(collectLinkedIds(config)).toEqual([]);
  });

  it("skips entry when value_pattern is an invalid regex", () => {
    document.cookie = "_ga=GA1.2.foo";
    const config: PixelConfig = {
      identity_config: [
        { id_type: "ga_client_id", source: "cookie", key: "_ga", value_pattern: "(" },
      ],
    };
    expect(collectLinkedIds(config)).toEqual([]);
  });

  it("uses raw value when value_pattern is absent", () => {
    document.cookie = "_ga=plain";
    const config: PixelConfig = {
      identity_config: [{ id_type: "ga_client_id", source: "cookie", key: "_ga" }],
    };
    expect(collectLinkedIds(config)).toEqual([{ id_type: "ga_client_id", id_value: "plain" }]);
  });
});
