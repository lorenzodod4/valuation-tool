import type {
  CompanyProfile,
  DCFAssumptions,
  DCFResult,
  FullValuation,
  HistoricalFinancials,
  MultiplesResult,
  ReverseDCFResult,
  SensitivityTable,
} from "@/types/valuation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 45_000;
/** Client-side reuse window for identical GETs (re-mounts, back/forward, StrictMode). */
const CLIENT_CACHE_TTL_MS = 5 * 60_000;
const CLIENT_CACHE_MAX = 60;

export type ApiErrorKind =
  | "not_found"
  | "unsupported"
  | "invalid"
  | "rate_limited"
  | "quota"
  | "unavailable"
  | "timeout"
  | "network"
  | "server";

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, status: number, kind: ApiErrorKind, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** Whether trying again soon could plausibly succeed. */
  get retryable(): boolean {
    return ["rate_limited", "unavailable", "timeout", "network", "server"].includes(this.kind);
  }
}

function kindForStatus(status: number, detail: string): ApiErrorKind {
  if (status === 404) return "not_found";
  if (status === 422 && /not supported|free data tier|premium/i.test(detail)) return "unsupported";
  if (status === 400 || status === 422) return "invalid";
  if (status === 429) return "rate_limited";
  if (status === 503 && /quota/i.test(detail)) return "quota";
  if (status === 502 || status === 503 || status === 504) return "unavailable";
  return "server";
}

async function toApiError(response: Response): Promise<ApiError> {
  let detail = `Request failed (${response.status})`;
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") detail = body.detail;
    else if (Array.isArray(body?.detail)) detail = "The request was rejected by input validation.";
  } catch {
    // Non-JSON body: keep the generic message.
  }
  const retryAfter = Number(response.headers.get("Retry-After"));
  return new ApiError(
    detail,
    response.status,
    kindForStatus(response.status, detail),
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  );
}

async function rawRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      // Only bodies get a Content-Type: a plain GET stays a "simple" CORS
      // request and skips the preflight round-trip.
      headers: init?.body ? { "Content-Type": "application/json", ...(init?.headers ?? {}) } : init?.headers,
      signal: controller.signal,
    });
    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(
        "The analysis took too long. The server may be waking up — try again in a moment.",
        0,
        "timeout",
      );
    }
    throw new ApiError("Could not reach the valuation server. Check your connection.", 0, "network");
  } finally {
    clearTimeout(timeoutId);
  }
}

const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

/**
 * GET with in-flight de-duplication and a short reuse window. A caller's
 * AbortSignal only detaches that caller — it never cancels the shared request,
 * so a React re-mount reuses the fetch instead of firing a second one.
 */
function cachedGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const now = Date.now();
  let entry = cache.get(path);
  if (!entry || now - entry.at > CLIENT_CACHE_TTL_MS) {
    const promise = rawRequest<T>(path).catch((err) => {
      cache.delete(path); // never cache failures
      throw err;
    });
    entry = { at: now, promise };
    cache.set(path, entry);
    if (cache.size > CLIENT_CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }
  const shared = entry.promise as Promise<T>;
  if (!signal) return shared;
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    shared.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

/** Drop cached responses for a ticker (used by explicit "Retry"). */
export function invalidateTicker(ticker: string): void {
  const prefix = `/api/valuation/${encode(ticker)}/`;
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function encode(ticker: string): string {
  return encodeURIComponent(ticker.toUpperCase());
}

interface RequestOptions {
  signal?: AbortSignal;
}

export function getProfile(ticker: string, opts?: RequestOptions): Promise<CompanyProfile> {
  return cachedGet(`/api/valuation/${encode(ticker)}/profile`, opts?.signal);
}

export function getDCF(ticker: string, assumptions?: DCFAssumptions, opts?: RequestOptions): Promise<DCFResult> {
  if (!assumptions || Object.keys(assumptions).length === 0) {
    return cachedGet(`/api/valuation/${encode(ticker)}/dcf`, opts?.signal);
  }
  return rawRequest<DCFResult>(`/api/valuation/${encode(ticker)}/dcf`, {
    method: "POST",
    body: JSON.stringify(assumptions),
  });
}

export function getMultiples(ticker: string, peers?: string[], opts?: RequestOptions): Promise<MultiplesResult> {
  const query = peers && peers.length > 0 ? `?peers=${encodeURIComponent(peers.join(","))}` : "";
  return cachedGet(`/api/valuation/${encode(ticker)}/multiples${query}`, opts?.signal);
}

export function getFullValuation(ticker: string, opts?: RequestOptions): Promise<FullValuation> {
  return cachedGet(`/api/valuation/${encode(ticker)}/full`, opts?.signal);
}

export function fetchHistoricalFinancials(ticker: string, opts?: RequestOptions): Promise<HistoricalFinancials> {
  return cachedGet(`/api/valuation/${encode(ticker)}/historical-financials`, opts?.signal);
}

export function fetchSensitivity(ticker: string, opts?: RequestOptions): Promise<SensitivityTable> {
  return cachedGet(`/api/valuation/${encode(ticker)}/sensitivity`, opts?.signal);
}

export function fetchReverseDCF(
  ticker: string,
  targetPrice?: number,
  opts?: RequestOptions,
): Promise<ReverseDCFResult> {
  const query = targetPrice != null ? `?target_price=${encodeURIComponent(targetPrice.toFixed(2))}` : "";
  return cachedGet(`/api/valuation/${encode(ticker)}/reverse-dcf${query}`, opts?.signal);
}
