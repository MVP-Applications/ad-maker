/** Product policy shared by the contract, catalogs, planner, and Gallery. */
export const AD_COMPANY_CONCEPT_COUNT = 3 as const;
export const AD_PRODUCT_CONCEPT_MIN = 1 as const;
export const AD_PRODUCT_CONCEPT_MAX = 3 as const;
export const AD_RUN_MIN_SIZE = 4 as const;
export const AD_RUN_MAX_SIZE = 6 as const;
export const AD_PRIMARY_MODEL_COUNT = 3 as const;

/**
 * How many Products the Brief may carry. An Ad Run still advertises at most
 * AD_PRODUCT_CONCEPT_MAX of them; the rest exist so the person can choose which,
 * which is impossible when the catalog is truncated to the number we happened to
 * pick automatically.
 *
 * Sized against real shops rather than a round number: allbirds.com publishes
 * 291 products and nuphy.com 680, and the extractor returns every one of them.
 * All 680 weigh 208 KB in a Brief, so the ceiling is about the size of the page
 * rather than the size of the payload.
 */
export const AD_CATALOG_MAX = 1000 as const;

export const AD_RUN_LIMITS = {
  domain: 253,
  brandName: 80,
  description: 2000,
  industry: 120,
  summary: 480,
  mood: 160,
  fontFamily: 100,
  promptColor: 40,
  logoUrl: 2048,
  palette: 8,
  colorName: 80,
  directionKey: 80,
  imageModelId: 120,
  headline: 60,
  headlineWords: 3,
  subheadline: 120,
  subheadlineWords: 12,
  productName: 120,
  productDescription: 500,
  /** The shop's own price, guarding against a parse that returned nonsense. */
  price: 1_000_000,
  currency: 8,
  productUrl: 2048,
  /** The brand's own headline, which is a sentence rather than ad copy. */
  brandHeadline: 300,
  /**
   * What the person asked for, in their words. Long enough for a real request
   * — "show it with a man walking through an airport" — and short enough that
   * it cannot crowd out the brand and Product facts it sits beside.
   */
  instruction: 300,
  language: 16,
  languages: 12,
} as const;
