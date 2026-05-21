import type { SourceFields } from "./types.ts";
import { getPalitraParam, getPltContent, parseUtm } from "./url.ts";

const UTM_TO_SOURCE_FIELD: Record<string, keyof SourceFields> = {
  utm_source: "source",
  utm_medium: "medium",
  utm_campaign: "campaign_id",
  utm_content: "ad_id",
  utm_term: "keyword",
};

export function resolveSource(url: string, referrer: string): SourceFields {
  const palitra = getPalitraParam(url);
  if (palitra) {
    return { source: "palitra", ad_id: palitra };
  }

  const utm = parseUtm(url);

  const plt = getPltContent(utm.utm_content);
  if (plt) {
    return plt as SourceFields;
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
      if (refUrl.host !== here.host) {
        return { source: refUrl.host, medium: "referral" };
      }
    } catch {
      // Malformed referrer — fall through to direct.
    }
  }

  return { source: "direct" };
}
