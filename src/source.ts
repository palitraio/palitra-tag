import type { SourceFieldKey, SourceFields } from "./types.ts";
import { SOURCE_FIELD_KEYS } from "./types.ts";
import { getPalitraParam, getPltContent, parseUtm } from "./url.ts";

const UTM_TO_SOURCE_FIELD: Record<string, SourceFieldKey> = {
  utm_source: "source",
  utm_medium: "medium",
  utm_campaign: "campaign_id",
  utm_content: "ad_id",
  utm_term: "keyword",
};

const SOURCE_FIELD_SET: ReadonlySet<string> = new Set(SOURCE_FIELD_KEYS);

export function resolveSource(url: string, referrer: string): SourceFields {
  const palitra = getPalitraParam(url);
  if (palitra) {
    return { source: "palitra", ad_id: palitra };
  }

  const utm = parseUtm(url);

  const plt = getPltContent(utm.utm_content);
  if (plt) {
    const filtered: SourceFields = {};
    for (const [key, value] of Object.entries(plt)) {
      if (SOURCE_FIELD_SET.has(key) && value) {
        filtered[key as SourceFieldKey] = value;
      }
    }
    return filtered;
  }

  if (Object.keys(utm).length > 0) {
    const out: SourceFields = {};
    for (const [utmKey, value] of Object.entries(utm)) {
      const field = UTM_TO_SOURCE_FIELD[utmKey];
      if (field && value) {
        out[field] = value;
      }
    }
    return out;
  }

  if (referrer) {
    try {
      const refUrl = new URL(referrer);
      const here = new URL(url);
      if (refUrl.host && refUrl.host !== here.host) {
        return { source: refUrl.host, medium: "referral" };
      }
    } catch {
      // Malformed referrer — fall through to direct.
    }
  }

  return { source: "direct" };
}
