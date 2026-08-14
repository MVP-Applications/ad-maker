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
  ...extra,
});

const answered = () => {
  expect(mocks.generateObject).toHaveBeenCalledTimes(1);
  const call = mocks.generateObject.mock.calls[0][0];
  return { system: call.system as string, prompt: call.prompt as string };
};

describe("the art director", () => {
  beforeEach(() => {
    mocks.generateObject.mockReset();
    mocks.generateObject.mockResolvedValue({
      object: {
        adType: "product_hero",
        direction: "product_hero",
        lighting: "split_light",
        lens: "portrait_85",
        composition: "thirds_right",
        surface: "wet_black_marble",
        finish: "portra_warm",
        copyAngle: "understatement",
        rationale: "A physical article deserves a hero shot.",
        audienceNote: "Gift buyers.",
        heroProducts: ["Oud Royal"],
        supportingProducts: [],
        scene: "One bottle on a seamless backdrop.",
        buyerAskedForPeople: false,
        buyerAskedForPrice: false,
        palette: { background: "deep navy", ink: "warm gold", accent: "warm gold" },
        typeface: "Inter",
        layout: "poster_stack",
        blocks: [
          {
            role: "headline",
            text: "Wear the night",
            sizePercent: 14,
            weight: "bold",
            case: "as_written",
            placement: "top_left",
          },
        ],
      },
    });
  });

  it("returns the plan, corrected by the rules it may not break", async () => {
    const plan = await directArtwork(
      context({ catalog: [product("Oud Royal")] }),
    );

    expect(plan.adType).toBe("product_hero");
    expect(plan.heroProducts).toEqual(["Oud Royal"]);
    expect(plan.blocks).toHaveLength(1);
  });

  it("is told what a good advertisement is, and when a price belongs on one", async () => {
    await directArtwork(context());

    const { system } = answered();
    expect(system).toContain("PRICE IS A DECISION, AND THE DEFAULT IS NO.");
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
      }),
    );

    const { prompt } = answered();
    expect(prompt).toContain("an ad for our bestsellers");
    expect(prompt).toContain("WHO BUYS: Women in the Gulf buying gifts.");
    expect(prompt).toContain('- "Bella Nera"');
    expect(prompt).toContain("[price on file: SAR 450]");
    expect(prompt).toContain("[photograph available]");
    expect(prompt).toContain('- "Oud Royal"');
    expect(prompt).toContain("[no price on file]");
    // Every direction it may choose, with the rules that bound each one.
    expect(prompt).toContain("product_hero (Product Hero) — best for:");
    expect(prompt).toContain("retro_arcade (Retro Arcade) — best for:");
  });

  /**
   * The craft menu is the reason the library can be this large: keys and names
   * only, so a hundred and thirty-two moves cost a line each rather than a
   * paragraph each, and the prose is spliced in after the answer comes back.
   */
  it("is offered every craft axis by name, and charged for none of the prose", async () => {
    await directArtwork(context());

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
    const plan = await directArtwork(context());

    expect(plan.craft).toEqual({
      lighting: "split_light",
      lens: "portrait_85",
      composition: "thirds_right",
      surface: "wet_black_marble",
      finish: "portra_warm",
      copyAngle: "understatement",
    });
  });

  it("never shows the same Product twice when the buyer named it", async () => {
    await directArtwork(
      context({ named: [product("Oud Royal")], catalog: [product("Oud Royal")] }),
    );

    const { prompt } = answered();
    expect(prompt.match(/- "Oud Royal"/g)).toHaveLength(1);
  });

  /** A director that cannot answer costs the image its art direction, not the image. */
  it("falls back rather than fail when the call does not come back", async () => {
    mocks.generateObject.mockRejectedValue(new Error("gateway down"));

    const plan = await directArtwork(
      context({ named: [product("Bella Nera")] }),
    );

    expect(plan.heroProducts).toEqual(["Bella Nera"]);
    expect(plan.rationale).toContain("art director was unavailable");
  });

  it("lets an abort through, because a cancelled run wants no picture", async () => {
    const controller = new AbortController();
    controller.abort();
    mocks.generateObject.mockRejectedValue(new Error("aborted"));

    await expect(
      directArtwork(context(), controller.signal),
    ).rejects.toThrow("aborted");
  });
});
