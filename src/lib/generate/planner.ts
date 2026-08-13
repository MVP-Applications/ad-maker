import {
  AD_PRODUCT_CONCEPT_MAX,
  AD_RUN_LIMITS,
  decodeAdRunBrief,
  decodeAdRunPlan,
  type AdBrief,
  type AdRunBrief,
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

export type AdRunBriefResult =
  | { ok: true; value: AdRunBrief }
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
    instruction: string,
    signal?: AbortSignal,
  ): Promise<readonly PlannedConcept[]>;
};

export type AdRunPlannerAdapters = {
  research: BrandResearchAdapter;
  concepts: ConceptPlanningAdapter;
};

export type AdRunBriefResearcher = (
  rawDomain: string,
  signal?: AbortSignal,
) => Promise<AdRunBriefResult>;

/**
 * A Brief plus what the buyer asked of it. The Brief describes a shop and is
 * cacheable; the request is one person's, for one run, and never is.
 */
export type AdRunConceptRequest = AdRunBrief & { instruction?: unknown };

export type AdRunConceptPlanner = (
  input: AdRunConceptRequest,
  signal?: AbortSignal,
) => Promise<AdRunPlanningResult>;

const bounded = (value: string | null | undefined, max: number): string =>
  (value ?? "").trim().slice(0, max);

/**
 * The request is the one field a person types, so it is the one field that is
 * neither extracted nor validated by the Brief contract. Bounded here, before
 * it reaches a model or a URL.
 */
const boundedInstruction = (value: unknown): string =>
  typeof value === "string" ? bounded(value, AD_RUN_LIMITS.instruction) : "";

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
  languages: readonly string[],
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
    headline: bounded(brand.slogan, AD_RUN_LIMITS.brandHeadline),
    industry: bounded(brand.industry, AD_RUN_LIMITS.industry),
    summary: deriveSummaryFromMarkdown(summary),
    mood: bounded(styleguide.mood, AD_RUN_LIMITS.mood) || DEFAULT_MOOD,
    fontFamily: normalizeFontFamily(styleguide.fontFamily),
    colorA: bounded(colorA, AD_RUN_LIMITS.promptColor),
    colorB: bounded(colorB, AD_RUN_LIMITS.promptColor),
    logoUrl: boundedLogoUrl(brand.logoUrl),
    heroImageUrl: boundedLogoUrl(brand.heroImageUrl),
    languages: languages
      .flatMap((language) => {
        const tag = bounded(language, AD_RUN_LIMITS.language);
        return tag ? [tag] : [];
      })
      .slice(0, AD_RUN_LIMITS.languages),
    colors,
  };
}

/**
 * Domain -> Brief plus the catalog to choose from. No concept is planned here:
 * planning follows a choice, and the choice needs this answer first.
 *
 * Generation readiness is still checked alongside research, because a Brief
 * nobody can turn into ads is not worth the extract that produced it.
 */
export function createBriefResearcher(
  adapters: AdRunPlannerAdapters,
): AdRunBriefResearcher {
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
        research.languages,
        research.styleguide,
      );

      return {
        ok: true,
        value: decodeAdRunBrief({ brief, products: research.products }),
      };
    } catch (cause) {
      if (signal?.aborted) return { ok: false, error: { code: "aborted" } };
      return { ok: false, error: { code: "internal", cause } };
    }
  };
}

/**
 * Brief -> three Company concepts plus one to three Product concepts.
 *
 * The catalog runs to hundreds; an Ad Run advertises at most three. Those three
 * are the flagships — the shortlist the extractor judged worth advertising —
 * rather than whichever entries the shop happens to list first. A person's
 * choice replaces that shortlist later.
 */
export function createConceptPlanner(
  adapters: Pick<AdRunPlannerAdapters, "concepts">,
): AdRunConceptPlanner {
  return async (input, signal) => {
    if (signal?.aborted) return { ok: false, error: { code: "aborted" } };

    try {
      if (!adapters.concepts.isReady()) {
        return { ok: false, error: { code: "not-configured" } };
      }

      const { brief, products } = decodeAdRunBrief({
        brief: input.brief,
        products: input.products,
      });
      const instruction = boundedInstruction(input.instruction);
      const advertised = products
        .filter(({ flagship }) => flagship)
        .slice(0, AD_PRODUCT_CONCEPT_MAX);
      const concepts = await adapters.concepts.planConcepts(
        brief,
        advertised,
        instruction,
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

const productionAdapters: AdRunPlannerAdapters = {
  research: {
    isReady: hasContextConfiguration,
    research: researchBrand,
  },
  concepts: {
    isReady: hasGatewayConfiguration,
    planConcepts: (brief, products, instruction, signal) =>
      pickConceptsAndCraftCopy(
        gatewayTextModel("openai/gpt-5.4-mini"),
        brief,
        products,
        instruction,
        signal,
      ),
  },
};

const productionResearcher = createBriefResearcher(productionAdapters);
const productionPlanner = createConceptPlanner(productionAdapters);

/** Production adapter used by the Brief HTTP route. */
export const researchAdRunBrief: AdRunBriefResearcher = (rawDomain, signal) =>
  productionResearcher(rawDomain, signal);

/** Production adapter used by the Concepts HTTP route. */
export const planAdRunConcepts: AdRunConceptPlanner = (input, signal) =>
  productionPlanner(input, signal);
