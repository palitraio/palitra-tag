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
  id_type: string;
  storage: "cookie" | "localStorage";
  key: string;
}

export interface PixelConfig {
  identity: IdentityConfigEntry[];
}

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

export const MAX_LINKED_IDS = 32;
export const MAX_ID_VALUE_LENGTH = 1024;
export const MAX_PAYLOAD_BYTES = 64 * 1024;
export const ID_TYPE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
