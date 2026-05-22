import { describe, it, expect } from "vitest";
import { parseCommand } from "../src/command.ts";

describe("parseCommand", () => {
  describe("init", () => {
    it("accepts a non-empty token", () => {
      const r = parseCommand(["init", "ptok_abc"]);
      expect(r).toEqual({ ok: true, command: { t: "init", token: "ptok_abc", options: {} } });
    });

    it("accepts an options object", () => {
      const r = parseCommand(["init", "ptok_abc", { debug: true, autoPageView: false }]);
      expect(r.ok && r.command).toMatchObject({ t: "init", options: { debug: true, autoPageView: false } });
    });

    it("ignores non-object options", () => {
      const r = parseCommand(["init", "ptok_abc", "not-an-object"]);
      expect(r.ok && r.command).toMatchObject({ t: "init", options: {} });
    });

    it("rejects empty token", () => {
      expect(parseCommand(["init", ""])).toMatchObject({ ok: false });
    });

    it("rejects non-string token", () => {
      expect(parseCommand(["init", 42])).toMatchObject({ ok: false });
    });
  });

  describe("identify", () => {
    it("accepts non-empty string user_id", () => {
      expect(parseCommand(["identify", "U-42"])).toEqual({
        ok: true,
        command: { t: "identify", userId: "U-42" },
      });
    });

    it("rejects empty string", () => {
      expect(parseCommand(["identify", ""])).toMatchObject({ ok: false });
    });

    it("rejects non-string", () => {
      expect(parseCommand(["identify", 42])).toMatchObject({ ok: false });
    });
  });

  describe("link", () => {
    it("accepts valid (id_type, id_value)", () => {
      expect(parseCommand(["link", "ga4_client_id", "GA1.2.foo"])).toEqual({
        ok: true,
        command: { t: "link", idType: "ga4_client_id", idValue: "GA1.2.foo" },
      });
    });

    it("rejects id_type with uppercase", () => {
      expect(parseCommand(["link", "BAD", "v"])).toMatchObject({ ok: false });
    });

    it("rejects empty id_value", () => {
      expect(parseCommand(["link", "ga4_client_id", ""])).toMatchObject({ ok: false });
    });

    it("rejects oversize id_value", () => {
      expect(parseCommand(["link", "ga4_client_id", "x".repeat(1100)])).toMatchObject({ ok: false });
    });
  });

  describe("event", () => {
    it("accepts name without props", () => {
      expect(parseCommand(["event", "purchase"])).toEqual({
        ok: true,
        command: { t: "event", name: "purchase" },
      });
    });

    it("accepts name with props object", () => {
      expect(parseCommand(["event", "purchase", { value: 100 }])).toEqual({
        ok: true,
        command: { t: "event", name: "purchase", props: { value: 100 } },
      });
    });

    it("ignores non-object props", () => {
      const r = parseCommand(["event", "purchase", "bad"]);
      expect(r).toEqual({ ok: true, command: { t: "event", name: "purchase" } });
    });

    it("rejects empty name", () => {
      expect(parseCommand(["event", ""])).toMatchObject({ ok: false });
    });
  });

  it("rejects unknown command", () => {
    const r = parseCommand(["nope", "x"]);
    expect(r).toMatchObject({ ok: false, reason: expect.stringContaining("unknown") });
  });
});
