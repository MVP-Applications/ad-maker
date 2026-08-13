import { NextResponse } from "next/server";
import { decodeAdRunBrief } from "@/lib/ad-run";
import { adRunFailureResponse, failJson, NO_STORE } from "@/lib/api-failure";
import { planAdRunConcepts } from "@/lib/generate/planner";

// One LLM call against a Brief that has already been extracted.
export const maxDuration = 60;

/** A JSON body has to be an object before anything can be pulled out of it. */
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("body must be an object");
  }
  return value as Record<string, unknown>;
}

/**
 * POST /api/concepts
 *
 * Body: the Brief served by GET /api/brief, plus an optional `instruction` —
 * what the buyer typed. The Brief travels back rather than being re-derived
 * because a second extract would cost another 15-60s for an answer we already
 * have; every field is re-validated here, exactly as the Rendered Ad query is,
 * so nothing is trusted for having made the round trip.
 *
 *   { brief, products, instruction?: string }
 *
 * `instruction` is bounded and optional. Omitting it plans exactly the run this
 * route planned before it existed.
 *
 * Not cached: the same Brief is meant to yield a different Ad Run each time it
 * is planned.
 */
export async function POST(req: Request) {
  let input;
  try {
    const body = record(await req.json());
    // The Brief keeps its own strict shape; the request rides alongside it, so
    // an unknown field is still rejected rather than quietly ignored.
    const { instruction, ...brief } = body;
    input = { ...decodeAdRunBrief(brief), instruction };
  } catch {
    return failJson("Invalid brief.", 400);
  }

  const result = await planAdRunConcepts(input, req.signal);
  if (!result.ok) return adRunFailureResponse(result.error, "concepts");

  return NextResponse.json(result.value, { headers: NO_STORE });
}
