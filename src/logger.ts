export interface Logger {
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const NOOP: Logger = {
  warn: () => {},
  info: () => {},
  error: () => {},
};

const ACTIVE: Logger = {
  warn: (...args) => console.warn(...args),
  info: (...args) => console.info(...args),
  error: (...args) => console.error(...args),
};

export function createLogger(debug: boolean): Logger {
  return debug ? ACTIVE : NOOP;
}

export const NOOP_LOGGER: Logger = NOOP;
export const ACTIVE_LOGGER: Logger = ACTIVE;
