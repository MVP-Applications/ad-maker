import {
  normalizeBrandColorHex,
  type BrandColor,
} from "@/lib/brand-color";
import {
  AD_CATALOG_MAX,
  AD_COMPANY_CONCEPT_COUNT,
  AD_PRIMARY_MODEL_COUNT,
  AD_PRODUCT_CONCEPT_MAX,
  AD_PRODUCT_CONCEPT_MIN,
  AD_RUN_LIMITS,
  AD_RUN_MAX_SIZE,
  AD_RUN_MIN_SIZE,
} from "@/lib/ad-run-policy";
import {
  CREATIVE_DIRECTION_KEYS,
  type CreativeDirectionKey,
} from "@/lib/generate/directions";
import {
  IMAGE_MODEL_IDS,
  imageModelById,
  type ImageModelId,
} from "@/lib/generate/models";
import { normalizeFontFamily } from "@/lib/font-family";
import { normalizeDomain } from "@/lib/net";
import { parsePublicHttpUrl } from "@/lib/public-url";

export {
  AD_CATALOG_MAX,
  AD_COMPANY_CONCEPT_COUNT,
  AD_PRIMARY_MODEL_COUNT,
  AD_PRODUCT_CONCEPT_MAX,
  AD_PRODUCT_CONCEPT_MIN,
  AD_RUN_LIMITS,
  AD_RUN_MAX_SIZE,
  AD_RUN_MIN_SIZE,
} from "@/lib/ad-run-policy";

export type { BrandColor } from "@/lib/brand-color";

/**
 * What the brand sells and who it sells to, as the extractor reads it.
 *
 * Inferred rather than scraped — every other field on the Brief is something
 * the site states about itself, and this one is a model's answer about it. It
 * carries its own `confidence` and `source` for that reason.
 *
 * It never reaches an image prompt or a canonical URL. The audience does reach
 * the art director, which is a reasoning step deciding who one picture talks to
 * — and what reaches the image from there is the director's own sentence about
 * this ad, not the read itself.
 */
export type MarketRead = {
  /** The broad category, e.g. "computer accessories". */
  sector: string;
  /** The narrower one within it, e.g. "mechanical keyboards". */
  niche: string;
  /** Who buys, written as a sentence. */
  audience: string;
  /** The same read said as tags, for the places a sentence will not fit. */
  audienceTraits: string[];
  /** The products the read was inferred from, in the extractor's words. */
  evidence: string;
  /** 0..1, as the extractor scores its own answer. Null when it did not. */
  confidence: number | null;
  /** Which of the extractor's steps answered, e.g. "ai-identity". */
  source: string;
};

export type AdBrief = {
  domain: string;
  brandName: string;
  description: string;
  /** The brand's own headline, in its words: a sentence, not ad copy. */
  headline: string;
  industry: string;
  summary: string;
  mood: string;
  fontFamily: string | null;
  colorA: string;
  colorB: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  /** BCP-47-ish tags the site publishes itself in, first one first. */
  languages: string[];
  colors: BrandColor[];
  /** Null when the extractor read no market at all, which is allowed. */
  market: MarketRead | null;
};

/**
 * What an advertisement carries about a Product: what it shows, and what it may
 * say. Deliberately narrower than a catalog entry — a price or a shop URL has
 * no business travelling in the canonical URL of a rendered image.
 */
export type AdvertisedProduct = {
  name: string;
  description: string;
  /**
   * The product's own photograph, when its site publishes one. Handed to the
   * Image Models that accept a reference so a Product ad shows the real thing
   * instead of a plausible invention; null everywhere else, and never required.
   */
  imageUrl: string | null;
};

/** One catalog entry: everything the shop states, for choosing between them. */
export type Product = AdvertisedProduct & {
  price: number | null;
  currency: string | null;
  /** The product's own page on the shop. */
  url: string | null;
  /**
   * Whether the extractor judged this one worth advertising. An Ad Run's
   * Products are drawn from these; the rest of the catalog exists to be picked
   * from instead.
   */
  flagship: boolean;
};

export type ConceptSubject =
  | { kind: "company" }
  | ({ kind: "product" } & AdvertisedProduct);

export type PlannedConcept = {
  key: CreativeDirectionKey;
  model: ImageModelId;
  subject: ConceptSubject;
  headline: string;
  subheadline: string;
  /**
   * The picture this ad shows, written by the planner for this ad alone.
   *
   * A Creative Direction used to be a fixed paragraph; it is now a set of rules
   * the planner writes to, so two runs of the same Direction describe different
   * pictures. Empty when the planning call failed, and the Direction's original
   * paragraph stands in — which is also every Ad Run made before this existed.
   */
  scene: string;
  /**
   * What the person asked this run for, in their words, carried per Concept.
   *
   * Per Concept rather than per Ad Run because a Rendered Ad is generated from
   * its URL alone — nothing else survives the trip to the renderer. Empty when
   * nothing was asked, which is every run that predates the request box.
   */
  instruction: string;
  /**
   * Whether this Concept is meant to show a person.
   *
   * Decided by the planner, which reads the instruction, rather than by
   * matching words here: the request arrives in the shop's own language, and a
   * list of English words for "man" would silently fail every Arabic brand.
   */
  showsPeople: boolean;
};

/**
 * What one domain yields before anyone has chosen anything: the brand, and the
 * whole catalog worth advertising. An Ad Run draws its Products from here, so
 * this is also the list a person picks from.
 */
export type AdRunBrief = {
  brief: AdBrief;
  products: readonly Product[];
};

export type AdRunPlan = {
  brief: AdBrief;
  concepts: readonly PlannedConcept[];
};

export type RenderedAdQuery = {
  domain: string;
  concept: CreativeDirectionKey;
  model: ImageModelId;
  subject: ConceptSubject;
  headline: string;
  subheadline: string;
  scene: string;
  instruction: string;
  showsPeople: boolean;
  brandName: string;
  colorA: string;
  colorB: string;
  summary: string;
  industry: string;
  mood: string;
  fontFamily: string | null;
  logoUrl: string | null;
  canonicalHref: string;
};

type RecordValue = Record<string, unknown>;

const DIRECTIONS = new Set<string>(CREATIVE_DIRECTION_KEYS);
const MODELS = new Set<string>(IMAGE_MODEL_IDS);
// 6 adds the market read. Briefs cached at 5 decode without it — decodeMarket
// tolerates the absence — but they were extracted before the extractor
// reported one, so the version is bumped to fetch it rather than serve an
// hour of Briefs whose Market card is empty for no reason the person can see.
const BRIEF_FORMAT_VERSION = "6";

function invalid(message: string): never {
  throw new Error(`Invalid Ad Run contract: ${message}`);
}

function record(value: unknown, name: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(`${name} must be an object`);
  }
  return value as RecordValue;
}

function onlyKeys(value: RecordValue, allowed: readonly string[], name: string): void {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unknown) invalid(`${name} contains unknown field ${unknown}`);
}

function text(
  value: unknown,
  name: string,
  options: { min?: number; max: number; trim?: boolean },
): string {
  if (typeof value !== "string") invalid(`${name} must be a string`);
  const parsed = options.trim ? value.trim() : value;
  if (parsed.length < (options.min ?? 0) || parsed.length > options.max) {
    invalid(`${name} has an invalid length`);
  }
  return parsed;
}

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function canonicalDomain(value: unknown): string {
  const domain = text(value, "domain", { min: 1, max: AD_RUN_LIMITS.domain });
  if (normalizeDomain(domain) !== domain) invalid("domain must be canonical");
  return domain;
}

function publicHttpUrl(value: unknown, name: string): string {
  const raw = text(value, name, { min: 1, max: AD_RUN_LIMITS.logoUrl });
  const normalized = parsePublicHttpUrl(raw);
  if (!normalized) invalid(`${name} must be a public HTTP(S) URL`);
  return normalized.href;
}

function promptFontFamily(value: unknown, name: string): string {
  const family = normalizeFontFamily(value);
  if (!family) invalid(`${name} is invalid`);
  return family;
}

/**
 * The market read, or nothing.
 *
 * Absent and null both decode to null on purpose: Briefs cached before this
 * field existed carry neither, and a stale entry in the CDN should degrade to
 * a Brief without a market rather than fail the run it is serving.
 */
function decodeMarket(value: unknown): MarketRead | null {
  if (value === null || value === undefined) return null;
  const market = record(value, "brief.market");
  onlyKeys(
    market,
    ["sector", "niche", "audience", "audienceTraits", "evidence", "confidence", "source"],
    "brief.market",
  );

  if (
    !Array.isArray(market.audienceTraits) ||
    market.audienceTraits.length > AD_RUN_LIMITS.audienceTraits
  ) {
    invalid(
      `brief.market.audienceTraits must contain at most ${AD_RUN_LIMITS.audienceTraits} traits`,
    );
  }

  // A score outside 0..1 is not a low confidence, it is a field that does not
  // mean what it is being read as — so it is dropped rather than clamped.
  const confidence = market.confidence;
  if (
    confidence !== null &&
    (typeof confidence !== "number" ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1)
  ) {
    invalid("brief.market.confidence must be null or a number between 0 and 1");
  }

  return {
    sector: text(market.sector, "brief.market.sector", { max: AD_RUN_LIMITS.sector }),
    niche: text(market.niche, "brief.market.niche", { max: AD_RUN_LIMITS.niche }),
    audience: text(market.audience, "brief.market.audience", {
      max: AD_RUN_LIMITS.audience,
    }),
    audienceTraits: market.audienceTraits.map((trait, index) =>
      text(trait, `brief.market.audienceTraits[${index}]`, {
        max: AD_RUN_LIMITS.audienceTrait,
      }),
    ),
    evidence: text(market.evidence, "brief.market.evidence", {
      max: AD_RUN_LIMITS.marketEvidence,
    }),
    confidence,
    source: text(market.source, "brief.market.source", {
      max: AD_RUN_LIMITS.marketSource,
    }),
  };
}

function decodeColor(value: unknown, index: number): BrandColor {
  const color = record(value, `colors[${index}]`);
  onlyKeys(color, ["hex", "name"], `colors[${index}]`);
  const hex = text(color.hex, `colors[${index}].hex`, { min: 1, max: 7 });
  if (normalizeBrandColorHex(hex) !== hex) invalid(`colors[${index}].hex is invalid`);

  const name =
    color.name === null
      ? null
      : text(color.name, `colors[${index}].name`, { max: AD_RUN_LIMITS.colorName });
  return { hex, name };
}

function decodeBrief(value: unknown): AdBrief {
  const brief = record(value, "brief");
  onlyKeys(
    brief,
    [
      "domain",
      "brandName",
      "description",
      "headline",
      "industry",
      "summary",
      "mood",
      "fontFamily",
      "colorA",
      "colorB",
      "logoUrl",
      "heroImageUrl",
      "languages",
      "colors",
      "market",
    ],
    "brief",
  );

  if (!Array.isArray(brief.colors) || brief.colors.length > AD_RUN_LIMITS.palette) {
    invalid("brief.colors must contain at most eight colors");
  }
  if (
    !Array.isArray(brief.languages) ||
    brief.languages.length > AD_RUN_LIMITS.languages
  ) {
    invalid(
      `brief.languages must contain at most ${AD_RUN_LIMITS.languages} tags`,
    );
  }

  return {
    domain: canonicalDomain(brief.domain),
    brandName: text(brief.brandName, "brief.brandName", {
      min: 1,
      max: AD_RUN_LIMITS.brandName,
      trim: true,
    }),
    description: text(brief.description, "brief.description", {
      max: AD_RUN_LIMITS.description,
    }),
    headline: text(brief.headline, "brief.headline", {
      max: AD_RUN_LIMITS.brandHeadline,
    }),
    industry: text(brief.industry, "brief.industry", { max: AD_RUN_LIMITS.industry }),
    summary: text(brief.summary, "brief.summary", { max: AD_RUN_LIMITS.summary }),
    mood: text(brief.mood, "brief.mood", {
      min: 1,
      max: AD_RUN_LIMITS.mood,
      trim: true,
    }),
    fontFamily:
      brief.fontFamily === null
        ? null
        : promptFontFamily(brief.fontFamily, "brief.fontFamily"),
    colorA: text(brief.colorA, "brief.colorA", {
      min: 1,
      max: AD_RUN_LIMITS.promptColor,
      trim: true,
    }),
    colorB: text(brief.colorB, "brief.colorB", {
      min: 1,
      max: AD_RUN_LIMITS.promptColor,
      trim: true,
    }),
    logoUrl: brief.logoUrl === null ? null : publicHttpUrl(brief.logoUrl, "brief.logoUrl"),
    heroImageUrl:
      brief.heroImageUrl === null
        ? null
        : publicHttpUrl(brief.heroImageUrl, "brief.heroImageUrl"),
    languages: brief.languages.map((language, index) =>
      text(language, `brief.languages[${index}]`, {
        min: 1,
        max: AD_RUN_LIMITS.language,
        trim: true,
      }),
    ),
    colors: brief.colors.map(decodeColor),
    market: decodeMarket(brief.market),
  };
}

function direction(value: unknown): CreativeDirectionKey {
  const key = text(value, "concept.key", {
    min: 1,
    max: AD_RUN_LIMITS.directionKey,
  });
  if (!DIRECTIONS.has(key)) invalid("concept.key is unknown");
  return key as CreativeDirectionKey;
}

function imageModel(value: unknown): ImageModelId {
  const model = text(value, "concept.model", {
    min: 1,
    max: AD_RUN_LIMITS.imageModelId,
  });
  if (!MODELS.has(model)) invalid("concept.model is unknown");
  return model as ImageModelId;
}

/**
 * What both a catalog entry and a Concept subject state about a Product.
 *
 * `minDescription` is the whole difference between the two. An advertisement
 * has to say something about what it is selling, so a Concept subject requires
 * one. A catalog entry does not: a shop lists most of its range with a name, a
 * photograph and a price and nothing else — nuphy.com describes 29 of its 680 —
 * and every one of those is still a Product somebody can point at and choose.
 */
function decodeAdvertisedProduct(
  value: RecordValue,
  name: string,
  minDescription: 0 | 1,
): AdvertisedProduct {
  return {
    name: text(value.name, `${name}.name`, {
      min: 1,
      max: AD_RUN_LIMITS.productName,
      trim: true,
    }),
    description: text(value.description, `${name}.description`, {
      min: minDescription,
      max: AD_RUN_LIMITS.productDescription,
      trim: true,
    }),
    imageUrl:
      value.imageUrl === null || value.imageUrl === undefined
        ? null
        : publicHttpUrl(value.imageUrl, `${name}.imageUrl`),
  };
}

function decodePrice(value: unknown, name: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalid(`${name} must be a finite number`);
  }
  // A negative or absurd price is a parse that went wrong, not a bargain.
  if (value < 0 || value > AD_RUN_LIMITS.price) invalid(`${name} is out of range`);
  return value;
}

function decodeProduct(value: unknown, name: string): Product {
  const product = record(value, name);
  onlyKeys(
    product,
    ["name", "description", "imageUrl", "price", "currency", "url", "flagship"],
    name,
  );
  if (typeof product.flagship !== "boolean") {
    invalid(`${name}.flagship must be a boolean`);
  }

  return {
    ...decodeAdvertisedProduct(product, name, 0),
    price: decodePrice(product.price, `${name}.price`),
    currency:
      product.currency === null || product.currency === undefined
        ? null
        : text(product.currency, `${name}.currency`, {
            min: 1,
            max: AD_RUN_LIMITS.currency,
            trim: true,
          }),
    url:
      product.url === null || product.url === undefined
        ? null
        : publicHttpUrl(product.url, `${name}.url`),
    flagship: product.flagship,
  };
}

/** Strip a catalog entry back to what an advertisement may carry. */
export function advertised(product: AdvertisedProduct): AdvertisedProduct {
  return {
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
  };
}

/** Two Products are the same Product when their names match but for case. */
export const productKey = (name: string) => name.trim().toLocaleLowerCase();

/**
 * Can an advertisement be written about this Product?
 *
 * Only if the shop says what it is. A name and a price are enough to choose a
 * Product; they are not enough to write a truthful ad about one, and inventing
 * the difference is the one thing this pipeline must never do.
 */
export function isAdvertisable(product: Product): boolean {
  return product.description.trim().length > 0;
}

/**
 * Guarantee a catalog has something to advertise.
 *
 * An Ad Run draws its Products from the flagships, so a catalog carrying none
 * plans nothing. That happens twice: when the extractor shortlists nothing, and
 * when a person keeps only Products it did not shortlist. Both fall back to the
 * head of the list, which is the shop's own order.
 *
 * A Product with no description can never hold the mark, whichever way it got
 * there — the Concept it would produce cannot be decoded.
 */
export function withFlagships(products: readonly Product[]): Product[] {
  const marked = products.map((product) =>
    product.flagship && isAdvertisable(product)
      ? product
      : { ...product, flagship: false },
  );
  if (marked.some(({ flagship }) => flagship)) return marked;

  let taken = 0;
  return marked.map((product) => {
    if (taken >= AD_PRODUCT_CONCEPT_MAX || !isAdvertisable(product)) {
      return product;
    }
    taken += 1;
    return { ...product, flagship: true };
  });
}

function decodeSubject(value: unknown, name = "concept.subject"): ConceptSubject {
  const subject = record(value, name);
  const kind = text(subject.kind, `${name}.kind`, { min: 1, max: 16, trim: true });

  if (kind === "company") {
    onlyKeys(subject, ["kind"], name);
    return { kind };
  }
  if (kind !== "product") invalid(`${name}.kind is unknown`);

  onlyKeys(subject, ["kind", "name", "description", "imageUrl"], name);
  return { kind, ...decodeAdvertisedProduct(subject, name, 1) };
}

function decodeConcept(value: unknown): PlannedConcept {
  const concept = record(value, "concept");
  onlyKeys(
    concept,
    [
      "key",
      "model",
      "subject",
      "headline",
      "subheadline",
      "scene",
      "instruction",
      "showsPeople",
    ],
    "concept",
  );
  if (
    concept.showsPeople !== undefined &&
    typeof concept.showsPeople !== "boolean"
  ) {
    invalid("concept.showsPeople must be a boolean");
  }
  const headline = text(concept.headline, "concept.headline", {
    min: 1,
    max: AD_RUN_LIMITS.headline,
    trim: true,
  });
  const subheadline = text(concept.subheadline, "concept.subheadline", {
    max: AD_RUN_LIMITS.subheadline,
    trim: true,
  });
  if (words(headline) > AD_RUN_LIMITS.headlineWords) {
    invalid("concept.headline contains too many words");
  }
  if (words(subheadline) > AD_RUN_LIMITS.subheadlineWords) {
    invalid("concept.subheadline contains too many words");
  }

  return {
    key: direction(concept.key),
    model: imageModel(concept.model),
    subject: decodeSubject(concept.subject),
    headline,
    subheadline,
    // Absent means the planner did not write one, and the Direction's own
    // paragraph stands in at render time.
    scene:
      concept.scene === undefined
        ? ""
        : text(concept.scene, "concept.scene", {
            max: AD_RUN_LIMITS.scene,
            trim: true,
          }),
    // Absent means nothing was asked for, which is the whole history of Ad Runs
    // before the request box existed.
    instruction:
      concept.instruction === undefined
        ? ""
        : text(concept.instruction, "concept.instruction", {
            max: AD_RUN_LIMITS.instruction,
            trim: true,
          }),
    showsPeople: concept.showsPeople === true,
  };
}

/**
 * Decode the Brief served before any choice is made.
 *
 * The catalog is bounded and its Products distinct, but nothing here asserts
 * how many of them an Ad Run will use — that is the choice this Brief exists to
 * offer, and it is checked when the Concepts come back.
 */
export function decodeAdRunBrief(value: unknown): AdRunBrief {
  const payload = record(value, "Brief");
  onlyKeys(payload, ["brief", "products"], "Brief");

  if (
    !Array.isArray(payload.products) ||
    payload.products.length < AD_PRODUCT_CONCEPT_MIN ||
    payload.products.length > AD_CATALOG_MAX
  ) {
    invalid(
      `a Brief must carry between ${AD_PRODUCT_CONCEPT_MIN} and ${AD_CATALOG_MAX} Products`,
    );
  }

  const products = payload.products.map((product, index) =>
    decodeProduct(product, `products[${index}]`),
  );
  const names = products.map(({ name }) => name.toLocaleLowerCase());
  if (new Set(names).size !== names.length) {
    invalid("a Brief must carry distinct Products");
  }

  return { brief: decodeBrief(payload.brief), products };
}

export function decodeAdRunPlan(value: unknown): AdRunPlan {
  const plan = record(value, "Ad Run");
  onlyKeys(plan, ["brief", "concepts"], "Ad Run");
  if (
    !Array.isArray(plan.concepts) ||
    plan.concepts.length < AD_RUN_MIN_SIZE ||
    plan.concepts.length > AD_RUN_MAX_SIZE
  ) {
    invalid(
      `an Ad Run must contain between ${AD_RUN_MIN_SIZE} and ${AD_RUN_MAX_SIZE} Planned Concepts`,
    );
  }

  const concepts = plan.concepts.map(decodeConcept);
  if (new Set(concepts.map(({ key }) => key)).size !== concepts.length) {
    invalid("an Ad Run must contain distinct Creative Directions");
  }
  if (new Set(concepts.map(({ model }) => model)).size !== concepts.length) {
    invalid("an Ad Run must contain distinct Image Models");
  }
  if (
    !concepts
      .slice(0, AD_COMPANY_CONCEPT_COUNT)
      .every(({ subject }) => subject.kind === "company") ||
    !concepts
      .slice(AD_COMPANY_CONCEPT_COUNT)
      .every(({ subject }) => subject.kind === "product")
  ) {
    invalid("an Ad Run must place three Company concepts before its Product concepts");
  }
  const productSubjects = concepts
    .slice(AD_COMPANY_CONCEPT_COUNT)
    .map(({ subject }) => subject)
    .filter((subject): subject is Extract<ConceptSubject, { kind: "product" }> =>
      subject.kind === "product"
    );
  if (
    productSubjects.length < AD_PRODUCT_CONCEPT_MIN ||
    productSubjects.length > AD_PRODUCT_CONCEPT_MAX
  ) {
    invalid("an Ad Run must contain between one and three Product concepts");
  }
  const productNames = productSubjects.map(({ name }) => name.toLocaleLowerCase());
  if (new Set(productNames).size !== productNames.length) {
    invalid("an Ad Run must contain distinct Products");
  }
  concepts.forEach(({ model }, index) => {
    const expectedTier = index < AD_PRIMARY_MODEL_COUNT ? "primary" : "secondary";
    if (imageModelById(model)?.tier !== expectedTier) {
      invalid(`${expectedTier} Image Model required in slot ${index + 1}`);
    }
  });

  return {
    brief: decodeBrief(plan.brief),
    concepts,
  };
}

const RENDERED_AD_QUERY_KEYS = [
  "domain",
  "concept",
  "model",
  "subject",
  "product",
  "productDescription",
  "productImage",
  "headline",
  "sub",
  "name",
  "colorA",
  "colorB",
  "summary",
  "industry",
  "mood",
  "font",
  "logo",
  "scene",
  "ask",
  "people",
] as const;

function encodeRenderedAdQuery(query: Omit<RenderedAdQuery, "canonicalHref">): string {
  const params = new URLSearchParams({
    domain: query.domain,
    concept: query.concept,
    model: query.model,
    subject: query.subject.kind,
  });
  if (query.subject.kind === "product") {
    params.set("product", query.subject.name);
    params.set("productDescription", query.subject.description);
    // Absent rather than empty when the site publishes no photo, so the
    // canonical URL — and therefore the CDN key — stays stable.
    if (query.subject.imageUrl) params.set("productImage", query.subject.imageUrl);
  }
  params.set("headline", query.headline);
  params.set("sub", query.subheadline);
  params.set("name", query.brandName);
  params.set("colorA", query.colorA);
  params.set("colorB", query.colorB);
  params.set("summary", query.summary);
  params.set("industry", query.industry);
  params.set("mood", query.mood);
  if (query.fontFamily) params.set("font", query.fontFamily);
  if (query.logoUrl) params.set("logo", query.logoUrl);
  // Absent rather than empty when nothing was asked, so a run made without the
  // request box keeps the URL — and the CDN entry — it has always had.
  if (query.scene) params.set("scene", query.scene);
  if (query.instruction) params.set("ask", query.instruction);
  if (query.showsPeople) params.set("people", "1");
  return `/api/ad?${params.toString()}`;
}

/** Canonical GET URL for the CDN-cached Brief. */
export function briefHref(rawDomain: string): string {
  const domain = normalizeDomain(rawDomain);
  if (!domain) invalid("Brief domain is invalid");
  return `/api/brief?${new URLSearchParams({
    domain,
    v: BRIEF_FORMAT_VERSION,
  }).toString()}`;
}

/** Canonical GET URL for one CDN-cached Rendered Ad. */
export function renderedAdHref(brief: AdBrief, concept: PlannedConcept): string {
  const validBrief = decodeBrief(brief);
  const validConcept = decodeConcept(concept);
  return encodeRenderedAdQuery({
    domain: validBrief.domain,
    concept: validConcept.key,
    model: validConcept.model,
    subject: validConcept.subject,
    headline: validConcept.headline,
    subheadline: validConcept.subheadline,
    scene: validConcept.scene,
    instruction: validConcept.instruction,
    showsPeople: validConcept.showsPeople,
    brandName: validBrief.brandName,
    colorA: validBrief.colorA,
    colorB: validBrief.colorB,
    summary: validBrief.summary,
    industry: validBrief.industry,
    mood: validBrief.mood,
    fontFamily: validBrief.fontFamily,
    logoUrl: validBrief.logoUrl,
  });
}

function searchParamsFrom(input: URL | URLSearchParams | string): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  if (input instanceof URL) return new URLSearchParams(input.searchParams);
  if (input.startsWith("/") || input.includes("://")) {
    return new URL(input, "https://branda.invalid").searchParams;
  }
  return new URLSearchParams(input.startsWith("?") ? input.slice(1) : input);
}

function requiredParameter(params: URLSearchParams, name: string): string {
  const values = params.getAll(name);
  if (values.length !== 1) invalid(`${name} must appear exactly once`);
  return values[0];
}

function decodeQuerySubject(params: URLSearchParams): ConceptSubject {
  const kind = requiredParameter(params, "subject");
  if (kind === "company") {
    if (
      params.has("product") ||
      params.has("productDescription") ||
      params.has("productImage")
    ) {
      invalid("Company subjects cannot contain Product parameters");
    }
    return decodeSubject({ kind }, "subject");
  }
  if (kind !== "product") invalid("subject.kind is unknown");
  return decodeSubject(
    {
      kind,
      name: requiredParameter(params, "product"),
      description: requiredParameter(params, "productDescription"),
      imageUrl: params.get("productImage"),
    },
    "subject",
  );
}

/** Decode and validate the public query used to render an Ad. */
export function decodeRenderedAdQuery(input: URL | URLSearchParams | string): RenderedAdQuery {
  const params = searchParamsFrom(input);
  for (const key of new Set(params.keys())) {
    if (!(RENDERED_AD_QUERY_KEYS as readonly string[]).includes(key)) {
      invalid(`unknown Rendered Ad parameter ${key}`);
    }
    if (params.getAll(key).length !== 1) invalid(`${key} must appear exactly once`);
  }

  if (params.has("people") && params.get("people") !== "1") {
    invalid("people must be 1 when present");
  }

  const subject = decodeQuerySubject(params);
  const copy = decodeConcept({
    key: requiredParameter(params, "concept"),
    model: requiredParameter(params, "model"),
    subject,
    headline: requiredParameter(params, "headline"),
    subheadline: requiredParameter(params, "sub"),
    ...(params.has("scene")
      ? { scene: requiredParameter(params, "scene") }
      : {}),
    ...(params.has("ask")
      ? { instruction: requiredParameter(params, "ask") }
      : {}),
    showsPeople: params.has("people"),
  });

  const query = {
    domain: canonicalDomain(requiredParameter(params, "domain")),
    concept: copy.key,
    model: copy.model,
    subject,
    headline: copy.headline,
    subheadline: copy.subheadline,
    scene: copy.scene,
    instruction: copy.instruction,
    showsPeople: copy.showsPeople,
    brandName: text(requiredParameter(params, "name"), "name", {
      min: 1,
      max: AD_RUN_LIMITS.brandName,
      trim: true,
    }),
    colorA: text(requiredParameter(params, "colorA"), "colorA", {
      min: 1,
      max: AD_RUN_LIMITS.promptColor,
      trim: true,
    }),
    colorB: text(requiredParameter(params, "colorB"), "colorB", {
      min: 1,
      max: AD_RUN_LIMITS.promptColor,
      trim: true,
    }),
    summary: text(requiredParameter(params, "summary"), "summary", {
      max: AD_RUN_LIMITS.summary,
    }),
    industry: text(requiredParameter(params, "industry"), "industry", {
      max: AD_RUN_LIMITS.industry,
    }),
    mood: text(requiredParameter(params, "mood"), "mood", {
      min: 1,
      max: AD_RUN_LIMITS.mood,
      trim: true,
    }),
    fontFamily: params.has("font")
      ? promptFontFamily(requiredParameter(params, "font"), "font")
      : null,
    logoUrl: params.has("logo") ? publicHttpUrl(requiredParameter(params, "logo"), "logo") : null,
  };

  return { ...query, canonicalHref: encodeRenderedAdQuery(query) };
}
