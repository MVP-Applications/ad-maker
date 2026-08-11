import { NextResponse } from "next/server";
import { decodeAdRunBrief } from "@/lib/ad-run";
import { adRunFailureResponse, failJson, NO_STORE } from "@/lib/api-failure";
import { planAdRunConcepts } from "@/lib/generate/planner";

// One LLM call against a Brief that has already been extracted.
export const maxDuration = 60;

/**
 * POST /api/concepts
 *
 * Body: the Brief served by GET /api/brief. It travels back rather than being
 * re-derived because a second extract would cost another 15-60s for an answer
 * we already have; every field is re-validated here, exactly as the Rendered Ad
 * query is, so nothing is trusted for having made the round trip.
 *
 * Not cached: the same Brief is meant to yield a different Ad Run each time it
 * is planned.
 */
export async function POST(req: Request) {
  let input;
  try {
    input = decodeAdRunBrief(await req.json());
  } catch {
    return failJson("Invalid brief.", 400);
  }

  const result = await planAdRunConcepts(input, req.signal);
  if (!result.ok) return adRunFailureResponse(result.error, "concepts");

  return NextResponse.json(result.value, { headers: NO_STORE });
}
