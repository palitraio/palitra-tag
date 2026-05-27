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

export interface PixelEvent extends SourceFields {
  event: string;
  url: string;
  referrer?: string;
  linked_ids?: LinkedId[];
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

export type ResolvedSource =
  | { kind: "palitra"; ad_id: string }
  | { kind: "plt"; fields: SourceFields }
  | { kind: "utm"; fields: SourceFields }
  | { kind: "referral"; host: string }
  | { kind: "direct" };

export const RESOLVED_SOURCE_KINDS: ReadonlySet<ResolvedSource["kind"]> = new Set([
  "palitra",
  "plt",
  "utm",
  "referral",
  "direct",
]);

export function toSourceFields(src: ResolvedSource): SourceFields {
  switch (src.kind) {
    case "palitra":
      return { source: "palitra", ad_id: src.ad_id };
    case "plt":
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
