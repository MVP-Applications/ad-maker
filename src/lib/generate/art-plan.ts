import { z } from "zod";
import { AD_RUN_LIMITS } from "@/lib/ad-run-policy";
import {
  CREATIVE_DIRECTION_KEYS,
  directionByKey,
  isPhotoSafe,
  type CreativeDirectionKey,
} from "./directions";
import type { AspectRatio } from "./shape";

/**
 * What one image is going to be, decided before a single word of the prompt is
 * written.
 *
 * The composer used to hand an image model everything it knew about a Product
 * and hope: name, description, price, currency, all inside one quoted line. An
 * image model renders quoted strings, so it rendered them — every ad came back
 * with a price tag stamped on it and the product's own catalogue copy set as
 * body text. The model was not being careless. It was being told to.
 *
 * The fix is to split what an ad KNOWS from what an ad SAYS. This module is the
 * shape of that split: a plan names the strings that may appear in the picture
 * and nothing else may. Facts still travel — the model has to know it is lighting
 * a forty-dollar tote rather than a four-thousand-dollar one — but they travel in
 * a block the prompt marks as understanding rather than as copy.
 *
 * Nothing here calls a model. The decision arrives from `director.ts`; this is
 * the contract it answers to, the policy that corrects it, and the prompt built
 * from what survives.
 */

/**
 * The eight jobs an advertisement can be doing. Not styles — a style is the
 * Creative Direction — but intents, because what an ad is FOR is what decides
 * whether a price belongs on it. A hero shot that names its price is a flyer;
 * a promotion that hides it is a waste of the buy.
 */
export const AD_TYPES = [
  "product_hero",
  "multi_product",
  "promo_offer",
  "brand_awareness",
  "product_launch",
  "lifestyle",
  "seasonal",
  "testimonial",
] as const;

export type AdType = (typeof AD_TYPES)[number];

/** What each intent is for, stated to the director rather than inferred by it. */
export const AD_TYPE_BRIEFS: Record<AdType, string> = {
  product_hero: "one article, shown beautifully. Sells desire, not terms.",
  multi_product:
    "a range shown together. Sells breadth — the line-up is the message.",
  promo_offer:
    "a specific commercial offer: a price, a discount, a deadline. The number is the message.",
  brand_awareness:
    "the company and what it stands for. No article, no offer, no terms.",
  product_launch: "something new. Sells novelty and arrival.",
  lifestyle: "the article in the life it belongs to. Sells the feeling of use.",
  seasonal: "an occasion — a holiday, a season, a moment with a date on it.",
  testimonial: "proof from a customer. The quote carries the ad.",
};

/**
 * The intents that earn a price.
 *
 * A price is a commitment, and it dates an image the day the shop changes it.
 * These two are the cases where that cost buys something: an offer without its
 * number is not an offer, and a seasonal sale is an offer with a deadline.
 * Everywhere else a price has to be asked for.
 */
const PRICE_LED_AD_TYPES = new Set<AdType>(["promo_offer", "seasonal"]);

/** The direction to fall back to when the intent is known and the style is not. */
const DIRECTION_FOR_AD_TYPE: Record<AdType, CreativeDirectionKey> = {
  product_hero: "product_hero",
  multi_product: "editorial_spread",
  promo_offer: "typographic",
  brand_awareness: "gradient_field",
  product_launch: "product_hero",
  lifestyle: "editorial_spread",
  seasonal: "editorial_spread",
  testimonial: "typographic",
};

/**
 * Every kind of string an advertisement is allowed to carry.
 *
 * A closed list rather than free text, because this is the list the prompt turns
 * into "render exactly these and nothing else". A role the plan cannot name is a
 * role the picture cannot contain, which is the whole point.
 */
export const TEXT_ROLES = [
  "headline",
  "subheadline",
  "brand",
  "product_name",
  "price",
  "cta",
  "badge",
  "legal",
] as const;

export type TextRole = (typeof TEXT_ROLES)[number];

/** Where a block sits, in the words a picture can be composed from. */
export const PLACEMENTS = [
  "top_left",
  "top_center",
  "top_right",
  "upper_third",
  "center",
  "lower_third",
  "bottom_left",
  "bottom_center",
  "bottom_right",
] as const;

export type Placement = (typeof PLACEMENTS)[number];

/** Read straight into "positioned at …", so every one of these is a noun phrase. */
const PLACEMENT_PROSE: Record<Placement, string> = {
  top_left: "the upper-left corner",
  top_center: "the top edge, centred",
  top_right: "the upper-right corner",
  upper_third: "the upper third of the frame",
  center: "the optical centre",
  lower_third: "the lower third of the frame",
  bottom_left: "the lower-left corner",
  bottom_center: "the bottom edge, centred",
  bottom_right: "the lower-right corner",
};

export const TEXT_WEIGHTS = [
  "light",
  "regular",
  "medium",
  "bold",
  "black",
] as const;
export type TextWeight = (typeof TEXT_WEIGHTS)[number];

export const TEXT_CASES = ["as_written", "uppercase"] as const;
export type TextCase = (typeof TEXT_CASES)[number];

/**
 * How the picture and its words are arranged. Distinct from the Creative
 * Direction, which decides what the picture is OF — two Product Hero ads can be
 * a poster and a corner-anchored crop and look nothing alike.
 */
export const LAYOUTS = [
  "poster_stack",
  "centered_hero",
  "side_by_side",
  "corner_anchored",
  "editorial_margin",
  "type_dominant",
] as const;

export type Layout = (typeof LAYOUTS)[number];

const LAYOUT_PROSE: Record<Layout, string> = {
  poster_stack:
    "Poster stack: the headline stacked hard against one edge, every smaller line ranged to the same margin, the subject holding the opposite side.",
  centered_hero:
    "Centred hero: the subject on the optical centre with the type in symmetric bands above and below it.",
  side_by_side:
    "Split field: the subject owns one half of the canvas and an uninterrupted field of colour owns the other, with all type set into that field.",
  corner_anchored:
    "Corner anchored: the subject fills the frame and every piece of type is tucked into one corner with generous margins around it.",
  editorial_margin:
    "Editorial margin: a wide calm margin along one side holding small, precise, unhurried type, the picture occupying the rest.",
  type_dominant:
    "Type dominant: the typography IS the artwork, filling most of the frame, with the picture reduced to a field or a single supporting element.",
};

/**
 * Cap height as a share of the canvas height, floor and ceiling per role.
 *
 * Percentages rather than points because an image model has no type engine — it
 * has a canvas, and "about 14% of the image height" is a proportion it can
 * actually hold. The ranges keep hierarchy intact when the director reaches for
 * an extreme: a headline can be enormous, a legal line can never be.
 */
const SIZE_RANGE: Record<TextRole, { min: number; max: number }> = {
  headline: { min: 6, max: 22 },
  subheadline: { min: 2.5, max: 8 },
  brand: { min: 1.5, max: 5 },
  product_name: { min: 2, max: 8 },
  price: { min: 2.5, max: 12 },
  cta: { min: 2, max: 6 },
  badge: { min: 2.5, max: 9 },
  legal: { min: 1, max: 2.5 },
};

/** How long each kind of string may be, in characters. */
const TEXT_LIMIT: Record<TextRole, number> = {
  headline: AD_RUN_LIMITS.headline,
  subheadline: AD_RUN_LIMITS.subheadline,
  brand: AD_RUN_LIMITS.brandName,
  product_name: AD_RUN_LIMITS.productName,
  price: 24,
  cta: 24,
  badge: 24,
  legal: 120,
};

/**
 * Which lines survive when a plan asks for too many.
 *
 * An ad that says four things says none of them. The order is what a designer
 * would cut in: the headline is the ad, the wordmark is who is paying for it,
 * and everything after that is negotiable.
 */
const ROLE_PRIORITY: readonly TextRole[] = [
  "headline",
  "brand",
  "subheadline",
  "price",
  "cta",
  "badge",
  "product_name",
  "legal",
];

/**
 * Five, and four is usually better.
 *
 * The ceiling exists because the failure it replaces was an image carrying a
 * name, a price, a full catalogue description and a brand line all at once —
 * every fact the route knew, set as type. Five is the most a square poster holds
 * before the hierarchy stops reading at thumbnail size, which is where an ad is
 * actually seen.
 */
export const TEXT_BLOCK_MAX = 5;

/**
 * How many articles one picture may be about.
 *
 * Deliberately not the model's photograph capacity: a model that can be shown
 * no reference at all can still advertise three Products, described in words
 * and named truthfully. Capacity bounds what is attached, which is a separate
 * question answered where the photographs are loaded.
 */
export const SUBJECT_MAX = 5;

export type TextBlock = {
  role: TextRole;
  text: string;
  /** Cap height as a share of the canvas height, 1–22. */
  sizePercent: number;
  weight: TextWeight;
  case: TextCase;
  placement: Placement;
};

/** One catalogue entry, as much of it as an image decision needs. */
export type CatalogProduct = {
  name: string;
  description: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
};

/**
 * Everything the director is allowed to know, and everything the prompt is
 * built from. The split between `named` and `catalog` is the difference between
 * "an ad for @Halo Bag" and "an ad for my bestsellers": the first names the
 * article, the second leaves the choosing to the director.
 */
export type ArtContext = {
  request: string;
  brandName: string;
  domain: string;
  industry: string;
  summary: string;
  mood: string;
  colorA: string;
  colorB: string;
  fontFamily: string | null;
  /** Who buys, as a sentence. Empty when the extractor read no market. */
  audience: string;
  /**
   * The language the shop publishes in, as a BCP-47-ish tag. Copy is written in
   * it rather than in English: an Arabic perfume house advertising in English is
   * a translation error with a media budget behind it.
   */
  language: string;
  /** Products the person named in the text. Their choice, and it holds. */
  named: readonly CatalogProduct[];
  /** The rest of the shop, for a request that describes rather than names. */
  catalog: readonly CatalogProduct[];
  aspectRatio: AspectRatio;
  /** How many photographs this image model can actually be shown. */
  photographCapacity: number;
};

export type ArtPlan = {
  adType: AdType;
  direction: CreativeDirectionKey;
  /** Why this direction, in the director's words. Shown, logged, never rendered. */
  rationale: string;
  /** Who this ad is talking to, as the director read it. Never rendered. */
  audienceNote: string;
  /** Catalogue names, resolved. Empty means a company-level ad. */
  heroProducts: string[];
  supportingProducts: string[];
  scene: string;
  showsPeople: boolean;
  palette: { background: string; ink: string; accent: string };
  typeface: string;
  layout: Layout;
  blocks: TextBlock[];
};

const textBlockSchema = z.object({
  role: z.enum(TEXT_ROLES),
  text: z.string().describe("the exact characters to render, nothing more"),
  sizePercent: z
    .number()
    .describe(
      "cap height as a percentage of the image height — a poster headline is 12-20, a wordmark 2-3",
    ),
  weight: z.enum(TEXT_WEIGHTS),
  case: z.enum(TEXT_CASES),
  placement: z.enum(PLACEMENTS),
});

/**
 * What the director must answer with. Every field is a decision it would
 * otherwise leave to an image model, and an image model asked to decide
 * typography answers with a price tag.
 */
export const artPlanSchema = z.object({
  adType: z.enum(AD_TYPES),
  direction: z.enum(CREATIVE_DIRECTION_KEYS),
  rationale: z
    .string()
    .describe("one sentence: why this ad type and this direction, for this brand"),
  audienceNote: z
    .string()
    .describe("one sentence: who this specific image is talking to"),
  heroProducts: z
    .array(z.string())
    .describe(
      "exact catalogue names of the products this ad is about; empty for a company-level ad",
    ),
  supportingProducts: z
    .array(z.string())
    .describe("exact catalogue names of products that appear but are not the subject"),
  scene: z
    .string()
    .describe(
      "the picture in 2-4 sentences: subject, lighting, camera, composition. Describe what IS in frame. No text, letters or logos — those are listed separately.",
    ),
  buyerAskedForPeople: z
    .boolean()
    .describe("true only if the request itself asks for a person, model or human presence"),
  buyerAskedForPrice: z
    .boolean()
    .describe("true only if the request itself asks for a price, cost, discount or offer to be shown"),
  palette: z.object({
    background: z.string().describe("the dominant field, in plain words — never a hex code"),
    ink: z.string().describe("the colour the type is set in, in plain words"),
    accent: z.string().describe("the one accent, in plain words"),
  }),
  typeface: z
    .string()
    .describe("the type family to set everything in, or a precise description of one"),
  layout: z.enum(LAYOUTS),
  blocks: z
    .array(textBlockSchema)
    .describe(
      `every string that may appear in the image, at most ${TEXT_BLOCK_MAX}. Anything not listed here will not exist in the picture.`,
    ),
});

export type RawArtPlan = z.infer<typeof artPlanSchema>;

const trimTo = (value: string, max: number) => value.trim().slice(0, max);

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

const key = (name: string) => name.trim().toLocaleLowerCase();

/**
 * A price as a shop states it, never as a model remembers it.
 *
 * The number in the picture has to be the number in the catalogue. Letting the
 * director write "$49" for a product listed at 48.50 is a smaller error than a
 * hallucinated product but the same kind of error, and it is the one kind this
 * pipeline exists not to make.
 */
export function priceText(product: CatalogProduct): string | null {
  if (product.price === null || !product.currency) return null;
  const amount = Number.isInteger(product.price)
    ? String(product.price)
    : product.price.toFixed(2);
  return `${product.currency} ${amount}`;
}

/** Catalogue entries by name, the person's own choices first. */
export function resolveProducts(
  names: readonly string[],
  context: ArtContext,
): CatalogProduct[] {
  const pool = [...context.named, ...context.catalog];
  const seen = new Set<string>();
  return names.flatMap((name) => {
    const match = pool.find((product) => key(product.name) === key(name));
    if (!match || seen.has(key(match.name))) return [];
    seen.add(key(match.name));
    return [match];
  });
}

/**
 * The plan the director asked for, corrected to the one it is allowed to have.
 *
 * Every rule below is a rule the director is also told in words, and told twice
 * because a model that is asked for judgement will occasionally answer with
 * enthusiasm instead. The same shape as `preferPhotoSafeDirections` in the Ad
 * Run: the model proposes, the code decides.
 */
export function enforceArtPlan(raw: RawArtPlan, context: ArtContext): ArtPlan {
  const adType: AdType = AD_TYPES.includes(raw.adType) ? raw.adType : "product_hero";

  /**
   * Named products win outright. A person who typed "@Halo Bag" has already
   * made the decision the director is being asked to make, and a director that
   * quietly swaps in a different bag is answering a question nobody asked.
   */
  const heroes = (
    context.named.length > 0
      ? [...context.named]
      : resolveProducts(raw.heroProducts, context)
  ).slice(0, SUBJECT_MAX);

  const supporting = resolveProducts(raw.supportingProducts, context).filter(
    (product) => !heroes.some((hero) => key(hero.name) === key(product.name)),
  );

  /**
   * A photograph and an abstract direction are two incompatible instructions —
   * the reason `PHOTO_SAFE_DIRECTIONS` exists. The composer reaches the same
   * conclusion from the other end: it knows whether a photograph will actually
   * be attached, so it can insist rather than prefer.
   */
  const willAttachPhoto =
    context.photographCapacity > 0 && heroes.some((product) => product.imageUrl);

  let direction: CreativeDirectionKey = directionByKey(raw.direction)
    ? raw.direction
    : DIRECTION_FOR_AD_TYPE[adType];
  if (willAttachPhoto && !isPhotoSafe(direction)) {
    direction = heroes.length > 1 ? "editorial_spread" : "product_hero";
  }

  /**
   * People stay off unless they were asked for, which is the Ad Run's rule and
   * for the Ad Run's reason: a model told to draw a keyboard adds a hand holding
   * it, and hands are where image models fail most visibly. A lifestyle ad that
   * wants a person only has to say so.
   */
  const showsPeople = raw.buyerAskedForPeople === true;

  /**
   * The price gate, and the reason this module exists.
   *
   * Three things have to be true at once: the shop publishes a price, the ad is
   * the kind that carries one, and exactly one article is being priced. That
   * last one is not fussiness — two heroes and one price tag is a picture that
   * tells the buyer the wrong number about one of them.
   */
  const priced = heroes.filter((product) => priceText(product) !== null);
  const priceAllowed =
    priced.length === 1 &&
    (raw.buyerAskedForPrice === true || PRICE_LED_AD_TYPES.has(adType));
  const realPrice = priceAllowed ? priceText(priced[0]) : null;

  const blocks: TextBlock[] = [];
  const usedRoles = new Set<TextRole>();
  for (const block of raw.blocks ?? []) {
    if (!TEXT_ROLES.includes(block.role)) continue;
    // One of each. A second headline is a plan that did not decide.
    if (usedRoles.has(block.role)) continue;

    if (block.role === "price" && !realPrice) continue;
    const text = trimTo(
      block.role === "price" ? realPrice! : block.text ?? "",
      TEXT_LIMIT[block.role],
    );
    if (!text) continue;

    const range = SIZE_RANGE[block.role];
    usedRoles.add(block.role);
    blocks.push({
      role: block.role,
      text,
      sizePercent: clamp(block.sizePercent, range.min, range.max),
      weight: TEXT_WEIGHTS.includes(block.weight) ? block.weight : "medium",
      case: TEXT_CASES.includes(block.case) ? block.case : "as_written",
      placement: PLACEMENTS.includes(block.placement)
        ? block.placement
        : "bottom_left",
    });
  }

  /**
   * An ad with no words is a photograph. If the director returned nothing
   * usable, the brand name alone is still an advertisement — and it is the one
   * string that is certainly true.
   */
  if (blocks.length === 0) {
    blocks.push({
      role: "headline",
      text: trimTo(context.brandName, TEXT_LIMIT.headline),
      sizePercent: 12,
      weight: "bold",
      case: "as_written",
      placement: "center",
    });
  }

  const ranked = ROLE_PRIORITY.flatMap((role) => {
    const found = blocks.find((block) => block.role === role);
    return found ? [found] : [];
  }).slice(0, TEXT_BLOCK_MAX);

  /**
   * Hierarchy last, because it is the one property no single block can be
   * checked for. A subheadline set larger than its headline is legible, correct
   * per block, and still a broken ad.
   */
  const headline = ranked.find((block) => block.role === "headline");
  const ordered = headline
    ? ranked.map((block) =>
        block.role !== "headline" && block.sizePercent >= headline.sizePercent
          ? { ...block, sizePercent: headline.sizePercent * 0.45 }
          : block,
      )
    : ranked;

  return {
    adType,
    direction,
    rationale: trimTo(raw.rationale ?? "", 300),
    audienceNote: trimTo(raw.audienceNote ?? "", 300),
    heroProducts: heroes.map((product) => product.name),
    supportingProducts: supporting.map((product) => product.name),
    scene: trimTo(raw.scene ?? "", AD_RUN_LIMITS.scene),
    showsPeople,
    palette: {
      background: trimTo(raw.palette?.background ?? context.colorA, AD_RUN_LIMITS.promptColor),
      ink: trimTo(raw.palette?.ink ?? context.colorB, AD_RUN_LIMITS.promptColor),
      accent: trimTo(raw.palette?.accent ?? context.colorB, AD_RUN_LIMITS.promptColor),
    },
    typeface:
      trimTo(raw.typeface ?? "", AD_RUN_LIMITS.fontFamily) ||
      context.fontFamily ||
      "one clean geometric sans-serif",
    layout: LAYOUTS.includes(raw.layout) ? raw.layout : "poster_stack",
    blocks: ordered,
  };
}

/**
 * A plan for a request no model ever saw.
 *
 * The director is one network call and one JSON parse away from failing, and a
 * failed call must cost variety rather than cost the image. This is the ad the
 * composer made before there was a director: the person's words, the brand's
 * name, and nothing invented.
 */
export function fallbackArtPlan(context: ArtContext): ArtPlan {
  const heroes = context.named.slice(0, SUBJECT_MAX);
  const willAttachPhoto =
    context.photographCapacity > 0 && heroes.some((product) => product.imageUrl);

  return {
    adType: heroes.length > 1 ? "multi_product" : heroes.length === 1 ? "product_hero" : "brand_awareness",
    direction: willAttachPhoto
      ? heroes.length > 1
        ? "editorial_spread"
        : "product_hero"
      : "gradient_field",
    rationale: "The art director was unavailable; this is the request as written.",
    audienceNote: "",
    heroProducts: heroes.map((product) => product.name),
    supportingProducts: [],
    scene: "",
    showsPeople: false,
    palette: {
      background: context.colorA,
      ink: context.colorB,
      accent: context.colorB,
    },
    typeface: context.fontFamily || "one clean geometric sans-serif",
    layout: "poster_stack",
    blocks: [
      {
        role: "brand",
        text: trimTo(context.brandName, TEXT_LIMIT.brand),
        sizePercent: 3,
        weight: "medium",
        case: "as_written",
        placement: "bottom_left",
      },
    ],
  };
}

const ROLE_PROSE: Record<TextRole, string> = {
  headline: "the headline",
  subheadline: "the supporting line",
  brand: "the wordmark",
  product_name: "the product name",
  price: "the price",
  cta: "the call to action",
  badge: "the badge",
  legal: "the legal line",
};

/**
 * A shop's own product copy, closed off so the next fact does not run into it.
 * Catalogue descriptions arrive both ways and "an eau de parfum Listed at SAR
 * 450" is one sentence claiming the wrong thing.
 */
const sentence = (value: string) =>
  !value || /[.!?…。]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;

/** One line of the render list: the string, then how it is set. */
function blockLine(block: TextBlock, index: number): string {
  const spec = [
    ROLE_PROSE[block.role],
    `cap height about ${Number(block.sizePercent.toFixed(1))}% of the image height`,
    `${block.weight} weight`,
    block.case === "uppercase" ? "set in capitals" : "set exactly as written",
    `positioned at ${PLACEMENT_PROSE[block.placement]}`,
  ].join(", ");
  return `${index + 1}. "${block.text}" — ${spec}`;
}

/**
 * What the model may know, marked as knowledge.
 *
 * Every fact an ad is built on lives here, including the ones that must never
 * be painted: the price, the catalogue description, who the shop sells to. They
 * are here because a model that does not know the price lights a forty-dollar
 * tote like a four-thousand-dollar one, and they are fenced because the last
 * time they were not, it wrote them across the picture.
 */
function contextBlock(
  plan: ArtPlan,
  context: ArtContext,
  photographed: readonly CatalogProduct[],
  described: readonly CatalogProduct[],
): string {
  const products = [...photographed, ...described];
  return [
    `BACKGROUND — understand this, never render any of it as text:`,
    `Brand: ${context.brandName} (${context.domain})${context.industry ? `, ${context.industry}` : ""}.`,
    context.summary ? `What they sell: ${context.summary}` : "",
    context.mood ? `Brand mood: ${context.mood}.` : "",
    /**
     * The director's own sentence about who is looking, rather than the market
     * read it drew that sentence from. The read is inferred rather than stated
     * and has never been allowed into an image prompt; this is a decision made
     * for this one picture, which is a different thing.
     */
    plan.audienceNote ? `This image speaks to: ${plan.audienceNote}` : "",
    products.length > 0
      ? `The products in this image — exactly these ${products.length}, and no others:`
      : "",
    ...photographed.map((product, index) => {
      const price = priceText(product);
      return `  Photograph ${index + 1} is "${product.name}" — ${sentence(product.description)}${price ? ` Listed at ${price}.` : ""}`;
    }),
    ...described.map((product) => {
      const price = priceText(product);
      return `  "${product.name}" — ${sentence(product.description)}${price ? ` Listed at ${price}.` : ""} (no photograph supplied — build it from this description alone).`;
    }),
    products.length > 0
      ? `  Do not add a product that is not listed above, and do not invent names, brands or claims for them.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The three rules every composed image closes with, adapted from the image-ad
 * prompt library in arcads-claude-code (MIT).
 *
 * None of them is creative direction — the direction is the plan's, and these do
 * not touch it. Each forbids one thing the model was never asked for and reaches
 * for anyway, across every current image model rather than on one provider.
 */
const GUARDRAILS = [
  // Asked for an ad, a model will hand back a picture of a phone showing one.
  `Render the advertisement itself, edge to edge — not a screenshot of one sitting in a feed. No app or platform interface of any kind: no profile row, avatar, handle or Sponsored label; no caption or post text; no like, comment, share or save buttons; no engagement counts; no navigation or tab bars; no story progress bars; no phone, browser or device chrome.`,
  // A headline is worth nothing with its last two letters past the canvas.
  `Keep every piece of text and every focal subject within the central 84% of the canvas, leaving roughly 8% clear on all four sides. Backgrounds and fields of colour may run to the edge; words and subjects may not touch or cross it. If a subject will not fit, scale it down — never crop the text.`,
  // Both halves of one habit: treating text as texture rather than as language.
  `Inside any block of text, use plain words only — no emoji, no decorative unicode, no stray symbols mid-sentence. Where this prompt states a count, render exactly that many: nothing extra invented, nothing left out.`,
];

const hardRules = (showsPeople: boolean) =>
  [
    `HARD RULES:`,
    `• Never print a hex code, a colour code or a colour name anywhere in the image.`,
    `• No placeholder labels, lorem ipsum, hashtags, invented URLs, or gibberish micro-text of any kind.`,
    showsPeople
      ? `• People are allowed here because the request asked for them. Render any person photorealistically and anatomically correct — hands especially. The advertised subject stays the focus; a person supports it and never obscures it.`
      : `• Absolutely no people, faces or hands.`,
    `• No watermarks, borders or frames.`,
  ].join("\n");

/**
 * The finished image prompt.
 *
 * Order is load-bearing and was settled by what each position costs. The
 * person's own words open, because they are the direction. The render list sits
 * near the close, where the failure it fixes lived. Fidelity still closes:
 * last position is what an image model weighs most, and the evidence for giving
 * it to the article — a keyboard that came back recoloured the moment anything
 * outranked it — is stronger than the evidence for giving it to the type.
 */
export function buildDirectedPrompt(input: {
  plan: ArtPlan;
  context: ArtContext;
  photographed: readonly CatalogProduct[];
  described: readonly CatalogProduct[];
  /** The reference-fidelity paragraph, when a photograph is travelling. */
  fidelity: string;
}): string {
  const { plan, context } = input;
  const direction = directionByKey(plan.direction);

  const renderList =
    plan.blocks.length > 0
      ? [
          `THE TEXT IN THIS IMAGE — render EXACTLY these ${plan.blocks.length} string${plan.blocks.length === 1 ? "" : "s"} and absolutely nothing else. No other word, number, label or letter may appear anywhere in the picture:`,
          ...plan.blocks.map(blockLine),
          `Spelling letter for letter, exactly as quoted. Do not translate, repeat, abbreviate, extend or drop a single word.`,
          `Set everything in ${plan.typeface}, with tight professional kerning, comfortable line-height, and no hyphenation or broken words. Typography of the standard a designer would ship: clean, sharp, flawless, on a clear hierarchy.`,
          `Place every string over the calmest part of the composition so each character stays perfectly legible.`,
        ].join("\n")
      : `THE TEXT IN THIS IMAGE — none. Not one word, letter, number or logo appears anywhere in this picture.`;

  const artDirection = [
    `ART DIRECTION — ${plan.adType.replace(/_/g, " ")}${direction ? `, in the style of ${direction.label}` : ""}, ${context.aspectRatio}.`,
    plan.scene,
    LAYOUT_PROSE[plan.layout],
    `Palette: ${plan.palette.background} as the dominant field, ${plan.palette.ink} for the type, ${plan.palette.accent} as the single accent.`,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    context.request.trim(),
    artDirection,
    contextBlock(plan, context, input.photographed, input.described),
    renderList,
    hardRules(plan.showsPeople),
    ...GUARDRAILS,
    `Everything in this brief is an instruction to you, never copy to render. The only text permitted in the artwork is the quoted string${plan.blocks.length === 1 ? "" : "s"} listed above.`,
    input.fidelity,
  ]
    .filter(Boolean)
    .join("\n\n");
}
