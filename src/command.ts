import {
  asEventName,
  asIdType,
  asIdValue,
  asPixelToken,
  type Command,
  type InitOptions,
} from "./types.ts";

export type ParseResult = { ok: true; command: Command } | { ok: false; reason: string };

export function parseCommand(args: unknown[]): ParseResult {
  const name = args[0];

  if (name === "init") {
    const token = asPixelToken(args[1]);
    if (!token) return fail("init: token must be a non-empty string");
    return ok({ t: "init", token, options: asOptions(args[2]) });
  }

  if (name === "identify") {
    const userId = args[1];
    if (typeof userId !== "string" || userId.length === 0) {
      return fail("identify: expected non-empty string user_id");
    }
    return ok({ t: "identify", userId });
  }

  if (name === "link") {
    const idType = asIdType(args[1]);
    if (!idType) return fail("link: id_type must match ^[a-z][a-z0-9_]{0,63}$");
    const idValue = asIdValue(args[2]);
    if (!idValue) return fail("link: id_value must be non-empty string within length limit");
    return ok({ t: "link", idType, idValue });
  }

  if (name === "event") {
    const eventName = asEventName(args[1]);
    if (!eventName) return fail("event: expected non-empty string name");
    const props = asProps(args[2]);
    return ok(props ? { t: "event", name: eventName, props } : { t: "event", name: eventName });
  }

  return fail(`unknown command: ${String(name)}`);
}

function ok(command: Command): ParseResult {
  return { ok: true, command };
}

function fail(reason: string): ParseResult {
  return { ok: false, reason };
}

function asOptions(value: unknown): InitOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as InitOptions;
}

function asProps(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}
