import { parseCommand } from "./command.ts";
import { fetchConfig } from "./config.ts";
import { splitEventPayload } from "./event-payload.ts";
import { addLink, collectLinkedIds, setUserId } from "./identity.ts";
import { createLogger } from "./logger.ts";
import type { Logger } from "./logger.ts";
import { installPageViewHooks } from "./pageview.ts";
import { ensureSession, getSourceFields } from "./session.ts";
import { Transport } from "./transport.ts";
import type {
  Command,
  EventName,
  InitOptions,
  PixelConfig,
  PixelEvent,
  PixelToken,
  ResolvedOptions,
} from "./types.ts";
import { DEFAULT_OPTIONS } from "./types.ts";

interface State {
  options: ResolvedOptions;
  logger: Logger;
  transport: Transport;
  config: PixelConfig;
}

export function createDispatcher(): (args: unknown[]) => void {
  let state: State | null = null;
  let initializing = false;
  let buffered: Command[] = [];

  function handle(args: unknown[]): void {
    const result = parseCommand(args);
    if (!result.ok) {
      state?.logger.warn(`[palitra] ${result.reason}`);
      return;
    }
    dispatch(result.command);
  }

  function dispatch(command: Command): void {
    if (command.t === "init") {
      if (state !== null || initializing) {
        state?.logger.warn("[palitra] init called more than once — ignoring");
        return;
      }
      runInit(command.token, command.options).catch((err) => {
        initializing = false;
        createLogger(command.options.debug ?? false).warn("[palitra] init failed:", err);
      });
      return;
    }
    if (state === null) {
      if (initializing) buffered.push(command);
      return;
    }
    run(command, state);
  }

  async function runInit(token: PixelToken, opts: InitOptions): Promise<void> {
    initializing = true;
    const options: ResolvedOptions = { ...DEFAULT_OPTIONS, ...opts };
    const logger = createLogger(options.debug);
    ensureSession(document.referrer);
    const result = await fetchConfig(options.endpoint, token, logger);
    if (result.kind === "stopped") {
      buffered = [];
      initializing = false;
      return;
    }
    const transport = new Transport({ endpoint: options.endpoint, token, logger });
    state = { options, logger, transport, config: result.config };

    if (options.autoPageView) {
      installPageViewHooks(() => {
        if (state) run({ t: "event", name: "page_view" as EventName }, state);
      });
      run({ t: "event", name: "page_view" as EventName }, state);
    }

    const pending = buffered;
    buffered = [];
    initializing = false;
    for (const cmd of pending) {
      run(cmd, state);
    }

    window.addEventListener("pagehide", () => transport.flushOnUnload());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        transport.flushOnUnload();
      }
    });
  }

  function run(command: Command, current: State): void {
    switch (command.t) {
      case "init":
        current.logger.warn("[palitra] init called more than once — ignoring");
        return;
      case "identify":
        setUserId(command.userId);
        return;
      case "link":
        addLink(command.idType, command.idValue);
        return;
      case "event":
        emit(command.name, command.props, current).catch((err) => {
          current.logger.warn("[palitra] emit failed:", err);
        });
        return;
    }
  }

  function emit(
    name: EventName,
    props: Record<string, unknown> | undefined,
    current: State,
  ): Promise<void> {
    ensureSession(document.referrer)
    const linked = collectLinkedIds(current.config)
    const referrer = document.referrer || undefined
    const { fields, items, properties } = splitEventPayload(props)
    const event: PixelEvent = {
      event: name,
      url: location.href,
      ...(referrer !== undefined ? { referrer } : {}),
      ...getSourceFields(),
      ...(linked.length > 0 ? { linked_ids: linked } : {}),
      ...fields,
      ...(items !== undefined ? { items } : {}),
      ...(properties !== undefined ? { properties } : {}),
    }
    return current.transport.send(event)
  }

  return handle;
}
