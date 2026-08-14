import { describe, expect, it } from "vitest";
import {
  TEXT_BLOCK_MAX,
  buildDirectedPrompt,
  enforceArtPlan,
  fallbackArtPlan,
  priceText,
  type ArtContext,
  type CatalogProduct,
  type RawArtPlan,
} from "./art-plan";

const product = (
  name: string,
  extra: Partial<CatalogProduct> = {},
): CatalogProduct => ({
  name,
  description: `${name}, an eau de parfum`,
  imageUrl: null,
  price: 450,
  currency: "SAR",
  ...extra,
});

const context = (extra: Partial<ArtContext> = {}): ArtContext => ({
  request: "an ad for the new bottle",
  brandName: "Nouvona",
  domain: "nouvona.com",
  industry: "fragrance",
  summary: "They sell perfume.",
  mood: "modern, confident",
  colorA: "deep navy",
  colorB: "warm gold",
  fontFamily: "Inter",
  audience: "Women in the Gulf buying gifts.",
  language: "ar",
  named: [],
  catalog: [],
  aspectRatio: "1:1",
  photographCapacity: 5,
  ...extra,
});

const block = (extra: Partial<RawArtPlan["blocks"][number]> = {}) => ({
  role: "headline" as const,
  text: "Carry it anywhere",
  sizePercent: 14,
  weight: "bold" as const,
  case: "as_written" as const,
  placement: "top_left" as const,
  ...extra,
});

const plan = (extra: Partial<RawArtPlan> = {}): RawArtPlan => ({
  adType: "product_hero",
  direction: "product_hero",
  rationale: "A physical article deserves a hero shot.",
  audienceNote: "Gift buyers.",
  heroProducts: [],
  supportingProducts: [],
  scene: "One bottle on a seamless backdrop, lit from the left.",
  buyerAskedForPeople: false,
  buyerAskedForPrice: false,
  palette: { background: "deep navy", ink: "warm gold", accent: "warm gold" },
  typeface: "Inter",
  layout: "poster_stack",
  blocks: [block()],
  ...extra,
});

const roles = (blocks: readonly { role: string }[]) =>
  blocks.map(({ role }) => role);

describe("the price gate", () => {
  const priceBlock = block({ role: "price", text: "SAR 999", sizePercent: 5 });

  it("keeps a price off a hero shot nobody asked to price", () => {
    const enforced = enforceArtPlan(
      plan({ adType: "product_hero", blocks: [block(), priceBlock] }),
      context({ named: [product("Bella Nera")] }),
    );

    expect(roles(enforced.blocks)).not.toContain("price");
  });

  it("prints the price when the image is the offer", () => {
    const enforced = enforceArtPlan(
      plan({ adType: "promo_offer", blocks: [block(), priceBlock] }),
      context({ named: [product("Bella Nera")] }),
    );

    expect(
      enforced.blocks.find(({ role }) => role === "price")?.text,
    ).toBe("SAR 450");
  });

  it("prints the price when the request asked for one", () => {
    const enforced = enforceArtPlan(
      plan({
        adType: "product_hero",
        buyerAskedForPrice: true,
        blocks: [block(), priceBlock],
      }),
      context({ named: [product("Bella Nera")] }),
    );

    expect(roles(enforced.blocks)).toContain("price");
  });

  /**
   * The number in the picture is the number in the catalogue. A director that
   * rounds 450 to "SAR 499" is making the one kind of error this pipeline is
   * built not to make, and it is not caught by looking at the image.
   */
  it("substitutes the shop's own price for whatever the director wrote", () => {
    const enforced = enforceArtPlan(
      plan({
        adType: "promo_offer",
        blocks: [block(), block({ role: "price", text: "only $9.99!" })],
      }),
      context({ named: [product("Bella Nera", { price: 39.5, currency: "USD" })] }),
    );

    expect(enforced.blocks.find(({ role }) => role === "price")?.text).toBe(
      "USD 39.50",
    );
  });

  it("drops the price where two articles would share one tag", () => {
    const enforced = enforceArtPlan(
      plan({ adType: "promo_offer", blocks: [block(), priceBlock] }),
      context({
        named: [
          product("Bella Nera", { price: 450 }),
          product("Oud Royal", { price: 620 }),
        ],
      }),
    );

    expect(roles(enforced.blocks)).not.toContain("price");
  });

  it("drops the price where the shop never published one", () => {
    const enforced = enforceArtPlan(
      plan({ adType: "promo_offer", blocks: [block(), priceBlock] }),
      context({ named: [product("Bella Nera", { price: null, currency: null })] }),
    );

    expect(roles(enforced.blocks)).not.toContain("price");
  });

  it("writes a whole number without cents, and a fraction with them", () => {
    expect(priceText(product("a", { price: 450, currency: "SAR" }))).toBe("SAR 450");
    expect(priceText(product("b", { price: 39.5, currency: "USD" }))).toBe(
      "USD 39.50",
    );
    expect(priceText(product("c", { price: null }))).toBeNull();
  });
});

describe("the text list", () => {
  it("keeps the ad readable by cutting the least important lines", () => {
    const enforced = enforceArtPlan(
      plan({
        blocks: [
          block(),
          block({ role: "subheadline", text: "Made in Riyadh", sizePercent: 5 }),
          block({ role: "brand", text: "Nouvona", sizePercent: 3 }),
          block({ role: "cta", text: "Shop now", sizePercent: 3 }),
          block({ role: "badge", text: "New", sizePercent: 4 }),
          block({ role: "legal", text: "Terms apply", sizePercent: 1.5 }),
        ],
      }),
      context(),
    );

    expect(enforced.blocks).toHaveLength(TEXT_BLOCK_MAX);
    expect(roles(enforced.blocks)).toEqual([
      "headline",
      "brand",
      "subheadline",
      "cta",
      "badge",
    ]);
  });

  it("refuses a second headline, because a plan with two did not decide", () => {
    const enforced = enforceArtPlan(
      plan({ blocks: [block(), block({ text: "Or maybe this" })] }),
      context(),
    );

    expect(enforced.blocks).toHaveLength(1);
    expect(enforced.blocks[0].text).toBe("Carry it anywhere");
  });

  /**
   * Every block can be individually correct and the ad still broken: a
   * subheadline set as large as its headline is legible and wrong.
   */
  it("keeps the headline the largest thing on the canvas", () => {
    const enforced = enforceArtPlan(
      plan({
        blocks: [
          block({ sizePercent: 10 }),
          block({ role: "subheadline", text: "Made in Riyadh", sizePercent: 18 }),
        ],
      }),
      context(),
    );

    const headline = enforced.blocks.find(({ role }) => role === "headline")!;
    const sub = enforced.blocks.find(({ role }) => role === "subheadline")!;
    expect(sub.sizePercent).toBeLessThan(headline.sizePercent);
  });

  it("clamps a legal line that was asked for at headline size", () => {
    const enforced = enforceArtPlan(
      plan({
        blocks: [block(), block({ role: "legal", text: "Terms", sizePercent: 40 })],
      }),
      context(),
    );

    expect(
      enforced.blocks.find(({ role }) => role === "legal")!.sizePercent,
    ).toBeLessThanOrEqual(2.5);
  });

  it("still makes an advertisement when the director wrote no text at all", () => {
    const enforced = enforceArtPlan(plan({ blocks: [] }), context());

    expect(enforced.blocks).toHaveLength(1);
    expect(enforced.blocks[0].text).toBe("Nouvona");
  });
});

describe("choosing the subject", () => {
  it("lets the named Product settle it, whatever the director preferred", () => {
    const enforced = enforceArtPlan(
      plan({ heroProducts: ["Oud Royal"] }),
      context({
        named: [product("Bella Nera")],
        catalog: [product("Oud Royal")],
      }),
    );

    expect(enforced.heroProducts).toEqual(["Bella Nera"]);
  });

  it("lets the director choose when the request named nothing", () => {
    const enforced = enforceArtPlan(
      plan({ heroProducts: ["Oud Royal", "Bella Nera"] }),
      context({ catalog: [product("Oud Royal"), product("Bella Nera")] }),
    );

    expect(enforced.heroProducts).toEqual(["Oud Royal", "Bella Nera"]);
  });

  /** A name the catalogue does not hold is a product the shop does not sell. */
  it("drops a Product the director invented", () => {
    const enforced = enforceArtPlan(
      plan({ heroProducts: ["Noir Essence", "Oud Royal"] }),
      context({ catalog: [product("Oud Royal")] }),
    );

    expect(enforced.heroProducts).toEqual(["Oud Royal"]);
  });

  it("never lists the same Product twice, or in both roles", () => {
    const enforced = enforceArtPlan(
      plan({
        heroProducts: ["Oud Royal", "oud royal"],
        supportingProducts: ["Oud Royal"],
      }),
      context({ catalog: [product("Oud Royal")] }),
    );

    expect(enforced.heroProducts).toEqual(["Oud Royal"]);
    expect(enforced.supportingProducts).toEqual([]);
  });
});

describe("the direction", () => {
  /**
   * The reason `PHOTO_SAFE_DIRECTIONS` exists, reached from the other end: the
   * composer knows a photograph is actually going to be attached, so it can
   * insist where the Ad Run can only prefer.
   */
  it("moves a photographed article onto a direction that can show it", () => {
    const enforced = enforceArtPlan(
      plan({ direction: "retro_arcade" }),
      context({
        named: [product("WH80", { imageUrl: "https://cdn.example/wh80.png" })],
      }),
    );

    expect(enforced.direction).toBe("product_hero");
  });

  it("spreads several photographed articles rather than heroing one", () => {
    const enforced = enforceArtPlan(
      plan({ direction: "blueprint" }),
      context({
        named: [
          product("WH80", { imageUrl: "https://cdn.example/wh80.png" }),
          product("Halo75", { imageUrl: "https://cdn.example/halo.png" }),
        ],
      }),
    );

    expect(enforced.direction).toBe("editorial_spread");
  });

  /**
   * Capacity bounds what is attached, not what is advertised. Grok can be shown
   * nothing and can still carry three Products, named and described.
   */
  it("still advertises several articles to a model that takes no photograph", () => {
    const enforced = enforceArtPlan(
      plan(),
      context({
        photographCapacity: 0,
        named: [product("Bella Nera"), product("Oud Royal"), product("Rose")],
      }),
    );

    expect(enforced.heroProducts).toHaveLength(3);
  });

  it("leaves an abstract direction alone when no photograph travels", () => {
    const enforced = enforceArtPlan(
      plan({ direction: "retro_arcade" }),
      context({ named: [product("WH80")] }),
    );

    expect(enforced.direction).toBe("retro_arcade");
  });

  it("keeps people out unless the request asked for them", () => {
    expect(enforceArtPlan(plan({ adType: "lifestyle" }), context()).showsPeople).toBe(
      false,
    );
    expect(
      enforceArtPlan(plan({ buyerAskedForPeople: true }), context()).showsPeople,
    ).toBe(true);
  });
});

describe("the prompt", () => {
  const built = (extra: Partial<RawArtPlan> = {}, ctx = context()) =>
    buildDirectedPrompt({
      plan: enforceArtPlan(plan(extra), ctx),
      context: ctx,
      photographed: [],
      described: [],
      fidelity: "",
    });

  it("leaves the person's own words leading", () => {
    expect(built().startsWith("an ad for the new bottle")).toBe(true);
  });

  it("states the render list as the whole of what may appear", () => {
    const text = built();
    expect(text).toContain('1. "Carry it anywhere" — the headline');
    expect(text).toContain("render EXACTLY these 1 string and absolutely nothing else");
    expect(text).toContain("cap height about 14% of the image height");
    expect(text).toContain("bold weight");
    expect(text).toContain("the upper-left corner");
  });

  /**
   * The failure this module was written for: a price and a catalogue
   * description reaching the canvas because they reached the prompt as quoted
   * strings. They still travel — a model that does not know the tier of the
   * article lights it wrong — but they travel fenced.
   */
  it("carries the facts as knowledge, never as copy", () => {
    const ctx = context({ named: [product("Bella Nera")] });
    const text = buildDirectedPrompt({
      plan: enforceArtPlan(plan({ heroProducts: ["Bella Nera"] }), ctx),
      context: ctx,
      photographed: [],
      described: [product("Bella Nera")],
      fidelity: "",
    });

    expect(text).toContain("never render any of it as text");
    expect(text).toContain("Listed at SAR 450.");
    // The price is in the background block, and nowhere in the render list.
    expect(text.indexOf("Listed at SAR 450.")).toBeLessThan(
      text.indexOf("THE TEXT IN THIS IMAGE"),
    );
    expect(text).not.toContain('"SAR 450"');
  });

  it("says plainly when a picture carries no words at all", () => {
    const ctx = context();
    const text = buildDirectedPrompt({
      plan: { ...enforceArtPlan(plan(), ctx), blocks: [] },
      context: ctx,
      photographed: [],
      described: [],
      fidelity: "",
    });

    expect(text).toContain("Not one word, letter, number or logo");
  });

  /**
   * Last position is what an image model weighs most, and the article needs it:
   * a keyboard came back recoloured the moment anything outranked the rule
   * keeping it as photographed.
   */
  it("gives the closing position to the article", () => {
    const ctx = context();
    const text = buildDirectedPrompt({
      plan: enforceArtPlan(plan(), ctx),
      context: ctx,
      photographed: [],
      described: [],
      fidelity: "KEEP IT AS PHOTOGRAPHED.",
    });

    expect(text.trimEnd().endsWith("KEEP IT AS PHOTOGRAPHED.")).toBe(true);
  });
});

describe("when the director never answered", () => {
  it("keeps the named Products and adds nothing of its own", () => {
    const fallback = fallbackArtPlan(
      context({ named: [product("Bella Nera"), product("Oud Royal")] }),
    );

    expect(fallback.heroProducts).toEqual(["Bella Nera", "Oud Royal"]);
    expect(fallback.adType).toBe("multi_product");
    expect(fallback.scene).toBe("");
    expect(roles(fallback.blocks)).toEqual(["brand"]);
  });

  it("reaches for a photo-safe direction when a photograph will travel", () => {
    const fallback = fallbackArtPlan(
      context({
        named: [product("WH80", { imageUrl: "https://cdn.example/wh80.png" })],
      }),
    );

    expect(fallback.direction).toBe("product_hero");
  });
});
