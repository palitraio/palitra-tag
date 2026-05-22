import { describe, it, expect, beforeEach, vi } from "vitest";
import { installPageViewHooks } from "../src/pageview.ts";

describe("installPageViewHooks", () => {
  let onPageView: ReturnType<typeof vi.fn>;
  let uninstall: () => void;

  beforeEach(() => {
    history.replaceState(null, "", "/start");
    onPageView = vi.fn();
    uninstall = installPageViewHooks(onPageView);
  });

  it("fires on history.pushState to a different URL", () => {
    history.pushState(null, "", "/new");
    expect(onPageView).toHaveBeenCalledTimes(1);
  });

  it("fires on history.replaceState to a different URL", () => {
    history.replaceState(null, "", "/replaced");
    expect(onPageView).toHaveBeenCalledTimes(1);
  });

  it("fires on popstate (back/forward) to a different URL", () => {
    history.pushState(null, "", "/a");
    history.pushState(null, "", "/b");
    onPageView.mockClear();
    history.back();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onPageView).toHaveBeenCalled();
  });

  it("does not fire when URL is unchanged", () => {
    history.pushState(null, "", "/start");
    expect(onPageView).not.toHaveBeenCalled();
  });

  it("uninstall restores original pushState and replaceState", () => {
    uninstall();
    history.pushState(null, "", "/x");
    expect(onPageView).not.toHaveBeenCalled();
  });
});
