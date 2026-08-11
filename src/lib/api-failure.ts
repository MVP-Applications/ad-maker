import { NextResponse } from "next/server";
import type { AdRunPlanningFailure } from "@/lib/generate/planner";

/**
 * One planning failure, one HTTP answer. Shared by the Brief and Concepts
 * routes so the same cause never reads differently depending on which step of
 * the run happened to hit it.
 */
export const NO_STORE = {
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
};

export const failJson = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: NO_STORE });

export function adRunFailureResponse(
  failure: AdRunPlanningFailure,
  scope: string,
): NextResponse {
  switch (failure.code) {
    case "invalid-domain":
      return failJson("Please enter a valid domain, e.g. stripe.com", 400);
    case "not-configured":
      return failJson(
        "Ad generation is temporarily unavailable. Please try again later.",
        503,
      );
    case "aborted":
      return failJson("The request was cancelled.", 499);
    case "domain-unreachable":
      return failJson(
        "We couldn't find or reach this domain. Double-check the URL and try again.",
        502,
      );
    case "brand-unavailable":
      return failJson("Couldn't load brand data for that domain. Try another one.", 502);
    case "products-unavailable":
      // The extractor reads published catalogue data, so a site without one
      // lands here — most often a business that does not sell online.
      return failJson(
        "Couldn't find products to advertise on that site. Try another one.",
        502,
      );
    case "internal":
      console.error(`[${scope}] Ad Run planning failed:`, failure.cause);
      return failJson("We couldn't prepare this ad run. Please try again.", 500);
  }
}
