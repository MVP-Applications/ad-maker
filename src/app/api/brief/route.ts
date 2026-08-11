import { NextResponse } from "next/server";
import { briefHref } from "@/lib/ad-run";
import { adRunFailureResponse, failJson, NO_STORE } from "@/lib/api-failure";
import { researchAdRunBrief } from "@/lib/generate/planner";
import { normalizeDomain } from "@/lib/net";

// brand-extractor reads the catalogue, the theme's stylesheets, and the chosen
// products' own pages before answering — 15-60s on the stores measured.
export const maxDuration = 180;

/**
 * GET /api/brief?domain=stripe.com&v=4
 *
 * One call to brand-extractor for brand data, palette, typography, and the
 * product catalogue. No concept is planned here: planning follows the choices
 * made against this Brief, and lives behind POST /api/concepts. GET +
 * Cache-Control lets identical versioned Briefs reuse the CDN instead of
 * re-running the extract.
 */
const CACHE_OK = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (
    [...new Set(url.searchParams.keys())].some(
      (key) => key !== "domain" && key !== "v",
    ) ||
    url.searchParams.getAll("domain").length !== 1 ||
    url.searchParams.getAll("v").length > 1
  ) {
    return failJson("Invalid brief request.", 400);
  }

  const domain = normalizeDomain(url.searchParams.get("domain") ?? "");
  if (!domain) return adRunFailureResponse({ code: "invalid-domain" }, "brief");

  const canonicalHref = briefHref(domain);
  if (`${url.pathname}${url.search}` !== canonicalHref) {
    return NextResponse.redirect(new URL(canonicalHref, url), {
      status: 308,
      headers: NO_STORE,
    });
  }

  const result = await researchAdRunBrief(domain, req.signal);
  if (!result.ok) return adRunFailureResponse(result.error, "brief");

  return NextResponse.json(
    result.value,
    { headers: { "Cache-Control": CACHE_OK, "CDN-Cache-Control": CACHE_OK } },
  );
}
