const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

function safeParse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function parseUtm(url: string): UtmParams {
  const parsed = safeParse(url);
  if (!parsed) return {};
  const params = parsed.searchParams;
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
  const parsed = safeParse(url);
  if (!parsed) return null;
  const value = parsed.searchParams.get("palitra");
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
  const url = safeParse(location.href);
  if (!url || !url.searchParams.has("palitra")) return;
  url.searchParams.delete("palitra");
  const next =
    url.pathname +
    (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
    url.hash;
  try {
    history.replaceState(history.state, "", next);
  } catch {
    /* sandboxed iframe — leave URL as-is */
  }
}
