import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateObject: vi.fn() }));

vi.mock("ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("ai")>();
  return { ...original, generateObject: mocks.generateObject };
});

import type { LanguageModel } from "ai";
import { advertised, type AdBrief, type PlannedConcept, type Product } from "@/lib/ad-run";
import { isPhotoSafe } from "./directions";
import { imageModelById, takesProductPhoto } from "./models";
import { deriveSummaryFromMarkdown, pickConceptsAndCraftCopy } from "./brief";

const brief: AdBrief = {
  domain: "stripe.com",
  brandName: "Stripe",
  description: "Financial infrastructure for the internet.",
  headline: "Payments infrastructure for the internet.",
  industry: "Technology · Payments",
  summary: "Stripe helps businesses accept payments and grow revenue.",
  mood: "bold, precise, optimistic",
  fontFamily: "Inter",
  colorA: "rich indigo",
  colorB: "deep navy",
  logoUrl: null,
  heroImageUrl: null,
  languages: ["en"],
  colors: [{ hex: "#635bff", name: "Purple" }],
  market: null,
};

const PRODUCTS: readonly Product[] = [
  {
    name: "Payment Links",
    description: "Create a payment page and share its link with customers.",
    imageUrl: null,
    price: null,
    currency: null,
    url: null,
    flagship: true,
  },
  {
    name: "Stripe Billing",
    description: "Manage subscriptions, invoices, and recurring revenue.",
    imageUrl: null,
    price: null,
    currency: null,
    url: null,
    flagship: true,
  },
  {
    name: "Stripe Checkout",
    description: "Use a prebuilt payment form for online purchases.",
    imageUrl: null,
    price: null,
    currency: null,
    url: null,
    flagship: true,
  },
];

const model = {} as LanguageModel;

describe("Brief concept planning", () => {
  beforeEach(() => {
    mocks.generateObject.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  describe("Products that have a photograph", () => {
    const photographed = (indexes: number[]): Product[] =>
      PRODUCTS.map((product, index) => ({
        ...product,
        imageUrl: indexes.includes(index)
          ? `https://cdn.example/${index}.png`
          : null,
      }));
    const productSlots = (concepts: readonly PlannedConcept[]) => concepts.slice(3);

    // Run repeatedly: model assignment shuffles, so a single pass can pass by luck.
    const runs = Array.from({ length: 12 }, (_, i) => i);

    it.each(runs)("spends the image-capable models on them (run %i)", async () => {
      mocks.generateObject.mockRejectedValue(new Error("planner unavailable"));

      const concepts = await pickConceptsAndCraftCopy(
        model,
        brief,
        photographed([1]),
        "",
      );

      // Only two of three Product-slot models accept a reference, so the one
      // Product with a photo must get one of them rather than lose the draw.
      const withPhoto = productSlots(concepts).find(
        ({ subject }) => subject.kind === "product" && subject.imageUrl !== null,
      );
      expect(takesProductPhoto(imageModelById(withPhoto!.model)!)).toBe(true);
    });

    it.each(runs)("steers them onto a direction that can show it (run %i)", async () => {
      mocks.generateObject.mockRejectedValue(new Error("planner unavailable"));

      const concepts = await pickConceptsAndCraftCopy(
        model,
        brief,
        photographed([0, 1]),
        "",
      );

      for (const concept of productSlots(concepts)) {
        if (concept.subject.kind !== "product" || !concept.subject.imageUrl) continue;
        if (!takesProductPhoto(imageModelById(concept.model)!)) continue;
        // monochrome_crop, blueprint and friends re-invent their subject; a real
        // photograph handed to one produces neither a faithful product nor art.
        expect(isPhotoSafe(concept.key)).toBe(true);
      }
      expect(new Set(concepts.map(({ key }) => key)).size).toBe(concepts.length);
    });

    // The picture is written for the direction the planner chose. Steering a
    // slot onto a different one leaves that picture describing the direction it
    // just gave up — an arcade grid does not become a hero shot because the
    // label changed — so it is dropped and the new direction's paragraph stands.
    it("drops a written picture from any slot whose direction it moved", async () => {
      mocks.generateObject.mockResolvedValue({
        object: {
          companyPicks: ["macro_texture", "flat_lay_knolling", "kinetic"].map(
            (concept) => ({
              concept,
              headline: "One two three",
              subheadline: "A supporting line for this concept",
              showsPeople: false,
              scene: `A picture written for ${concept}.`,
            }),
          ),
          productPicks: ["elemental_material", "set_design_maximalism"].map((concept) => ({
            concept,
            headline: "One two three",
            subheadline: "A supporting line for this concept",
            showsPeople: false,
            scene: `A picture written for ${concept}.`,
          })),
        },
      });

      const concepts = await pickConceptsAndCraftCopy(
        model,
        brief,
        photographed([0, 1]),
        "",
      );

      for (const concept of concepts) {
        if (!concept.scene) continue;
        // A picture that survived must still name the direction it was written
        // for; anything moved lost its picture rather than kept a wrong one.
        expect(concept.scene).toBe(`A picture written for ${concept.key}.`);
      }
    });

    it("leaves a Product with no photograph on any direction", async () => {
      mocks.generateObject.mockRejectedValue(new Error("planner unavailable"));

      const concepts = await pickConceptsAndCraftCopy(
        model,
        brief,
        photographed([]),
        "",
      );

      expect(concepts).toHaveLength(3 + PRODUCTS.length);
      expect(new Set(concepts.map(({ key }) => key)).size).toBe(concepts.length);
    });
  });

  it.each([1, 2, 3] as const)(
    "falls back to three Company concepts plus %i grounded Product concept(s)",
    async (productCount) => {
      mocks.generateObject.mockRejectedValue(new Error("Gateway unavailable"));
      const products = PRODUCTS.slice(0, productCount);

      const concepts = await pickConceptsAndCraftCopy(model, brief, products, "");

      expect(concepts).toHaveLength(3 + productCount);
      expect(new Set(concepts.map(({ key }) => key)).size).toBe(
        concepts.length,
      );
      expect(new Set(concepts.map(({ model: id }) => id)).size).toBe(
        concepts.length,
      );
      expect(concepts.slice(0, 3).map(({ subject }) => subject)).toEqual([
        { kind: "company" },
        { kind: "company" },
        { kind: "company" },
      ]);
      expect(
        concepts
          .slice(0, 3)
          .every(({ model: id }) => imageModelById(id)?.tier === "primary"),
      ).toBe(true);

      const productConcepts = concepts.slice(3);
      expect(productConcepts.map(({ subject }) => subject)).toEqual(
        products.map((product) => ({ kind: "product", ...advertised(product) })),
      );
      expect(
        productConcepts.every(
          ({ model: id }) => imageModelById(id)?.tier === "secondary",
        ),
      ).toBe(true);
      expect(productConcepts.map(({ headline }) => headline)).toEqual(
        products.map(({ name }) => name),
      );
    },
  );

  it("maps generated Product copy by input order, clamps it, and pads duplicate directions", async () => {
    mocks.generateObject.mockResolvedValue({
      object: {
        companyPicks: [
          {
            concept: "graphic_poster",
            headline: "One two three four five",
            subheadline:
              "one two three four five six seven eight nine ten eleven twelve thirteen",
          },
          {
            concept: "graphic_poster",
            headline: "Duplicate",
            subheadline: "This duplicate direction must be discarded",
          },
          {
            concept: "interior_vignette",
            headline: "Built to grow",
            subheadline: "Financial infrastructure for ambitious teams",
          },
        ],
        productPicks: [
          {
            concept: "interior_vignette",
            headline: "Duplicate product direction",
            subheadline: "This conflicts with a company direction",
          },
          {
            concept: "macro_texture",
            headline: "Automate every recurring invoice today",
            subheadline:
              "one two three four five six seven eight nine ten eleven twelve thirteen",
          },
        ],
      },
    });

    const products = PRODUCTS.slice(0, 2);
    const concepts = await pickConceptsAndCraftCopy(model, brief, products, "");

    expect(concepts).toHaveLength(5);
    expect(new Set(concepts.map(({ key }) => key)).size).toBe(5);
    expect(concepts.slice(0, 3).every(({ subject }) => subject.kind === "company"))
      .toBe(true);
    expect(concepts.slice(3).map(({ subject }) => subject)).toEqual(
      products.map((product) => ({ kind: "product", ...advertised(product) })),
    );

    const generatedCompany = concepts.find(({ key }) => key === "graphic_poster");
    expect(generatedCompany?.headline).toBe("One two three");
    expect(generatedCompany?.subheadline.split(/\s+/)).toHaveLength(12);
    expect(concepts.filter(({ key }) => key === "graphic_poster")).toHaveLength(1);

    const fallbackProduct = concepts[3];
    expect(fallbackProduct.subject).toEqual({
      kind: "product",
      ...advertised(products[0]),
    });
    expect(fallbackProduct.headline).toBe("Payment Links");

    const generatedProduct = concepts[4];
    expect(generatedProduct).toMatchObject({
      key: "macro_texture",
      subject: { kind: "product", ...advertised(products[1]) },
      headline: "Automate every recurring",
    });
    expect(generatedProduct.subheadline.split(/\s+/)).toHaveLength(12);

    const request = mocks.generateObject.mock.calls[0][0] as {
      prompt: string;
      system: string;
    };
    expect(request.system).toContain("exactly 2 product picks");
    expect(request.prompt).toContain(
      `1. ${products[0].name} — ${products[0].description}`,
    );
    expect(request.prompt).toContain(
      `2. ${products[1].name} — ${products[1].description}`,
    );
  });

  it.each([
    [[] as Product[]],
    [
      [
        ...PRODUCTS,
        {
          name: "Stripe Tax",
          description: "Automate sales tax calculations and collection.",
          imageUrl: null,
          price: null,
          currency: null,
          url: null,
          flagship: true,
        },
      ] as Product[],
    ],
  ])("rejects a Product count outside the 1-3 contract", async (products) => {
    await expect(
      pickConceptsAndCraftCopy(model, brief, products, ""),
    ).rejects.toThrow("Concept planning requires 1-3 Products");
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it("derives prose while dropping headings, links, calls to action, and stats", () => {
    const markdown = [
      "# Stripe",
      "[Products](/products)",
      "Get started",
      "Stripe helps businesses accept payments around the world.",
      "Revenue grew 40% last year.",
      "Teams can launch new financial products without rebuilding infrastructure.",
    ].join("\n");

    expect(deriveSummaryFromMarkdown(markdown)).toBe(
      "Stripe helps businesses accept payments around the world. Teams can launch new financial products without rebuilding infrastructure.",
    );
  });
});
