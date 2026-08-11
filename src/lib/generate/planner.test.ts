import { describe, expect, it, vi } from "vitest";
import type { PlannedConcept, Product } from "@/lib/ad-run";
import {
  BrandExtractorError,
  type BrandProfile,
  type BrandResearch,
  type StyleguideProfile,
} from "@/lib/context";
import {
  createAdRunPlanner,
  type AdRunPlannerAdapters,
} from "./planner";

const PRODUCTS: Product[] = [
  {
    name: "Payment Links",
    description: "Create a payment page and share its link with customers.",
    imageUrl: null,
  },
  {
    name: "Stripe Billing",
    description: "Manage subscriptions, invoices, and recurring revenue.",
    imageUrl: null,
  },
  {
    name: "Stripe Checkout",
    description: "Use a prebuilt payment form for online purchases.",
    imageUrl: null,
  },
];

const CONCEPTS: readonly PlannedConcept[] = [
  {
    key: "product_hero",
    model: "openai/gpt-image-1.5",
    subject: { kind: "company" },
    headline: "Move Faster",
    subheadline: "Payments built for internet businesses",
  },
  {
    key: "isometric",
    model: "fal/xai/grok-imagine-image",
    subject: { kind: "company" },
    headline: "Build Boldly",
    subheadline: "A financial platform for ambitious teams",
  },
  {
    key: "typographic",
    model: "fal/fal-ai/imagen4/preview/ultra",
    subject: { kind: "company" },
    headline: "Own Tomorrow",
    subheadline: "Tools that make online commerce simple",
  },
  {
    key: "macro_material",
    model: "openai/gpt-image-2",
    subject: { kind: "product", ...PRODUCTS[0] },
    headline: "Share. Sell. Done.",
    subheadline: "Launch a payment page from one simple link",
  },
  {
    key: "gradient_field",
    model: "fal/fal-ai/nano-banana-pro",
    subject: { kind: "product", ...PRODUCTS[1] },
    headline: "Billing That Grows",
    subheadline: "Subscriptions and invoices built to scale",
  },
  {
    key: "editorial_spread",
    model: "fal/fal-ai/bytedance/seedream/v4.5/text-to-image",
    subject: { kind: "product", ...PRODUCTS[2] },
    headline: "Checkout, Simplified",
    subheadline: "A prebuilt payment form customers recognize",
  },
];

const BRAND: BrandProfile = {
  domain: "stripe.com",
  name: "Stripe",
  description: "Financial infrastructure for the internet.",
  slogan: "Grow your revenue",
  industry: "Technology · Payments",
  logoUrl: "https://cdn.stripe.com/logo.png",
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
  products: PRODUCTS,
};

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

describe("createAdRunPlanner", () => {
  it("normalizes the domain and returns a contract-validated Ad Run", async () => {
    const deps = adapters();
    const result = await createAdRunPlanner(deps)(
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
    expect(result.value.concepts).toEqual(CONCEPTS);
    expect(deps.doResearch).toHaveBeenCalledWith("stripe.com", undefined);
    expect(result.value.concepts.slice(0, 3).map(({ subject }) => subject)).toEqual([
      { kind: "company" },
      { kind: "company" },
      { kind: "company" },
    ]);
    expect(result.value.concepts.slice(3).map(({ subject }) => subject)).toEqual(
      PRODUCTS.map((product) => ({ kind: "product", ...product })),
    );
    expect(deps.planConcepts).toHaveBeenCalledWith(
      result.value.brief,
      PRODUCTS,
      undefined,
    );
  });

  it("bounds the flat Brief before passing it to concept planning", async () => {
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

    const result = await createAdRunPlanner(deps)("stripe.com");

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

  it("plans on an empty summary when the extract carries no page copy", async () => {
    const deps = adapters({ doResearch: researching({ summary: "" }) });

    const result = await createAdRunPlanner(deps)("stripe.com");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.brief.summary).toBe("");
    expect(deps.planConcepts).toHaveBeenCalledOnce();
  });

  it("uses palette and typography defaults when the extract states no styleguide", async () => {
    const deps = adapters({
      doResearch: researching({
        styleguide: { mood: "", colors: [], fontFamily: null },
      }),
    });

    const result = await createAdRunPlanner(deps)("stripe.com");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.brief.mood).toBe("modern, confident, premium");
    expect(result.value.brief.colors).toEqual([]);
    expect(result.value.brief.fontFamily).toBeNull();
    expect(result.value.brief.colorA).toBe("vivid violet");
    expect(result.value.brief.colorB).toBe("deep navy");
  });

  it("uses the default mood when enrichment returns an empty value", async () => {
    const result = await createAdRunPlanner(
      adapters({
        doResearch: researching({ styleguide: { ...STYLEGUIDE, mood: "   " } }),
      }),
    )("stripe.com");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.brief.mood).toBe("modern, confident, premium");
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

    const result = await createAdRunPlanner(deps)("stripe.com");

    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(deps.planConcepts).not.toHaveBeenCalled();
  });

  it("treats an unrecognized research failure as internal", async () => {
    const failure = new Error("something else entirely");
    const deps = adapters({
      doResearch: vi.fn(async () => {
        throw failure;
      }),
    });

    expect(await createAdRunPlanner(deps)("stripe.com")).toEqual({
      ok: false,
      error: { code: "internal", cause: failure },
    });
  });

  it("returns invalid-domain without checking readiness or doing I/O", async () => {
    const deps = adapters();
    const result = await createAdRunPlanner(deps)("localhost");

    expect(result).toEqual({ ok: false, error: { code: "invalid-domain" } });
    expect(deps.hasContextConfiguration).not.toHaveBeenCalled();
    expect(deps.hasGenerationConfiguration).not.toHaveBeenCalled();
    expect(deps.doResearch).not.toHaveBeenCalled();
  });

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

      const result = await createAdRunPlanner(deps)("stripe.com");

      expect(result).toEqual({ ok: false, error: { code: "not-configured" } });
      expect(deps.hasContextConfiguration).toHaveBeenCalledOnce();
      expect(deps.hasGenerationConfiguration).toHaveBeenCalledOnce();
      expect(deps.doResearch).not.toHaveBeenCalled();
      expect(deps.planConcepts).not.toHaveBeenCalled();
    },
  );

  it("propagates cancellation and stops before concept planning", async () => {
    const controller = new AbortController();
    const deps = adapters({
      doResearch: vi.fn(async (_domain, signal) => {
        expect(signal).toBe(controller.signal);
        controller.abort();
        return RESEARCH;
      }),
    });

    const result = await createAdRunPlanner(deps)("stripe.com", controller.signal);

    expect(result).toEqual({ ok: false, error: { code: "aborted" } });
    expect(deps.doResearch).toHaveBeenCalledWith("stripe.com", controller.signal);
    expect(deps.planConcepts).not.toHaveBeenCalled();
  });

  it("turns concept-planning failures into a typed internal failure", async () => {
    const deps = adapters({
      planConcepts: vi.fn(async () => {
        throw new Error("director unavailable");
      }),
    });

    const result = await createAdRunPlanner(deps)("stripe.com");

    expect(result).toMatchObject({ ok: false, error: { code: "internal" } });
  });

  it("rejects a plan that violates the shared Ad Run contract", async () => {
    const duplicate = CONCEPTS.map((concept) => ({ ...concept }));
    duplicate[1] = { ...duplicate[0], model: duplicate[1].model };
    const deps = adapters({
      planConcepts: vi.fn(async () => duplicate),
    });

    const result = await createAdRunPlanner(deps)("stripe.com");

    expect(result).toMatchObject({ ok: false, error: { code: "internal" } });
  });
});
