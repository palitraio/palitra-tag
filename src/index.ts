import { createDispatcher } from "./core.ts";

interface PalitraGlobal {
  (...args: unknown[]): void;
  q?: unknown[][];
}

(function bootstrap(): void {
  const w = window as unknown as Record<string, unknown>;
  const name =
    typeof w["PalitraObject"] === "string"
      ? (w["PalitraObject"] as string)
      : "palitra";
  const stub = w[name] as PalitraGlobal | undefined;
  const queue: unknown[][] = stub && Array.isArray(stub.q) ? stub.q : [];

  const dispatch = createDispatcher();
  const callable: PalitraGlobal = (...args: unknown[]) => dispatch(args);
  callable.q = [];
  w[name] = callable;

  for (const call of queue) {
    dispatch(call);
  }
})();
