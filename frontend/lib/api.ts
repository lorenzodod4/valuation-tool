import type {
  CompanyProfile,
  DCFAssumptions,
  DCFResult,
  FullValuation,
  MultiplesResult,
} from "@/types/valuation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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
}

function encode(ticker: string): string {
  return encodeURIComponent(ticker.toUpperCase());
}

export function getProfile(ticker: string): Promise<CompanyProfile> {
  return request<CompanyProfile>(`/api/valuation/${encode(ticker)}/profile`);
}

export function getDCF(
  ticker: string,
  assumptions?: DCFAssumptions,
): Promise<DCFResult> {
  if (!assumptions || Object.keys(assumptions).length === 0) {
    return request<DCFResult>(`/api/valuation/${encode(ticker)}/dcf`);
  }
  return request<DCFResult>(`/api/valuation/${encode(ticker)}/dcf`, {
    method: "POST",
    body: JSON.stringify(assumptions),
  });
}

export function getMultiples(
  ticker: string,
  peers?: string[],
): Promise<MultiplesResult> {
  const query =
    peers && peers.length > 0
      ? `?peers=${encodeURIComponent(peers.join(","))}`
      : "";
  return request<MultiplesResult>(
    `/api/valuation/${encode(ticker)}/multiples${query}`,
  );
}

export function getFullValuation(ticker: string): Promise<FullValuation> {
  return request<FullValuation>(`/api/valuation/${encode(ticker)}/full`);
}
