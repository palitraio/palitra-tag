import type { Logger } from "./logger.ts";
import { NOOP_LOGGER } from "./logger.ts";
import type { ResolvedSource, SourceFieldKey, SourceFields } from "./types.ts";
import { getPalitraParam, parsePalitraLinker, parseUtm } from "./url.ts";

const UTM_TO_SOURCE_FIELD: Record<string, SourceFieldKey> = {
  utm_source: "source",
  utm_medium: "medium",
  utm_campaign: "campaign_id",
  utm_content: "ad_id",
  utm_term: "keyword",
};

const PLT_PREFIX = "plt||";

export function resolveSource(
  url: string,
  referrer: string,
  logger: Logger = NOOP_LOGGER,
): ResolvedSource {
  const palitraParam = getPalitraParam(url);
  if (palitraParam) {
    const fields = parsePalitraLinker(palitraParam, logger);
    if (fields) return { kind: "linker", origin: "palitra", fields };
  }

  const utm = parseUtm(url);

  if (utm.utm_content && utm.utm_content.startsWith(PLT_PREFIX)) {
    const fields = parsePalitraLinker(utm.utm_content.slice(PLT_PREFIX.length), logger);
    if (fields) return { kind: "linker", origin: "plt", fields };
  }

  if (Object.keys(utm).length > 0) {
    const fields: SourceFields = {};
    for (const [utmKey, value] of Object.entries(utm)) {
      const field = UTM_TO_SOURCE_FIELD[utmKey];
      if (field && value) {
        fields[field] = value;
      }
    }
    return { kind: "utm", fields };
  }

  if (referrer) {
    try {
      const refUrl = new URL(referrer);
      const here = new URL(url);
      if (refUrl.host && refUrl.host !== here.host) {
        return { kind: "referral", host: refUrl.host };
      }
    } catch {
      // Malformed referrer — fall through to direct.
    }
  }

  return { kind: "direct" };
}
