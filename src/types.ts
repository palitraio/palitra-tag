export interface LinkedId {
  id_type: string;
  id_value: string;
}

export interface PixelEvent {
  event: string;
  url: string;
  referrer?: string;
  linked_ids?: LinkedId[];
  properties?: Record<string, unknown>;
  timestamp?: string;

  source?: string;
  medium?: string;
  campaign_id?: string;
  adgroup_id?: string;
  ad_id?: string;
  keyword?: string;
  placement?: string;
  site?: string;
  slot?: string;
}

export interface IdentityConfigEntry {
  id_type: string;
  storage: "cookie" | "localStorage";
  key: string;
}

export interface PixelConfig {
  identity: IdentityConfigEntry[];
}

export interface SourceFields {
  source?: string;
  medium?: string;
  campaign_id?: string;
  adgroup_id?: string;
  ad_id?: string;
  keyword?: string;
  placement?: string;
  site?: string;
  slot?: string;
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

export const MAX_LINKED_IDS = 32;
export const MAX_PAYLOAD_BYTES = 64 * 1024;
export const ID_TYPE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
