declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type PixelToken = Brand<string, "PixelToken">;
export type IdType = Brand<string, "IdType">;
export type IdValue = Brand<string, "IdValue">;
export type EventName = Brand<string, "EventName">;

export const MAX_LINKED_IDS = 32;
export const MAX_ID_VALUE_LENGTH = 1024;
export const MAX_PAYLOAD_BYTES = 64 * 1024;
export const ID_TYPE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export function asPixelToken(value: unknown): PixelToken | null {
  return typeof value === "string" && value.length > 0 ? (value as PixelToken) : null;
}

export function asIdType(value: unknown): IdType | null {
  return typeof value === "string" && ID_TYPE_PATTERN.test(value) ? (value as IdType) : null;
}

export function asIdValue(value: unknown): IdValue | null {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_VALUE_LENGTH
    ? (value as IdValue)
    : null;
}

export function asEventName(value: unknown): EventName | null {
  return typeof value === "string" && value.length > 0 ? (value as EventName) : null;
}

export interface LinkedId {
  id_type: string;
  id_value: string;
}

// GA4 items[] schema, mirrored verbatim per ADR-010. item_id is the only
// required field; the tag does not validate types — the backend does.
export interface EventItem {
  item_id: string;
  item_name?: string;
  item_brand?: string;
  item_category?: string;
  item_category2?: string;
  item_category3?: string;
  item_category4?: string;
  item_category5?: string;
  item_variant?: string;
  coupon?: string;
  item_list_id?: string;
  item_list_name?: string;
  affiliation?: string;
  location_id?: string;
  price?: number;
  quantity?: number;
  discount?: number;
  index?: number;
  properties?: Record<string, unknown>;
}

export const EVENT_LEVEL_KEYS = [
  "value",
  "currency",
  "transaction_id",
  "coupon",
  "shipping",
  "tax",
] as const;

export interface EventLevelFields {
  value?: number;
  currency?: string;
  transaction_id?: string;
  coupon?: string;
  shipping?: number;
  tax?: number;
}

export interface PixelEvent extends SourceFields, EventLevelFields {
  event: string;
  url: string;
  referrer?: string;
  linked_ids?: LinkedId[];
  items?: EventItem[];
  properties?: Record<string, unknown>;
  timestamp?: string;
}

export interface IdentityConfigEntry {
  readonly id_type: string;
  readonly source: "cookie" | "local_storage";
  readonly key: string;
  readonly value_pattern?: RegExp;
}

export interface PixelConfig {
  readonly identity_config: readonly IdentityConfigEntry[];
}

export type StopReason = "unauthorized";

export type BootstrapResult =
  | { kind: "ready"; config: PixelConfig }
  | { kind: "stopped"; reason: StopReason };

export const SOURCE_FIELD_KEYS = [
  "source",
  "medium",
  "campaign_id",
  "adgroup_id",
  "ad_id",
  "keyword",
  "placement",
  "site",
  "slot",
] as const;

export type SourceFieldKey = (typeof SOURCE_FIELD_KEYS)[number];

export type SourceFields = Partial<Record<SourceFieldKey, string>>;

export type LinkerOrigin = "palitra" | "plt";

export type ResolvedSource =
  | { kind: "linker"; origin: LinkerOrigin; fields: SourceFields }
  | { kind: "utm"; fields: SourceFields }
  | { kind: "referral"; host: string }
  | { kind: "direct" };

export const RESOLVED_SOURCE_KINDS: ReadonlySet<ResolvedSource["kind"]> = new Set([
  "linker",
  "utm",
  "referral",
  "direct",
]);

export function toSourceFields(src: ResolvedSource): SourceFields {
  switch (src.kind) {
    case "linker":
    case "utm":
      return { ...src.fields };
    case "referral":
      return { source: src.host, medium: "referral" };
    case "direct":
      return { source: "direct" };
  }
}

export interface InitOptions {
  endpoint?: string;
  autoPageView?: boolean;
  debug?: boolean;
}

export interface ResolvedOptions {
  endpoint: string;
  autoPageView: boolean;
  debug: boolean;
}

export const DEFAULT_OPTIONS: ResolvedOptions = {
  endpoint: "https://api.palitra.io/api/v1/pixel",
  autoPageView: true,
  debug: false,
};

export type Command =
  | { t: "init"; token: PixelToken; options: InitOptions }
  | { t: "identify"; userId: string }
  | { t: "link"; idType: IdType; idValue: IdValue }
  | { t: "event"; name: EventName; props?: Record<string, unknown> };
