export function installPageViewHooks(onPageView: () => void): () => void {
  let lastHref = location.href;

  const fireIfChanged = (): void => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      onPageView();
    }
  };

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function patched(
    this: History,
    ...args: Parameters<History["pushState"]>
  ): void {
    originalPushState(...args);
    fireIfChanged();
  };
  history.replaceState = function patched(
    this: History,
    ...args: Parameters<History["replaceState"]>
  ): void {
    originalReplaceState(...args);
    fireIfChanged();
  };

  const onPopState = (): void => fireIfChanged();
  window.addEventListener("popstate", onPopState);

  return (): void => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", onPopState);
  };
}
