import type { TopFactor } from "@/lib/db/schema";

export type ScoreResult = {
  probability: number;
  modelVersion: string;
  topFactors: TopFactor[];
};

/** Cap on how long ingest will wait for the model before falling back to a human. */
const TIMEOUT_MS = 3_000;

function scorerBaseUrl(): string {
  if (process.env.PY_SCORER_URL) return process.env.PY_SCORER_URL;
  // On Vercel the Python function is part of the same deployment, reachable
  // through the app's own origin (next.config rewrites /api/py/* to it).
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:8000";
}

/**
 * Calls the Python scoring function. Throws on any failure — the caller decides
 * what an unscored transaction means, and it deliberately does not mean "fine".
 */
export async function scoreTransaction(features: number[]): Promise<ScoreResult> {
  const response = await fetch(`${scorerBaseUrl()}/api/py/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ features }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`scorer returned ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as ScoreResult;
}
