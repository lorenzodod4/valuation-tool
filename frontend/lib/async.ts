/** Explicit state for every asynchronous section — never "did it work?". */
export type Async<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  /** Not applicable for this company (e.g. sensitivity for a bank). */
  | { status: "na"; reason: string }
  | { status: "error"; error: Error };
