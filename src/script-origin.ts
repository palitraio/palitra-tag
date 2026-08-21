/**
 * The origin the tag itself was served from.
 *
 * `document.currentScript` is non-null only while the script body is being evaluated. Reading
 * it any later — inside an async init, or from a `palitra('init', …)` call the site makes
 * after load — yields null, and the fallback would then be the CUSTOMER's origin, which
 * silently points every event at a host that does not run Palitra. So it is captured once, at
 * bootstrap, and read from here afterwards.
 */
let captured = "";

export function captureScriptOrigin(): void {
  const current = document.currentScript;
  const src = current && "src" in current ? current.src : "";
  captured = src ? new URL(src, document.baseURI).origin : "";
}

export function scriptOrigin(): string {
  return captured || location.origin;
}
