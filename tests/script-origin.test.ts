import { beforeEach, describe, expect, it } from "vitest";

import { captureScriptOrigin, scriptOrigin } from "../src/script-origin.ts";

function setCurrentScript(src: string | null): void {
  const value = src === null ? null : Object.assign(document.createElement("script"), { src });
  Object.defineProperty(document, "currentScript", { value, configurable: true });
}

describe("scriptOrigin", () => {
  beforeEach(() => {
    setCurrentScript(null);
    captureScriptOrigin();
  });

  it("returns the origin the tag was loaded from", () => {
    setCurrentScript("https://tag.example.com/palitra.js");
    captureScriptOrigin();
    expect(scriptOrigin()).toBe("https://tag.example.com");
  });

  it("ignores the path and query of the script URL", () => {
    setCurrentScript("https://tag.example.com/v1.2.3/palitra.js?cb=1");
    captureScriptOrigin();
    expect(scriptOrigin()).toBe("https://tag.example.com");
  });

  it("falls back to the page origin when there is no current script", () => {
    setCurrentScript(null);
    captureScriptOrigin();
    expect(scriptOrigin()).toBe(location.origin);
  });

  it("keeps the captured origin after currentScript is cleared", () => {
    setCurrentScript("https://tag.example.com/palitra.js");
    captureScriptOrigin();
    setCurrentScript(null);
    expect(scriptOrigin()).toBe("https://tag.example.com");
  });
});
