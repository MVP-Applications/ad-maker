import {
  AD_RUN_LIMITS,
  decodeAdRunPlan,
  type AdBrief,
  type AdRunPlan,
  type PlannedConcept,
  type Product,
} from "@/lib/ad-run";
import {
  normalizeBrandColorHex,
  type BrandColor,
} from "@/lib/brand-color";
import {
  BrandExtractorError,
  hasContextConfiguration,
  researchBrand,
  type BrandProfile,
  type BrandResearch,
  type StyleguideProfile,
} from "@/lib/context";
import { normalizeFontFamily } from "@/lib/font-family";
import { normalizeDomain } from "@/lib/net";
import { parsePublicHttpUrl } from "@/lib/public-url";
import { deriveSummaryFromMarkdown, pickConceptsAndCraftCopy } from "./brief";
import { pickBrandColors } from "./colors";
import { gatewayTextModel, hasGatewayConfiguration } from "./gateway";

const DEFAULT_MOOD = "modern, confident, premium";

export type AdRunPlanningFailure =
  | { code: "invalid-domain" }
  | { code: "not-configured" }
  | { code: "aborted" }
  | { code: "domain-unreachable"; cause: unknown }
  | { code: "brand-unavailable"; cause: unknown }
  | { code: "products-unavailable"; cause: unknown }
  | { code: "internal"; cause: unknown };

export type AdRunPlanningResult =
  | { ok: true; value: AdRunPlan }
  | { ok: false; error: AdRunPlanningFailure };

/**
 * Behavior-level adapters used by the Ad Run planning module. The research
 * service and environment-variable names stay behind this seam.
 */
export type BrandResearchAdapter = {
  isReady(): boolean;
  research(domain: string, signal?: AbortSignal): Promise<BrandResearch>;
};

export type ConceptPlanningAdapter = {
  isReady(): boolean;
  planConcepts(
    brief: AdBrief,
    products: readonly Product[],
    signal?: AbortSignal,
  ): Promise<readonly PlannedConcept[]>;
};

export type AdRunPlannerAdapters = {
  research: BrandResearchAdapter;
  concepts: ConceptPlanningAdapter;
};

export type AdRunPlanner = (
  rawDomain: string,
  signal?: AbortSignal,
) => Promise<AdRunPlanningResult>;

const bounded = (value: string | null | undefined, max: number): string =>
  (value ?? "").trim().slice(0, max);

/**
 * One research call now carries what four used to, so its failure has to say
 * which of them it stood in for — the Brief route turns each of these into a
 * different message, and "site we cannot read" is not "service that is down".
 */
function researchFailure(cause: unknown): AdRunPlanningFailure {
  if (cause instanceof BrandExtractorError) {
    switch (cause.kind) {
      case "unreachable":
        return { code: "not-configured" };
      case "no-extract":
        return { code: "domain-unreachable", cause };
      case "no-products":
        return { code: "products-unavailable", cause };
      case "malformed":
        return { code: "brand-unavailable", cause };
    }
  }
  return { code: "internal", cause };
}

function boundedColors(colors: readonly BrandColor[]): BrandColor[] {
  return colors
    .flatMap((color) => {
      const hex = normalizeBrandColorHex(color.hex);
      if (!hex) return [];
      const name = bounded(color.name, AD_RUN_LIMITS.colorName);
      return [{ hex, name: name || null }];
    })
    .slice(0, AD_RUN_LIMITS.palette);
}

function boundedLogoUrl(value: string | null): string | null {
  const candidate = (value ?? "").trim();
  if (!candidate || candidate.length > AD_RUN_LIMITS.logoUrl) return null;
  return parsePublicHttpUrl(candidate)?.href ?? null;
}

function buildBrief(
  domain: string,
  brand: BrandProfile,
  summary: string,
  styleguide: StyleguideProfile,
): AdBrief {
  const colors = boundedColors(styleguide.colors);
  const { a: colorA, b: colorB } = pickBrandColors(colors);
  const brandName = bounded(brand.name, AD_RUN_LIMITS.brandName) || domain;
  const description =
    bounded(brand.description, AD_RUN_LIMITS.description) ||
    bounded(brand.slogan, AD_RUN_LIMITS.description);

  return {
    domain,
    brandName,
    description,
    industry: bounded(brand.industry, AD_RUN_LIMITS.industry),
    summary: deriveSummaryFromMarkdown(summary),
    mood: bounded(styleguide.mood, AD_RUN_LIMITS.mood) || DEFAULT_MOOD,
    fontFamily: normalizeFontFamily(styleguide.fontFamily),
    colorA: bounded(colorA, AD_RUN_LIMITS.promptColor),
    colorB: bounded(colorB, AD_RUN_LIMITS.promptColor),
    logoUrl: boundedLogoUrl(brand.logoUrl),
    colors,
  };
}

/**
 * Domain -> Brief -> three Company concepts plus one to three Product concepts.
 * The returned function is the whole test surface; partial-failure policy and
 * contract validation stay local.
 */
export function createAdRunPlanner(adapters: AdRunPlannerAdapters): AdRunPlanner {
  return async (rawDomain, signal) => {
    const domain = normalizeDomain(rawDomain);
    if (!domain) return { ok: false, error: { code: "invalid-domain" } };
    if (signal?.aborted) return { ok: false, error: { code: "aborted" } };

    try {
      // Evaluate both checks before starting work: a planned Ad Run is useless
      // unless both enrichment and generation are configured.
      const contextReady = adapters.research.isReady();
      const generationReady = adapters.concepts.isReady();
      if (!contextReady || !generationReady) {
        return { ok: false, error: { code: "not-configured" } };
      }

      let research: BrandResearch;
      try {
        research = await adapters.research.research(domain, signal);
      } catch (cause) {
        if (signal?.aborted) return { ok: false, error: { code: "aborted" } };
        return { ok: false, error: researchFailure(cause) };
      }

      if (signal?.aborted) return { ok: false, error: { code: "aborted" } };

      const brief = buildBrief(
        domain,
        research.brand,
        research.summary,
        research.styleguide,
      );
      const concepts = await adapters.concepts.planConcepts(
        brief,
        research.products,
        signal,
      );
      if (signal?.aborted) return { ok: false, error: { code: "aborted" } };

      return {
        ok: true,
        value: decodeAdRunPlan({ brief, concepts }),
      };
    } catch (cause) {
      if (signal?.aborted) return { ok: false, error: { code: "aborted" } };
      return { ok: false, error: { code: "internal", cause } };
    }
  };
}

const productionPlanner = createAdRunPlanner({
  research: {
    isReady: hasContextConfiguration,
    research: researchBrand,
  },
  concepts: {
    isReady: hasGatewayConfiguration,
    planConcepts: (brief, products, signal) =>
      pickConceptsAndCraftCopy(
        gatewayTextModel("openai/gpt-5.4-mini"),
        brief,
        products,
        signal,
      ),
  },
});

/** Production adapter used by the Brief HTTP route. */
export const planAdRun: AdRunPlanner = (rawDomain, signal) =>
  productionPlanner(rawDomain, signal);
