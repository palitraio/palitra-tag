const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

export function parseUtm(url: string): UtmParams {
  const params = new URL(url).searchParams;
  const out: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      out[key] = value;
    }
  }
  return out;
}

export function getPalitraParam(url: string): string | null {
  const value = new URL(url).searchParams.get("palitra");
  return value && value.length > 0 ? value : null;
}

export function getPltContent(utmContent: string | undefined): Record<string, string> | null {
  if (!utmContent || !utmContent.startsWith("plt||")) {
    return null;
  }
  const body = utmContent.slice("plt||".length);
  const out: Record<string, string> = {};
  for (const segment of body.split("|")) {
    const eq = segment.indexOf("=");
    if (eq <= 0) continue;
    const key = segment.slice(0, eq);
    const value = segment.slice(eq + 1);
    if (key && value) {
      out[key] = value;
    }
  }
  return out;
}

export function stripPalitraParam(): void {
  const url = new URL(location.href);
  if (!url.searchParams.has("palitra")) {
    return;
  }
  url.searchParams.delete("palitra");
  const next =
    url.pathname +
    (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
    url.hash;
  history.replaceState(history.state, "", next);
}
