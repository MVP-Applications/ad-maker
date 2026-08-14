import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateObject: vi.fn() }));

vi.mock("ai", () => ({ generateObject: mocks.generateObject }));
vi.mock("./gateway", () => ({ gatewayTextModel: (id: string) => id }));

import type { ArtContext, CatalogProduct } from "./art-plan";
import { directArtwork } from "./director";

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
  request: "an ad for our bestsellers",
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
  avoid: [],
  ...extra,
});

type Part =
  | { type: "text"; text: string }
  | { type: "image"; image: Uint8Array; mediaType: string };

/**
 * The brief travels as one user message now, because a photograph cannot ride
 * in the same field as a string. `prompt` is every text part of it joined back
 * together; `images` is what the director was actually shown.
 */
const answered = () => {
  expect(mocks.generateObject).toHaveBeenCalledTimes(1);
  const call = mocks.generateObject.mock.calls[0][0];
  const parts = call.messages[0].content as Part[];
  return {
    system: call.system as string,
    prompt: parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("\n"),
    images: parts.flatMap((part) => (part.type === "image" ? [part] : [])),
  };
};

const seen = (name: string, byte: number) => ({
  name,
  bytes: Uint8Array.from([byte]),
  mediaType: "image/png",
});

describe("the art director", () => {
  beforeEach(() => {
    mocks.generateObject.mockReset();
    mocks.generateObject.mockResolvedValue({
      object: { concepts: Array.from({ length: 6 }, () => concept()) },
    });
  });

  const concept = () => ({
        adType: "product_hero" as const,
        direction: "sculptural_hero",
        lighting: "split_light",
        lens: "portrait_85",
        composition: "thirds_right",
        surface: "wet_black_marble",
        finish: "portra_warm",
        copyAngle: "understatement",
        paletteStrategy: "article_led",
        conceptName: "Bottle mid-pour",
        idea: "The pour is frozen where nobody expects it.",
        prominence: "hero",
        state: "caught mid-pour",
        set: "a cracked slab of desert clay",
        supportingCast: "",
        moodReference: "1970s Italian magazine spread",
        rationale: "A physical article deserves a hero shot.",
        audienceNote: "Gift buyers.",
        heroProducts: ["Oud Royal"],
        supportingProducts: [],
        buyerAskedForPeople: false,
        buyerAskedForPrice: false,
        palette: { background: "deep navy", ink: "warm gold", accent: "warm gold" },
        typeface: "Inter",
        layout: "poster_stack",
        blocks: [
          {
            role: "headline" as const,
            text: "Wear the night",
            sizePercent: 14,
            weight: "bold" as const,
            case: "as_written" as const,
            placement: "top_left" as const,
          },
        ],
  });

  it("returns the plan, corrected by the rules it may not break", async () => {
    const [plan] = await directArtwork(
      context({ catalog: [product("Oud Royal")] }), []);

    expect(plan.adType).toBe("product_hero");
    expect(plan.heroProducts).toEqual(["Oud Royal"]);
    expect(plan.blocks).toHaveLength(1);
  });

  it("is told what a good advertisement is, and when a price belongs on one", async () => {
    await directArtwork(context(), []);

    const { system } = answered();
    expect(system).toContain("PRICE IS A GRAMMAR SETTING, NOT A CAPTION.");
    expect(system).toContain("ONE IDEA.");
    expect(system).toContain("NEVER SET FACTS AS COPY.");
    // The shop's own language, so an Arabic house is not advertised in English.
    expect(system).toContain("WRITE THE COPY IN THE SHOP'S OWN LANGUAGE (ar)");
  });

  it("is shown the shop it is choosing from, prices and photographs included", async () => {
    await directArtwork(
      context({
        named: [product("Bella Nera", { imageUrl: "https://cdn.example/n.png" })],
        catalog: [product("Oud Royal", { price: null, currency: null })],
      }), []);

    const { prompt } = answered();
    expect(prompt).toContain("an ad for our bestsellers");
    expect(prompt).toContain("WHO BUYS: Women in the Gulf buying gifts.");
    expect(prompt).toContain('- "Bella Nera"');
    expect(prompt).toContain("[price on file: SAR 450]");
    expect(prompt).toContain("[photograph available]");
    expect(prompt).toContain('- "Oud Royal"');
    expect(prompt).toContain("[no price on file]");
    // Every direction it may choose, with the rules that bound each one.
    expect(prompt).toContain("sculptural_hero (Sculptural Hero) — reads:");
    expect(prompt).toContain("elemental_material (Elemental / Material) — reads:");
  });

  /**
   * The craft menu is the reason the library can be this large: keys and names
   * only, so a hundred and thirty-two moves cost a line each rather than a
   * paragraph each, and the prose is spliced in after the answer comes back.
   */
  it("is offered every craft axis by name, and charged for none of the prose", async () => {
    await directArtwork(context(), []);

    const { prompt } = answered();
    expect(prompt).toContain("LIGHTING: rembrandt (Rembrandt key)");
    expect(prompt).toContain("LENS: portrait_85 (85mm portrait)");
    expect(prompt).toContain("COMPOSITION: thirds_right");
    expect(prompt).toContain("SURFACE: seamless_paper");
    expect(prompt).toContain("FINISH: portra_warm");
    expect(prompt).toContain("COPY ANGLE");
    expect(prompt).not.toContain("One hard key light 45 degrees off-axis");
  });

  it("returns the craft it chose, ready to splice", async () => {
    const [plan] = await directArtwork(context(), []);

    expect(plan.craft).toEqual({
      lighting: "split_light",
      lens: "portrait_85",
      composition: "thirds_right",
      surface: "wet_black_marble",
      finish: "portra_warm",
      palette: "article_led",
      copyAngle: "understatement",
    });
  });

  it("never shows the same Product twice when the buyer named it", async () => {
    await directArtwork(
      context({ named: [product("Oud Royal")], catalog: [product("Oud Royal")] }), []);

    const { prompt } = answered();
    expect(prompt.match(/- "Oud Royal"/g)).toHaveLength(1);
  });

  /**
   * The fix for a bottle of amber glass coming back in the brand's teal. The
   * director could not have known better from a name and a catalogue sentence;
   * now it is shown the article.
   */
  describe("looking at the article", () => {
    it("is handed each photograph, announced by the name it belongs to", async () => {
      await directArtwork(context(), [
        seen("Bella Nera", 1),
        seen("Oud Royal", 2),
      ]);

      const { system, prompt, images } = answered();
      expect(images).toHaveLength(2);
      expect(images[0].image).toEqual(Uint8Array.from([1]));
      // Named immediately before its own picture, never paired by list order.
      expect(prompt).toContain('This is "Bella Nera":');
      expect(prompt).toContain('This is "Oud Royal":');
      expect(system).toContain("YOU CAN SEE THE ARTICLES");
      expect(system).toContain("NEVER describe an article in the brand's palette");
    });

    it("says none of that when the shop published no photograph", async () => {
      await directArtwork(context(), []);

      const { system, images } = answered();
      expect(images).toEqual([]);
      expect(system).not.toContain("YOU CAN SEE THE ARTICLES");
    });

    it("carries the appearance it read back into the plan", async () => {
      mocks.generateObject.mockResolvedValue({
        object: { concepts: [{
          ...concept(),
          adType: "product_hero" as const,
          direction: "sculptural_hero",
          lighting: null,
          lens: null,
          composition: null,
          surface: null,
          finish: null,
          copyAngle: null,
          paletteStrategy: null,
          conceptName: "",
          idea: "",
          prominence: "hero",
          state: "",
          set: "",
          supportingCast: "",
          moodReference: "",
          rationale: "",
          audienceNote: "",
          heroProducts: ["Oud Royal"],
          supportingProducts: [],
          articles: [
            {
              name: "Oud Royal",
              appearance: "amber glass with a brushed gold cap and a cream label",
            },
          ],
          buyerAskedForPeople: false,
          buyerAskedForPrice: false,
          palette: { background: "slate", ink: "cream", accent: "gold" },
          typeface: "Inter",
          layout: "poster_stack",
          blocks: [],
        }] },
      });

      const [plan] = await directArtwork(
        context({ named: [product("Oud Royal")] }),
        [seen("Oud Royal", 1)],
      );

      expect(plan.articles).toEqual([
        {
          name: "Oud Royal",
          appearance: "amber glass with a brushed gold cap and a cream label",
        },
      ]);
    });
  });

  /**
   * One call per image and no memory between them meant the same request
   * reasoned about twice produced the same picture twice. The session is the
   * only thing that can tell it otherwise.
   */
  describe("not repeating itself", () => {
    it("is told what this session already made", async () => {
      await directArtwork(
        context({
          avoid: [
            {
              direction: "sculptural_hero",
              lighting: "rembrandt",
              surface: "seamless_paper",
              finish: null,
            },
          ],
        }),
        [],
      );

      const { system } = answered();
      expect(system).toContain("ALREADY MADE IN THIS SESSION");
      expect(system).toContain(
        "1. direction sculptural_hero, lighting rembrandt, surface seamless_paper",
      );
      expect(system).toContain("differ from every one below on the direction");
    });

    it("says nothing about it on the first image of a session", async () => {
      await directArtwork(context(), []);

      expect(answered().system).not.toContain("ALREADY MADE IN THIS SESSION");
    });
  });

  /** A director that cannot answer costs the image its art direction, not the image. */
  it("falls back rather than fail when the call does not come back", async () => {
    mocks.generateObject.mockRejectedValue(new Error("gateway down"));

    const [plan] = await directArtwork(
      context({ named: [product("Bella Nera")] }), []);

    expect(plan.heroProducts).toEqual(["Bella Nera"]);
    expect(plan.rationale).toContain("art director was unavailable");
  });

  it("lets an abort through, because a cancelled run wants no picture", async () => {
    const controller = new AbortController();
    controller.abort();
    mocks.generateObject.mockRejectedValue(new Error("aborted"));

    await expect(
      directArtwork(context(), [], controller.signal),
    ).rejects.toThrow("aborted");
  });
});
