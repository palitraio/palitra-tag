import { fetchConfig } from "./config.ts";
import { addLink, collectLinkedIds, setUserId } from "./identity.ts";
import { installPageViewHooks } from "./pageview.ts";
import { ensureSession, getSourceFields } from "./session.ts";
import { Transport } from "./transport.ts";
import type { InitOptions, PixelConfig, PixelEvent, ResolvedOptions } from "./types.ts";
import { DEFAULT_OPTIONS } from "./types.ts";

type Command = unknown[];

interface State {
  options: ResolvedOptions;
  token: string;
  transport: Transport;
  config: PixelConfig;
}

export function createDispatcher(): (args: Command) => void {
  let state: State | null = null;
  let initializing = false;
  let buffered: Command[] = [];

  function handle(args: Command): void {
    const name = args[0];
    if (name === "init") {
      if (state !== null || initializing) {
        if (state?.options.debug) {
          console.warn("[palitra] init called more than once — ignoring");
        }
        return;
      }
      const token = args[1];
      const opts = (args[2] as InitOptions | undefined) ?? {};
      if (typeof token !== "string" || token.length === 0) return;
      void runInit(token, opts);
      return;
    }
    if (state === null) {
      if (initializing) {
        buffered.push(args);
      }
      return;
    }
    runCommand(args, state);
  }

  async function runInit(token: string, opts: InitOptions): Promise<void> {
    initializing = true;
    const options: ResolvedOptions = { ...DEFAULT_OPTIONS, ...opts };
    const config = await fetchConfig(options.endpoint, token);
    const transport = new Transport({ endpoint: options.endpoint, token, debug: options.debug });
    state = { options, token, transport, config };

    ensureSession(document.referrer);

    if (options.autoPageView) {
      installPageViewHooks(() => {
        if (state) runCommand(["event", "page_view"], state);
      });
      runCommand(["event", "page_view"], state);
    }

    const pending = buffered;
    buffered = [];
    initializing = false;
    for (const cmd of pending) {
      runCommand(cmd, state);
    }

    window.addEventListener("pagehide", () => transport.flushOnUnload());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        transport.flushOnUnload();
      }
    });
  }

  function runCommand(args: Command, current: State): void {
    const [name, a, b] = args;
    switch (name) {
      case "identify":
        if (typeof a === "string") setUserId(a);
        return;
      case "link":
        if (typeof a === "string" && typeof b === "string") addLink(a, b);
        return;
      case "event":
        if (typeof a === "string") {
          void emit(a, b as Record<string, unknown> | undefined, current);
        }
        return;
      default:
        if (current.options.debug) {
          console.warn(`[palitra] unknown command:`, name);
        }
    }
  }

  function emit(
    name: string,
    props: Record<string, unknown> | undefined,
    current: State,
  ): Promise<void> {
    ensureSession(document.referrer);
    const linked = collectLinkedIds(current.config);
    const referrer = document.referrer || undefined;
    const event: PixelEvent = {
      event: name,
      url: location.href,
      ...(referrer !== undefined ? { referrer } : {}),
      ...getSourceFields(),
      ...(linked.length > 0 ? { linked_ids: linked } : {}),
      ...(props ? { properties: props } : {}),
    };
    return current.transport.send(event);
  }

  return handle;
}
