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
const REQUEST_TIMEOUT_MS = 30_000;

interface RequestOptions {
  signal?: AbortSignal;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Compose timeout signal with any caller-provided signal
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException("Aborted", "AbortError");
    }
    callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const body = await response.json();
        if (body?.detail) {
          message =
            typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
        }
      } catch {
        // body wasn't JSON; keep the generic message
      }
      throw new Error(message);
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      if (callerSignal?.aborted) {
        throw err; // caller aborted — rethrow as-is
      }
      throw new Error("Request timed out. The backend may be starting up or experiencing high load.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function encode(ticker: string): string {
  return encodeURIComponent(ticker.toUpperCase());
}

export function getProfile(ticker: string, opts?: RequestOptions): Promise<CompanyProfile> {
  return request<CompanyProfile>(`/api/valuation/${encode(ticker)}/profile`, { signal: opts?.signal });
}

export function getDCF(
  ticker: string,
  assumptions?: DCFAssumptions,
  opts?: RequestOptions,
): Promise<DCFResult> {
  if (!assumptions || Object.keys(assumptions).length === 0) {
    return request<DCFResult>(`/api/valuation/${encode(ticker)}/dcf`, { signal: opts?.signal });
  }
  return request<DCFResult>(`/api/valuation/${encode(ticker)}/dcf`, {
    method: "POST",
    body: JSON.stringify(assumptions),
    signal: opts?.signal,
  });
}

export function getMultiples(
  ticker: string,
  peers?: string[],
  opts?: RequestOptions,
): Promise<MultiplesResult> {
  const query =
    peers && peers.length > 0
      ? `?peers=${encodeURIComponent(peers.join(","))}`
      : "";
  return request<MultiplesResult>(
    `/api/valuation/${encode(ticker)}/multiples${query}`,
    { signal: opts?.signal },
  );
}

export function getFullValuation(ticker: string, opts?: RequestOptions): Promise<FullValuation> {
  return request<FullValuation>(`/api/valuation/${encode(ticker)}/full`, { signal: opts?.signal });
}

export function fetchHistoricalFinancials(
  ticker: string,
  opts?: RequestOptions,
): Promise<HistoricalFinancials> {
  return request<HistoricalFinancials>(
    `/api/valuation/${encode(ticker)}/historical-financials`,
    { signal: opts?.signal },
  );
}

export function fetchSensitivity(
  ticker: string,
  opts?: RequestOptions,
): Promise<SensitivityTable> {
  return request<SensitivityTable>(
    `/api/valuation/${encode(ticker)}/sensitivity`,
    { signal: opts?.signal },
  );
}

export function fetchReverseDCF(
  ticker: string,
  targetPrice?: number,
  opts?: RequestOptions,
): Promise<ReverseDCFResult> {
  const query = targetPrice != null ? `?target_price=${targetPrice}` : "";
  return request<ReverseDCFResult>(
    `/api/valuation/${encode(ticker)}/reverse-dcf${query}`,
    { signal: opts?.signal },
  );
}