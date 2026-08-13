import { describe, expect, it, vi } from "vitest";
import {
  AD_RUN_LIMITS,
  type AdBrief,
  type AdRunBrief,
  type PlannedConcept,
  type Product,
} from "@/lib/ad-run";
import {
  BrandExtractorError,
  type BrandProfile,
  type BrandResearch,
  type StyleguideProfile,
} from "@/lib/context";
import {
  createBriefResearcher,
  createConceptPlanner,
  type AdRunPlannerAdapters,
} from "./planner";

const PRODUCTS: Product[] = [
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

/** A Concept subject carries only what an ad may show, never a price or a URL. */
const subjectOf = (product: Product) => ({
  kind: "product" as const,
  name: product.name,
  description: product.description,
  imageUrl: product.imageUrl,
});

const CONCEPTS: readonly PlannedConcept[] = [
  {
    key: "product_hero",
    model: "openai/gpt-image-1.5",
    subject: { kind: "company" },
    headline: "Move Faster",
    subheadline: "Payments built for internet businesses",
    instruction: "",
    showsPeople: false,
    scene: "",
  },
  {
    key: "isometric",
    model: "fal/xai/grok-imagine-image",
    subject: { kind: "company" },
    headline: "Build Boldly",
    subheadline: "A financial platform for ambitious teams",
    instruction: "",
    showsPeople: false,
    scene: "",
  },
  {
    key: "typographic",
    model: "fal/fal-ai/imagen4/preview/ultra",
    subject: { kind: "company" },
    headline: "Own Tomorrow",
    subheadline: "Tools that make online commerce simple",
    instruction: "",
    showsPeople: false,
    scene: "",
  },
  {
    key: "macro_material",
    model: "openai/gpt-image-2",
    subject: subjectOf(PRODUCTS[0]),
    headline: "Share. Sell. Done.",
    subheadline: "Launch a payment page from one simple link",
    instruction: "",
    showsPeople: false,
    scene: "",
  },
  {
    key: "gradient_field",
    model: "fal/fal-ai/nano-banana-pro",
    subject: subjectOf(PRODUCTS[1]),
    headline: "Billing That Grows",
    subheadline: "Subscriptions and invoices built to scale",
    instruction: "",
    showsPeople: false,
    scene: "",
  },
  {
    key: "editorial_spread",
    model: "fal/fal-ai/bytedance/seedream/v4.5/text-to-image",
    subject: subjectOf(PRODUCTS[2]),
    headline: "Checkout, Simplified",
    subheadline: "A prebuilt payment form customers recognize",
    instruction: "",
    showsPeople: false,
    scene: "",
  },
];

const BRAND: BrandProfile = {
  domain: "stripe.com",
  name: "Stripe",
  description: "Financial infrastructure for the internet.",
  slogan: "Grow your revenue",
  industry: "Technology · Payments",
  logoUrl: "https://cdn.stripe.com/logo.png",
  heroImageUrl: null,
};

const STYLEGUIDE: StyleguideProfile = {
  mood: "bold, precise, optimistic",
  colors: [
    { hex: "#635bff", name: "Blurple" },
    { hex: "#0a2540", name: "Navy" },
  ],
  fontFamily: "Inter",
};

const RESEARCH: BrandResearch = {
  brand: BRAND,
  styleguide: STYLEGUIDE,
  summary: "Stripe helps businesses accept online payments around the world.",
  languages: ["en", "fr"],
  products: PRODUCTS,
};

/** The Brief the researcher builds from RESEARCH, stated rather than derived. */
const BRIEF: AdBrief = {
  domain: "stripe.com",
  brandName: "Stripe",
  description: "Financial infrastructure for the internet.",
  headline: "Grow your revenue",
  industry: "Technology · Payments",
  summary: "Stripe helps businesses accept online payments around the world.",
  mood: "bold, precise, optimistic",
  fontFamily: "Inter",
  colorA: "rich indigo",
  colorB: "deep navy",
  logoUrl: "https://cdn.stripe.com/logo.png",
  heroImageUrl: null,
  languages: ["en", "fr"],
  colors: [
    { hex: "#635bff", name: "Blurple" },
    { hex: "#0a2540", name: "Navy" },
  ],
};

const AD_RUN_BRIEF: AdRunBrief = { brief: BRIEF, products: PRODUCTS };

/** One research call now carries what four used to, so overrides patch it. */
const researching = (overrides: Partial<BrandResearch> = {}) =>
  vi.fn(async () => ({ ...RESEARCH, ...overrides }));

type FlatTestAdapters = {
  hasContextConfiguration: () => boolean;
  hasGenerationConfiguration: () => boolean;
  doResearch: AdRunPlannerAdapters["research"]["research"];
  planConcepts: AdRunPlannerAdapters["concepts"]["planConcepts"];
};

function adapters(overrides: Partial<FlatTestAdapters> = {}) {
  const flat: FlatTestAdapters = {
    hasContextConfiguration: vi.fn(() => true),
    hasGenerationConfiguration: vi.fn(() => true),
    doResearch: researching(),
    planConcepts: vi.fn(async () => CONCEPTS),
    ...overrides,
  };
  return {
    research: {
      isReady: flat.hasContextConfiguration,
      research: flat.doResearch,
    },
    concepts: {
      isReady: flat.hasGenerationConfiguration,
      planConcepts: flat.planConcepts,
    },
    ...flat,
  } satisfies AdRunPlannerAdapters & FlatTestAdapters;
}

describe("createBriefResearcher", () => {
  it("normalizes the domain and returns a contract-validated Brief", async () => {
    const deps = adapters();
    const result = await createBriefResearcher(deps)(
      "https://www.Stripe.com/pricing",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.brief).toMatchObject({
      domain: "stripe.com",
      brandName: "Stripe",
      industry: "Technology · Payments",
      mood: "bold, precise, optimistic",
      fontFamily: "Inter",
      colorA: "rich indigo",
      colorB: "deep navy",
    });
    expect(result.value.brief.summary).toContain("accept online payments");
    expect(result.value.products).toEqual(PRODUCTS);
    expect(deps.doResearch).toHaveBeenCalledWith("stripe.com", undefined);
  });

  // Planning follows a choice made against the Brief, so it cannot run here.
  it("never plans concepts", async () => {
    const deps = adapters();
    await createBriefResearcher(deps)("stripe.com");

    expect(deps.planConcepts).not.toHaveBeenCalled();
  });

  it("bounds the flat Brief before serving it", async () => {
    const deps = adapters({
      doResearch: researching({
        brand: {
          ...BRAND,
          name: ` Stripe ${"x".repeat(100)}`,
          description: ` ${"d".repeat(2200)}`,
          industry: ` ${"i".repeat(150)}`,
          logoUrl: `https://example.com/${"x".repeat(2100)}`,
        },
        styleguide: {
          mood: ` ${"m".repeat(200)}`,
          colors: Array.from({ length: 10 }, (_, index) => ({
            hex: index % 2 ? "#635bff" : "#0a2540",
            name: "n".repeat(100),
          })),
          fontFamily: "f".repeat(101),
        },
      }),
    });

    const result = await createBriefResearcher(deps)("stripe.com");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.brief.brandName).toHaveLength(80);
    expect(result.value.brief.description).toHaveLength(2000);
    expect(result.value.brief.industry).toHaveLength(120);
    expect(result.value.brief.mood).toHaveLength(160);
    expect(result.value.brief.logoUrl).toBeNull();
    expect(result.value.brief.fontFamily).toBeNull();
    expect(result.value.brief.colors).toHaveLength(8);
    expect(result.value.brief.colors[0].name).toHaveLength(80);
  });

  it("serves an empty summary when the extract carries no page copy", async () => {
    const deps = adapters({ doResearch: researching({ summary: "" }) });

    const result = await createBriefResearcher(deps)("stripe.com");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.brief.summary).toBe("");
  });

  it("uses palette and typography defaults when the extract states no styleguide", async () => {
    const deps = adapters({
      doResearch: researching({
        styleguide: { mood: "", colors: [], fontFamily: null },
      }),
    });

    const result = await createBriefResearcher(deps)("stripe.com");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.brief.mood).toBe("modern, confident, premium");
    expect(result.value.brief.colors).toEqual([]);
    expect(result.value.brief.fontFamily).toBeNull();
    expect(result.value.brief.colorA).toBe("vivid violet");
    expect(result.value.brief.colorB).toBe("deep navy");
  });

  it("uses the default mood when enrichment returns an empty value", async () => {
    const result = await createBriefResearcher(
      adapters({
        doResearch: researching({ styleguide: { ...STYLEGUIDE, mood: "   " } }),
      }),
    )("stripe.com");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.brief.mood).toBe("modern, confident, premium");
  });

  // The catalog is what a person chooses from, so it is carried whole rather
  // than cut to the number of Product slots an Ad Run happens to have.
  it("carries a catalog longer than one Ad Run can advertise", async () => {
    const catalog: Product[] = Array.from({ length: 8 }, (_, index) => ({
      name: `Product ${index + 1}`,
      description: `Description for product number ${index + 1}.`,
      imageUrl: null,
      price: 10 + index,
      currency: "USD",
      url: null,
      flagship: index < 3,
    }));
    const deps = adapters({ doResearch: researching({ products: catalog }) });

    const result = await createBriefResearcher(deps)("stripe.com");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.products).toEqual(catalog);
    expect(result.value.products.filter(({ flagship }) => flagship)).toHaveLength(3);
  });

  // The research service reports why it could not answer, and each reason
  // reaches the user as a different message. A site we cannot read is not a
  // service that is down, and neither is a site with nothing to advertise.
  it.each([
    ["no-extract", "domain-unreachable"],
    ["no-products", "products-unavailable"],
    ["malformed", "brand-unavailable"],
    ["unreachable", "not-configured"],
  ] as const)("maps a %s research failure to %s", async (kind, code) => {
    const failure = new BrandExtractorError(kind, "research failed");
    const deps = adapters({
      doResearch: vi.fn(async () => {
        throw failure;
      }),
    });

    const result = await createBriefResearcher(deps)("stripe.com");

    expect(result).toMatchObject({ ok: false, error: { code } });
  });

  it("treats an unrecognized research failure as internal", async () => {
    const failure = new Error("something else entirely");
    const deps = adapters({
      doResearch: vi.fn(async () => {
        throw failure;
      }),
    });

    expect(await createBriefResearcher(deps)("stripe.com")).toEqual({
      ok: false,
      error: { code: "internal", cause: failure },
    });
  });

  it("returns invalid-domain without checking readiness or doing I/O", async () => {
    const deps = adapters();
    const result = await createBriefResearcher(deps)("localhost");

    expect(result).toEqual({ ok: false, error: { code: "invalid-domain" } });
    expect(deps.hasContextConfiguration).not.toHaveBeenCalled();
    expect(deps.hasGenerationConfiguration).not.toHaveBeenCalled();
    expect(deps.doResearch).not.toHaveBeenCalled();
  });

  // A Brief nobody can turn into ads is not worth the extract that produced it,
  // so generation readiness is still checked before any research runs.
  it.each([
    [false, true],
    [true, false],
    [false, false],
  ])(
    "short-circuits all external work when readiness is context=%s generation=%s",
    async (contextReady, generationReady) => {
      const deps = adapters({
        hasContextConfiguration: vi.fn(() => contextReady),
        hasGenerationConfiguration: vi.fn(() => generationReady),
      });

      const result = await createBriefResearcher(deps)("stripe.com");

      expect(result).toEqual({ ok: false, error: { code: "not-configured" } });
      expect(deps.hasContextConfiguration).toHaveBeenCalledOnce();
      expect(deps.hasGenerationConfiguration).toHaveBeenCalledOnce();
      expect(deps.doResearch).not.toHaveBeenCalled();
    },
  );

  it("propagates cancellation raised during research", async () => {
    const controller = new AbortController();
    const deps = adapters({
      doResearch: vi.fn(async (_domain, signal) => {
        expect(signal).toBe(controller.signal);
        controller.abort();
        return RESEARCH;
      }),
    });

    const result = await createBriefResearcher(deps)(
      "stripe.com",
      controller.signal,
    );

    expect(result).toEqual({ ok: false, error: { code: "aborted" } });
    expect(deps.doResearch).toHaveBeenCalledWith("stripe.com", controller.signal);
  });
});

describe("createConceptPlanner", () => {
  it("plans a contract-validated Ad Run from a Brief", async () => {
    const deps = adapters();
    const result = await createConceptPlanner(deps)(AD_RUN_BRIEF);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.brief).toEqual(BRIEF);
    expect(result.value.concepts).toEqual(CONCEPTS);
    expect(
      result.value.concepts.slice(0, 3).map(({ subject }) => subject),
    ).toEqual([{ kind: "company" }, { kind: "company" }, { kind: "company" }]);
    expect(result.value.concepts.slice(3).map(({ subject }) => subject)).toEqual(
      PRODUCTS.map(subjectOf),
    );
    expect(deps.planConcepts).toHaveBeenCalledWith(BRIEF, PRODUCTS, "", undefined);
  });

  // An Ad Run advertises at most three Products; the rest of the catalog is
  // there to be chosen from, not to be planned against.
  it("advertises only the first three Products of a longer catalog", async () => {
    const catalog = [
      ...PRODUCTS,
      {
        name: "Stripe Radar",
        description: "Block fraud with machine learning built into payments.",
        imageUrl: null,
        price: null,
        currency: null,
        url: null,
        flagship: true,
      },
      {
        name: "Stripe Terminal",
        description: "Accept in-person payments with programmable readers.",
        imageUrl: null,
        price: null,
        currency: null,
        url: null,
        flagship: true,
      },
    ];
    const deps = adapters();

    const result = await createConceptPlanner(deps)({
      brief: BRIEF,
      products: catalog,
    });

    expect(result.ok).toBe(true);
    expect(deps.planConcepts).toHaveBeenCalledWith(BRIEF, PRODUCTS, "", undefined);
  });

  // The request is the one field a person types, so it is the one field the
  // Brief contract does not bound. The planner does it instead.
  it("passes the buyer's request to concept planning", async () => {
    const deps = adapters();

    await createConceptPlanner(deps)({
      ...AD_RUN_BRIEF,
      instruction: "  a man walking through an airport  ",
    });

    expect(deps.planConcepts).toHaveBeenCalledWith(
      BRIEF,
      PRODUCTS,
      "a man walking through an airport",
      undefined,
    );
  });

  it("bounds a request longer than the contract allows", async () => {
    const deps = adapters();

    await createConceptPlanner(deps)({
      ...AD_RUN_BRIEF,
      instruction: "x".repeat(AD_RUN_LIMITS.instruction + 50),
    });

    expect(deps.planConcepts).toHaveBeenCalledWith(
      BRIEF,
      PRODUCTS,
      "x".repeat(AD_RUN_LIMITS.instruction),
      undefined,
    );
  });

  it.each([
    ["absent", undefined],
    ["not a string", 42],
    ["only whitespace", "   "],
  ])("plans on an empty request when it is %s", async (_label, instruction) => {
    const deps = adapters();

    await createConceptPlanner(deps)({ ...AD_RUN_BRIEF, instruction });

    expect(deps.planConcepts).toHaveBeenCalledWith(BRIEF, PRODUCTS, "", undefined);
  });

  it("rejects a Brief that violates the shared contract", async () => {
    const deps = adapters();

    const result = await createConceptPlanner(deps)({
      brief: { ...BRIEF, domain: "Not A Domain" },
      products: PRODUCTS,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "internal" } });
    expect(deps.planConcepts).not.toHaveBeenCalled();
  });

  it("short-circuits when generation is not configured", async () => {
    const deps = adapters({ hasGenerationConfiguration: vi.fn(() => false) });

    const result = await createConceptPlanner(deps)(AD_RUN_BRIEF);

    expect(result).toEqual({ ok: false, error: { code: "not-configured" } });
    expect(deps.planConcepts).not.toHaveBeenCalled();
  });

  it("returns aborted for a signal that is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const deps = adapters();

    const result = await createConceptPlanner(deps)(
      AD_RUN_BRIEF,
      controller.signal,
    );

    expect(result).toEqual({ ok: false, error: { code: "aborted" } });
    expect(deps.hasGenerationConfiguration).not.toHaveBeenCalled();
    expect(deps.planConcepts).not.toHaveBeenCalled();
  });

  it("turns concept-planning failures into a typed internal failure", async () => {
    const deps = adapters({
      planConcepts: vi.fn(async () => {
        throw new Error("director unavailable");
      }),
    });

    const result = await createConceptPlanner(deps)(AD_RUN_BRIEF);

    expect(result).toMatchObject({ ok: false, error: { code: "internal" } });
  });

  it("rejects a plan that violates the shared Ad Run contract", async () => {
    const duplicate = CONCEPTS.map((concept) => ({ ...concept }));
    duplicate[1] = { ...duplicate[0], model: duplicate[1].model };
    const deps = adapters({
      planConcepts: vi.fn(async () => duplicate),
    });

    const result = await createConceptPlanner(deps)(AD_RUN_BRIEF);

    expect(result).toMatchObject({ ok: false, error: { code: "internal" } });
  });
});
