// Logging policy:
//   - Use the injected `logger` (createLogger(debug)) for transient/diagnostic
//     warnings that should stay quiet in production (transport hiccups,
//     malformed config entries, etc.).
//   - Use ACTIVE_LOGGER unconditionally for issues the site owner must see
//     regardless of the debug flag (token rejected, payload dropped, linker
//     corruption, malformed config envelope).
export interface Logger {
  warn(...args: unknown[]): void;
}

const NOOP: Logger = { warn: () => {} };
const ACTIVE: Logger = { warn: (...args) => console.warn(...args) };

export function createLogger(debug: boolean): Logger {
  return debug ? ACTIVE : NOOP;
}

export const NOOP_LOGGER: Logger = NOOP;
export const ACTIVE_LOGGER: Logger = ACTIVE;
