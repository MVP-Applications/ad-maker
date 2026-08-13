import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { RenderedAdQuery } from "@/lib/ad-run";
import {
  createAdRenderer,
  type AdRendererDependencies,
  type ImageGenerationResult,
} from "./renderer";

const OUTPUT = new Uint8Array([1, 2, 3]);
const LOGO = {
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  mediaType: "image/png" as const,
};

const query = (overrides: Partial<RenderedAdQuery> = {}): RenderedAdQuery => ({
  domain: "stripe.com",
  concept: "typographic",
  model: "openai/gpt-image-2",
  subject: { kind: "company" },
  headline: "Move money",
  subheadline: "Financial infrastructure for every business",
  instruction: "",
  showsPeople: false,
  scene: "",
  brandName: "Stripe",
  colorA: "vivid violet",
  colorB: "deep navy",
  summary: "Stripe provides programmable financial services.",
  industry: "Technology · Payments",
  mood: "modern, confident, premium",
  fontFamily: "Inter",
  logoUrl: "https://cdn.example/stripe.png",
  canonicalHref: "/api/ad?canonical=true",
  ...overrides,
});

const success = (): ImageGenerationResult => ({
  ok: true,
  value: { bytes: OUTPUT, mediaType: "image/png" },
});

function dependencies(overrides: Partial<AdRendererDependencies> = {}) {
  return {
    isReady: vi.fn(() => true),
    generateImage: vi.fn(async () => success()),
    loadRaster: vi.fn(async () => LOGO),
    sleep: vi.fn(async () => undefined),
    ...overrides,
  } satisfies AdRendererDependencies;
}

describe("Ad Renderer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads and attaches a raster logo only when the Image Model catalog allows it", async () => {
    const capable = dependencies();
    const capableResult = await createAdRenderer(capable).render(query());

    expect(capableResult).toEqual({
      ok: true,
      value: {
        bytes: OUTPUT,
        mediaType: "image/png",
        concept: "typographic",
        model: "openai/gpt-image-2",
      },
    });
    expect(capable.loadRaster).toHaveBeenCalledWith(
      "https://cdn.example/stripe.png",
      undefined,
    );
    expect(vi.mocked(capable.generateImage).mock.calls[0][0]).toMatchObject({
      model: "openai/gpt-image-2",
      attachment: { kind: "bytes", raster: LOGO },
      square: { kind: "pixel_size", size: "1024x1024" },
      quality: "medium",
    });
    expect(vi.mocked(capable.generateImage).mock.calls[0][0].prompt).toContain(
      "The attached image is Stripe's REAL logo mark.",
    );

  });

  it("asks each provider for a square in the dialect it accepts", async () => {
    // OpenAI's image models reject aspectRatio and silently fall back to their
    // own default size; fal's models have no size parameter at all.
    for (const [model, square] of [
      ["openai/gpt-image-2", { kind: "pixel_size", size: "1024x1024" }],
      ["openai/gpt-image-1.5", { kind: "pixel_size", size: "1024x1024" }],
      ["fal/fal-ai/nano-banana-pro", { kind: "aspect_ratio", aspectRatio: "1:1" }],
      ["fal/xai/grok-imagine-image", { kind: "aspect_ratio", aspectRatio: "1:1" }],
      [
        "fal/fal-ai/bytedance/seedream/v4.5/text-to-image",
        { kind: "aspect_ratio", aspectRatio: "1:1" },
      ],
      [
        "fal/fal-ai/imagen4/preview/ultra",
        { kind: "aspect_ratio", aspectRatio: "1:1" },
      ],
    ] as const) {
      const deps = dependencies();
      await createAdRenderer(deps).render(query({ model }));

      expect(vi.mocked(deps.generateImage).mock.calls[0][0].square).toEqual(square);
    }
  });

  // Ordering is the whole point: an image model weighs its last instruction
  // most, and a Product ad's fidelity block reads as "change nothing". Behind
  // it, a request to move the product into a forest produced a faithful product
  // and no forest.
  describe("the buyer's request", () => {
    const PRODUCT = {
      kind: "product" as const,
      name: "Stripe Billing",
      description: "Subscription billing and recurring revenue tools.",
      imageUrl: "https://cdn.example.com/billing.png",
    };
    const promptOf = (deps: AdRendererDependencies) =>
      vi.mocked(deps.generateImage).mock.calls[0][0].prompt;

    it("comes after the Product fidelity rules, not before them", async () => {
      const deps = dependencies();

      await createAdRenderer(deps).render(
        query({ subject: PRODUCT, instruction: "in a misty forest at dawn" }),
      );

      const prompt = promptOf(deps);
      expect(prompt).toContain("in a misty forest at dawn");
      expect(prompt.indexOf("THE BUYER'S REQUEST")).toBeGreaterThan(
        prompt.indexOf("The attached image is the REAL"),
      );
    });

    it("comes after the logo rules on a Company ad", async () => {
      const deps = dependencies();

      await createAdRenderer(deps).render(
        query({ instruction: "in a misty forest at dawn" }),
      );

      const prompt = promptOf(deps);
      expect(prompt.indexOf("THE BUYER'S REQUEST")).toBeGreaterThan(
        prompt.indexOf("REAL logo mark"),
      );
    });

    it("survives the downgrade when a model rejects the reference", async () => {
      const deps = dependencies({
        generateImage: vi
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            error: { kind: "image_input_rejected" },
          })
          .mockResolvedValue(success()),
      });

      await createAdRenderer(deps).render(
        query({ subject: PRODUCT, instruction: "in a misty forest at dawn" }),
      );

      // The image went, and the rules describing it went with it. The request
      // never depended on a reference, so it stays.
      const retried = vi.mocked(deps.generateImage).mock.calls[1][0].prompt;
      expect(retried).toContain("in a misty forest at dawn");
      expect(retried).not.toContain("The attached image is the REAL");
    });

    it("is absent from the prompt when nothing was asked", async () => {
      const deps = dependencies();

      await createAdRenderer(deps).render(query({ subject: PRODUCT }));

      expect(promptOf(deps)).not.toContain("THE BUYER'S REQUEST");
    });

    // The fidelity block has to permit the scene, or it reads as a blanket
    // refusal to change anything at all.
    it("is met by fidelity rules that hand it the scene", async () => {
      const deps = dependencies();

      await createAdRenderer(deps).render(
        query({ subject: PRODUCT, instruction: "in a misty forest at dawn" }),
      );

      const prompt = promptOf(deps);
      expect(prompt).toContain("governs the PRODUCT ITSELF, not the picture around it");
      expect(prompt).toContain("Relighting the product to match that scene is correct");
    });
  });

  it("makes the selected Product the explicit campaign focus", async () => {
    const deps = dependencies({ loadRaster: vi.fn(async () => null) });

    await createAdRenderer(deps).render(
      query({
        subject: {
          kind: "product",
          name: "Stripe Billing",
          description: "Subscription billing and recurring revenue tools.",
          imageUrl: null,
        },
      }),
    );

    const prompt = vi.mocked(deps.generateImage).mock.calls[0][0].prompt;
    expect(prompt).toContain('specific Stripe product "Stripe Billing"');
    expect(prompt).toContain(
      "Subscription billing and recurring revenue tools.",
    );
    expect(prompt).toContain("not a generic company-level metaphor");
  });

  describe("the one reference image", () => {
    const product = (imageUrl: string | null) => ({
      kind: "product" as const,
      name: "NuPhy Gem80",
      description: "TKL custom mechanical keyboard.",
      imageUrl,
    });

    it("spends it on the product's own photo when the ad is about a product", async () => {
      const deps = dependencies();
      await createAdRenderer(deps).render(
        query({
          model: "openai/gpt-image-2",
          subject: product("https://cdn.example/gem80.png"),
        }),
      );

      expect(deps.loadRaster).toHaveBeenCalledWith(
        "https://cdn.example/gem80.png",
        undefined,
      );
      const call = vi.mocked(deps.generateImage).mock.calls[0][0];
      expect(call.attachment).toEqual({ kind: "bytes", raster: LOGO });
      expect(call.prompt).toContain("The attached image is the REAL NuPhy Gem80.");
      // The logo would be the wrong reference here — the ad's whole subject is
      // the product, and only one image is sent.
      expect(call.prompt).not.toContain("REAL logo mark");
    });

    it("routes a fal model's product photo to its editing path, by URL", async () => {
      // fal's text-to-image endpoints accept an image field and ignore it, so
      // the photo only counts if it reaches /edit — which takes a URL.
      const deps = dependencies();
      await createAdRenderer(deps).render(
        query({
          model: "fal/fal-ai/nano-banana-pro",
          subject: product("https://cdn.example/gem80.png"),
        }),
      );

      // Still loaded: that is the check the URL is a public, bounded raster.
      expect(deps.loadRaster).toHaveBeenCalledWith(
        "https://cdn.example/gem80.png",
        undefined,
      );
      const call = vi.mocked(deps.generateImage).mock.calls[0][0];
      expect(call.model).toBe("fal/fal-ai/nano-banana-pro");
      expect(call.attachment).toEqual({
        kind: "edit",
        path: "fal-ai/nano-banana-pro/edit",
        url: "https://cdn.example/gem80.png",
      });
      expect(call.prompt).toContain("The attached image is the REAL");
    });

    it("never sends the logo to an editing model", async () => {
      // Editing a logo returns a defaced logo, so a company ad on a fal model
      // renders from text instead.
      const deps = dependencies();
      await createAdRenderer(deps).render(
        query({ model: "fal/fal-ai/nano-banana-pro", subject: { kind: "company" } }),
      );

      expect(deps.loadRaster).not.toHaveBeenCalled();
      const call = vi.mocked(deps.generateImage).mock.calls[0][0];
      expect(call.attachment).toBeNull();
      expect(call.prompt).not.toContain("REAL logo mark");
    });

    it("sends nothing to a model that ignores images", async () => {
      const deps = dependencies();
      await createAdRenderer(deps).render(
        query({
          model: "fal/fal-ai/imagen4/preview/ultra",
          subject: product("https://cdn.example/gem80.png"),
        }),
      );

      expect(deps.loadRaster).not.toHaveBeenCalled();
      expect(vi.mocked(deps.generateImage).mock.calls[0][0].attachment).toBeNull();
    });

    it("pays for high quality only where a real article has to survive", async () => {
      // At medium the WH80's transparent keycaps came back solid while its case,
      // light bar and layout were right — refraction degrades first.
      const withPhoto = dependencies();
      await createAdRenderer(withPhoto).render(
        query({
          model: "openai/gpt-image-2",
          subject: product("https://cdn.example/gem80.png"),
        }),
      );
      expect(vi.mocked(withPhoto.generateImage).mock.calls[0][0].quality).toBe("high");

      // A Product with no photo has no materials to reproduce, and a company ad
      // carries no article at all — neither is worth the higher bill.
      for (const subject of [product(null), { kind: "company" as const }]) {
        const deps = dependencies();
        await createAdRenderer(deps).render(
          query({ model: "openai/gpt-image-2", subject }),
        );
        expect(vi.mocked(deps.generateImage).mock.calls[0][0].quality).toBe("medium");
      }
    });

    it("scopes the brand palette to the scene so the product keeps its colours", async () => {
      // A white keyboard came back tinted brand-teal because the direction says
      // "render entirely in tones of colorA" and the reference says "match its
      // colourway". The override is last, where it wins.
      const deps = dependencies();
      await createAdRenderer(deps).render(
        query({
          model: "openai/gpt-image-2",
          subject: product("https://cdn.example/gem80.png"),
        }),
      );

      const prompt = vi.mocked(deps.generateImage).mock.calls[0][0].prompt;
      expect(prompt).toContain("COLOUR OVERRIDE");
      expect(prompt).toContain("BACKGROUND, the lighting, and the TYPOGRAPHY only");
      expect(prompt).toContain("keeps its own real colours");
      expect(prompt.indexOf("COLOUR OVERRIDE")).toBeGreaterThan(
        prompt.indexOf("HARD RULES"),
      );
    });

    it("falls back to the logo when the product has no photo", async () => {
      const deps = dependencies();
      await createAdRenderer(deps).render(
        query({ model: "openai/gpt-image-2", subject: product(null) }),
      );

      expect(deps.loadRaster).toHaveBeenCalledWith(
        "https://cdn.example/stripe.png",
        undefined,
      );
      expect(vi.mocked(deps.generateImage).mock.calls[0][0].prompt).toContain(
        "REAL logo mark",
      );
    });

    it("still spends it on the logo for a company ad", async () => {
      const deps = dependencies();
      await createAdRenderer(deps).render(query({ model: "openai/gpt-image-2" }));

      expect(vi.mocked(deps.generateImage).mock.calls[0][0].prompt).toContain(
        "REAL logo mark",
      );
    });

    it("keeps the ad when the product photo cannot be loaded", async () => {
      const deps = dependencies({ loadRaster: vi.fn(async () => null) });
      const result = await createAdRenderer(deps).render(
        query({
          model: "openai/gpt-image-2",
          subject: product("https://cdn.example/gone.png"),
        }),
      );

      expect(result.ok).toBe(true);
      expect(vi.mocked(deps.generateImage).mock.calls[0][0].attachment).toBeNull();
    });
  });

  it("uses the verified styleguide Google Font and preserves the generic fallback", async () => {
    const branded = dependencies({ loadRaster: vi.fn(async () => null) });
    await createAdRenderer(branded).render(query({ fontFamily: "DM Sans" }));

    const brandedPrompt = vi.mocked(branded.generateImage).mock.calls[0][0].prompt;
    expect(brandedPrompt).toContain(
      "Use DM Sans, the brand's Google Font, for every text element.",
    );
    expect(brandedPrompt).not.toContain("Inter / Geist / Helvetica style");

    const fallback = dependencies({ loadRaster: vi.fn(async () => null) });
    await createAdRenderer(fallback).render(query({ fontFamily: null }));

    const fallbackPrompt = vi.mocked(fallback.generateImage).mock.calls[0][0].prompt;
    expect(fallbackPrompt).toContain("Inter / Geist / Helvetica style");
    expect(fallbackPrompt).not.toContain("the brand's Google Font");
  });

  it("softly falls back to text-only when raster loading fails", async () => {
    const deps = dependencies({
      loadRaster: vi.fn(async () => {
        throw new Error("logo unavailable");
      }),
    });

    const result = await createAdRenderer(deps).render(query());

    expect(result.ok).toBe(true);
    expect(vi.mocked(deps.generateImage).mock.calls[0][0].attachment).toBeNull();
  });

  it("downgrades an image-input rejection exactly once without consuming a transient retry", async () => {
    const generateImage = vi
      .fn<AdRendererDependencies["generateImage"]>()
      .mockResolvedValueOnce({ ok: false, error: { kind: "transient" } })
      .mockResolvedValueOnce({ ok: false, error: { kind: "image_input_rejected" } })
      .mockResolvedValueOnce({ ok: false, error: { kind: "transient" } })
      .mockResolvedValueOnce(success());
    const deps = dependencies({ generateImage });

    const result = await createAdRenderer(deps).render(query());

    expect(result.ok).toBe(true);
    expect(generateImage).toHaveBeenCalledTimes(4);
    expect(generateImage.mock.calls[0][0].attachment).toEqual({ kind: "bytes", raster: LOGO });
    expect(generateImage.mock.calls[1][0].attachment).toEqual({ kind: "bytes", raster: LOGO });
    expect(generateImage.mock.calls[2][0].attachment).toBeNull();
    expect(generateImage.mock.calls[3][0].attachment).toBeNull();
    expect(generateImage.mock.calls[2][0].prompt).not.toContain("REAL logo mark");
    expect(vi.mocked(deps.sleep).mock.calls.map(([delay]) => delay)).toEqual([800, 1800]);
  });

  it("does not retry a second image-input rejection after logo downgrade", async () => {
    const generateImage = vi
      .fn<AdRendererDependencies["generateImage"]>()
      .mockResolvedValue({ ok: false, error: { kind: "image_input_rejected" } });
    const deps = dependencies({ generateImage });

    const result = await createAdRenderer(deps).render(query());

    expect(result).toEqual({
      ok: false,
      error: { code: "generation_failed", retryable: false },
    });
    expect(generateImage).toHaveBeenCalledTimes(2);
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it("retries transient failures after 800ms and 1800ms", async () => {
    const generateImage = vi
      .fn<AdRendererDependencies["generateImage"]>()
      .mockResolvedValueOnce({ ok: false, error: { kind: "transient" } })
      .mockResolvedValueOnce({ ok: false, error: { kind: "transient" } })
      .mockResolvedValueOnce(success());
    const deps = dependencies({ generateImage, loadRaster: vi.fn(async () => null) });

    const result = await createAdRenderer(deps).render(query());

    expect(result.ok).toBe(true);
    expect(generateImage).toHaveBeenCalledTimes(3);
    expect(vi.mocked(deps.sleep).mock.calls.map(([delay]) => delay)).toEqual([800, 1800]);
  });

  it("stops immediately on a nontransient failure", async () => {
    const generateImage = vi
      .fn<AdRendererDependencies["generateImage"]>()
      .mockResolvedValue({ ok: false, error: { kind: "nontransient" } });
    const deps = dependencies({ generateImage });

    const result = await createAdRenderer(deps).render(query());

    expect(result).toEqual({
      ok: false,
      error: { code: "generation_failed", retryable: false },
    });
    expect(generateImage).toHaveBeenCalledOnce();
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it("reports retryable exhaustion after three transient attempts", async () => {
    const generateImage = vi
      .fn<AdRendererDependencies["generateImage"]>()
      .mockResolvedValue({ ok: false, error: { kind: "transient" } });
    const deps = dependencies({ generateImage });

    const result = await createAdRenderer(deps).render(query());

    expect(result).toEqual({
      ok: false,
      error: { code: "generation_failed", retryable: true },
    });
    expect(generateImage).toHaveBeenCalledTimes(3);
    expect(vi.mocked(deps.sleep).mock.calls.map(([delay]) => delay)).toEqual([800, 1800]);
  });

  it("returns not_configured without touching external dependencies", async () => {
    const deps = dependencies({ isReady: vi.fn(() => false) });

    const result = await createAdRenderer(deps).render(query());

    expect(result).toEqual({ ok: false, error: { code: "not_configured" } });
    expect(deps.loadRaster).not.toHaveBeenCalled();
    expect(deps.generateImage).not.toHaveBeenCalled();
  });

  it("returns aborted for work cancelled before rendering or during backoff", async () => {
    const before = dependencies();
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await expect(
      createAdRenderer(before).render(query(), alreadyAborted.signal),
    ).resolves.toEqual({ ok: false, error: { code: "aborted" } });
    expect(before.generateImage).not.toHaveBeenCalled();

    const duringBackoff = new AbortController();
    const sleep = vi.fn(async () => {
      duringBackoff.abort();
      throw new Error("aborted");
    });
    const deps = dependencies({
      generateImage: vi.fn(async () => ({
        ok: false as const,
        error: { kind: "transient" as const },
      })),
      sleep,
    });
    await expect(
      createAdRenderer(deps).render(query(), duringBackoff.signal),
    ).resolves.toEqual({ ok: false, error: { code: "aborted" } });
  });
});
