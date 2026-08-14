import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateImage: vi.fn(),
  falEditImage: vi.fn(),
  fetchPublicRaster: vi.fn(),
  hasGatewayConfiguration: vi.fn(() => true),
  directArtwork: vi.fn(),
}));

vi.mock("ai", () => ({ generateImage: mocks.generateImage }));

vi.mock("@/lib/generate/gateway", () => ({
  gatewayImageModel: (id: string) => id,
  hasGatewayConfiguration: mocks.hasGatewayConfiguration,
  falEditImage: mocks.falEditImage,
}));

vi.mock("@/lib/public-raster", () => ({
  fetchPublicRaster: mocks.fetchPublicRaster,
}));

/**
 * The art director is a reasoning call, and this route's job is what it does
 * with the answer. Stubbed to the plan the route falls back to anyway, so every
 * test below reads as it did before there was a director; the tests that are
 * about the director hand it a plan of their own.
 */
vi.mock("@/lib/generate/director", () => ({
  directArtwork: mocks.directArtwork,
}));

import {
  enforceArtPlan,
  fallbackArtPlan,
  type ArtContext,
  type RawArtPlan,
} from "@/lib/generate/art-plan";
import { POST } from "./route";
import type { ComposeEvent as Event } from "@/lib/generate/art-plan";

/**
 * Answer the next compose with a set holding this one plan.
 *
 * A set of one rather than six: almost every test below is about how a single
 * concept becomes a prompt, and six copies of it would only make the assertions
 * count. The tests that are about the set say so and hand over six.
 */
const directs = (plan: Partial<RawArtPlan>) =>
  mocks.directArtwork.mockImplementation(async (context: ArtContext) => [
    enforceArtPlan(
      {
        adType: "product_hero",
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
        heroProducts: [],
        supportingProducts: [],
        articles: [],
        buyerAskedForPeople: false,
        buyerAskedForPrice: false,
        palette: {
          background: context.colorA,
          ink: context.colorB,
          accent: context.colorB,
        },
        typeface: "Inter",
        layout: "poster_stack",
        blocks: [],
        ...plan,
      },
      context,
    ),
  ]);

/** One pixel of PNG, which is all the route ever looks at. */
const PIXEL = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");

const photo = (byte: number) => ({ bytes: Uint8Array.from([byte]) });

/**
 * The set streams, so a response is not finished when it arrives. Every test
 * drains it before asserting — otherwise the renders have not run yet.
 */
const drain = async (response: Response): Promise<Event[]> => {
  if (!response.body) return [];
  const text = await new Response(response.body).text();
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Event);
};

const post = async (body: Record<string, unknown>) => {
  const response = await POST(
    new Request("https://branda.test/api/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "a shelf of bottles at golden hour",
        model: "openai/gpt-image-2",
        brandName: "Nouvona",
        ...body,
      }),
    }),
  );
  const events =
    response.headers.get("content-type") === "application/x-ndjson"
      ? await drain(response)
      : [];
  return Object.assign(response, { events });
};

/** What the model was actually asked for, on the one call the route makes. */
const asked = () => {
  expect(mocks.generateImage).toHaveBeenCalledTimes(1);
  const request = mocks.generateImage.mock.calls[0][0];
  const { prompt } = request;
  return {
    request,
    text: typeof prompt === "string" ? prompt : (prompt.text as string),
    images: typeof prompt === "string" ? [] : (prompt.images as Uint8Array[]),
  };
};

const product = (name: string, imageUrl: string | null) => ({
  name,
  description: `${name}, an eau de parfum`,
  imageUrl,
  price: 450,
  currency: "SAR",
});

describe("POST /api/compose", () => {
  beforeEach(() => {
    mocks.generateImage.mockReset();
    mocks.falEditImage.mockReset();
    mocks.fetchPublicRaster.mockReset();
    mocks.hasGatewayConfiguration.mockReturnValue(true);
    mocks.directArtwork.mockReset();
    mocks.directArtwork.mockImplementation(async (context: ArtContext) => [
      fallbackArtPlan(context),
    ]);
    mocks.generateImage.mockResolvedValue({
      image: { base64: PIXEL, mediaType: "image/png" },
    });
    mocks.falEditImage.mockResolvedValue({
      bytes: Uint8Array.from([1, 2, 3]),
      mediaType: "image/jpeg",
    });
  });

  it("closes every prompt with the three guardrails", async () => {
    const response = await post({});

    expect(response.status).toBe(200);
    const { text } = asked();
    expect(text).toContain("a shelf of bottles at golden hour");
    expect(text).toContain("not a screenshot of one sitting in a feed");
    expect(text).toContain("central 84% of the canvas");
    expect(text).toContain("no emoji, no decorative unicode");
  });

  it("leaves the person's own words leading the prompt", async () => {
    await post({ prompt: "two bottles on black marble" });

    expect(asked().text.startsWith("two bottles on black marble")).toBe(true);
  });

  describe("naming the photographs", () => {
    it("numbers Products against the attachments, not against the list", async () => {
      // The middle Product has no photograph: numbering it 2 would hand the
      // third Product's bottle the second Product's label.
      mocks.fetchPublicRaster.mockImplementation(async (url: string) =>
        url.endsWith("rose.png") ? photo(1) : photo(3),
      );

      await post({
        products: [
          product("Rose in Wonderland", "https://cdn.example/rose.png"),
          product("Oud Royal", null),
          product("Bella Nera", "https://cdn.example/nera.png"),
        ],
      });

      const { text, images } = asked();
      expect(images).toEqual([Uint8Array.from([1]), Uint8Array.from([3])]);
      expect(text).toContain('Photograph 1 is "Rose in Wonderland"');
      expect(text).toContain('Photograph 2 is "Bella Nera"');
      expect(text).not.toContain('Photograph 2 is "Oud Royal"');
      expect(text).toContain("exactly these 3, and no others");
      expect(text).toContain("The 2 attached photographs are the REAL articles");
    });

    it("still names a Product whose photograph never arrived", async () => {
      mocks.fetchPublicRaster.mockImplementation(async (url: string) => {
        if (url.endsWith("oud.png")) throw new Error("404");
        return photo(1);
      });

      await post({
        products: [
          product("Oud Royal", "https://cdn.example/oud.png"),
          product("Bella Nera", "https://cdn.example/nera.png"),
        ],
      });

      const { text, images } = asked();
      expect(images).toHaveLength(1);
      expect(text).toContain('Photograph 1 is "Bella Nera"');
      expect(text).toContain('"Oud Royal"');
      expect(text).toContain("no photograph supplied");
      expect(text).toContain("exactly these 2, and no others");
    });

    it("reaches a fal model through the editing path, which is its only way", async () => {
      mocks.fetchPublicRaster.mockImplementation(async () => photo(1));

      const response = await post({
        model: "fal/fal-ai/nano-banana-pro",
        aspectRatio: "9:16",
        products: [product("Bella Nera", "https://cdn.example/nera.png")],
      });

      expect(response.status).toBe(200);
      // The picture's own type travels in its event; the response is the stream.
      const image = response.events.find((e) => e.type === "image");
      expect(image).toMatchObject({ index: 0, mediaType: "image/jpeg" });
      // The picture goes by address, not by bytes, and the shape travels too.
      expect(mocks.falEditImage).toHaveBeenCalledTimes(1);
      const [request] = mocks.falEditImage.mock.calls[0];
      expect(request.path).toBe("fal-ai/nano-banana-pro/edit");
      expect(request.imageUrls).toEqual(["https://cdn.example/nera.png"]);
      expect(request.aspectRatio).toBe("9:16");
      expect(request.prompt).toContain("The attached image is the REAL");
      expect(mocks.generateImage).not.toHaveBeenCalled();
    });

    it("sends a fal model every article named, in the order it numbers them", async () => {
      mocks.fetchPublicRaster.mockImplementation(async () => photo(1));

      await post({
        model: "fal/fal-ai/nano-banana-pro",
        products: [
          product("Rose in Wonderland", "https://cdn.example/rose.png"),
          product("Bella Nera", "https://cdn.example/nera.png"),
        ],
      });

      const { imageUrls, prompt } = mocks.falEditImage.mock.calls[0][0];
      expect(imageUrls).toEqual([
        "https://cdn.example/rose.png",
        "https://cdn.example/nera.png",
      ]);
      expect(prompt).toContain('Photograph 1 is "Rose in Wonderland"');
      expect(prompt).toContain('Photograph 2 is "Bella Nera"');
      expect(prompt).not.toContain("no photograph supplied");
      expect(prompt).toContain("The 2 attached photographs are the REAL");
    });

    it("still describes a fal model's Product that has no photograph", async () => {
      mocks.fetchPublicRaster.mockImplementation(async () => photo(1));

      await post({
        model: "fal/fal-ai/nano-banana-pro",
        products: [
          product("Rose in Wonderland", "https://cdn.example/rose.png"),
          product("Oud Royal", null),
        ],
      });

      const { imageUrls, prompt } = mocks.falEditImage.mock.calls[0][0];
      expect(imageUrls).toEqual(["https://cdn.example/rose.png"]);
      expect(prompt).toContain('Photograph 1 is "Rose in Wonderland"');
      expect(prompt).toContain("no photograph supplied");
    });

    it("falls back to plain generation when a fal model was named nothing", async () => {
      await post({ model: "fal/fal-ai/nano-banana-pro" });

      expect(mocks.falEditImage).not.toHaveBeenCalled();
      expect(mocks.generateImage).toHaveBeenCalledTimes(1);
    });

    /**
     * The photograph is still fetched for a model that cannot be shown one,
     * because the director looks at it either way — and a model working from
     * words alone is exactly the one that most needs to be told the bottle is
     * amber glass rather than left to guess from the palette.
     */
    it("describes every Product when the model cannot be shown one", async () => {
      mocks.fetchPublicRaster.mockImplementation(async () => photo(1));

      await post({
        model: "fal/xai/grok-imagine-image",
        products: [product("Bella Nera", "https://cdn.example/nera.png")],
      });

      const { text, images } = asked();
      expect(images).toEqual([]);
      // Looked at by the director, never attached to the image model.
      expect(mocks.directArtwork.mock.calls[0][1]).toHaveLength(1);
      expect(text).toContain('"Bella Nera"');
      expect(text).toContain("no photograph supplied");
      expect(text).not.toContain("Photograph 1 is");
    });
  });

  describe("keeping a photographed article as it really is", () => {
    beforeEach(() =>
      mocks.fetchPublicRaster.mockImplementation(async () => photo(1)),
    );

    it("takes the palette away from the product, and says so last", async () => {
      await post({
        colorA: "vivid teal",
        colorB: "deep navy",
        products: [product("WH80", "https://cdn.example/wh80.png")],
      });

      const { text } = asked();
      // The brand colours are still stated — they are just no longer the last
      // word on what colour the keyboard is.
      expect(text).toContain("Colour anchors: vivid teal as the dominant field");
      expect(text).toContain("COLOUR OVERRIDE");
      expect(text).toContain("keeps its own real colours");
      expect(text.indexOf("COLOUR OVERRIDE")).toBeGreaterThan(
        text.indexOf("Colour anchors: vivid teal"),
      );
      expect(text.trimEnd().endsWith("redrawing the product is not.")).toBe(
        true,
      );
    });

    it("leaves the scene to the person who described it", async () => {
      await post({
        prompt: "on a desk in a forest at dawn",
        products: [product("WH80", "https://cdn.example/wh80.png")],
      });

      const { text } = asked();
      expect(text).toContain("SCOPE:");
      expect(text).toContain("build whatever scene is described there");
    });

    it("speaks of one article in the singular and several by number", async () => {
      await post({ products: [product("WH80", "https://cdn.example/wh80.png")] });
      expect(asked().text).toContain("The attached image is the REAL WH80.");

      mocks.generateImage.mockClear();
      await post({
        products: [
          product("WH80", "https://cdn.example/wh80.png"),
          product("Halo75", "https://cdn.example/halo.png"),
        ],
      });
      const { text } = asked();
      expect(text).toContain("The 2 attached photographs are the REAL articles");
      expect(text).toContain("numbered against above");
    });

    it("spends the quality a reproduced article needs, and only then", async () => {
      await post({ products: [product("WH80", "https://cdn.example/wh80.png")] });
      expect(asked().request.providerOptions).toEqual({
        openai: { quality: "high" },
      });

      mocks.generateImage.mockClear();
      await post({});
      expect(asked().request.providerOptions).toEqual({
        openai: { quality: "medium" },
      });
    });

    it("says nothing about fidelity when nothing was attached", async () => {
      await post({ products: [product("Oud Royal", null)] });

      const { text } = asked();
      expect(text).not.toContain("COLOUR OVERRIDE");
      expect(text).not.toContain("attached image is the REAL");
    });
  });

  describe("the shape", () => {
    it("sends a pixel size to a model that rejects aspect ratios", async () => {
      await post({ model: "openai/gpt-image-2", aspectRatio: "2:3" });

      const { request } = asked();
      expect(request.size).toBe("1024x1536");
      expect(request.aspectRatio).toBeUndefined();
    });

    it("sends a ratio to a model that takes one", async () => {
      await post({
        model: "fal/fal-ai/imagen4/preview/ultra",
        aspectRatio: "9:16",
      });

      const { request } = asked();
      expect(request.aspectRatio).toBe("9:16");
      expect(request.size).toBeUndefined();
    });

    it("refuses a shape it would otherwise answer with a square", async () => {
      const response = await post({
        model: "openai/gpt-image-2",
        aspectRatio: "9:16",
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "GPT Image 2 cannot render 9:16.",
      });
      expect(mocks.generateImage).not.toHaveBeenCalled();
    });

    it("falls back to a square when no shape was named", async () => {
      await post({ model: "fal/fal-ai/imagen4/preview/ultra" });

      expect(asked().request.aspectRatio).toBe("1:1");
    });
  });

  describe("the art director", () => {
    it("is given the brand, the market and the shop to reason from", async () => {
      await post({
        domain: "nouvona.com",
        industry: "fragrance",
        summary: "They sell perfume.",
        audience: "Women in the Gulf buying gifts.",
        language: "ar",
        catalog: [product("Oud Royal", null)],
      });

      const [context] = mocks.directArtwork.mock.calls[0];
      expect(context.domain).toBe("nouvona.com");
      expect(context.audience).toBe("Women in the Gulf buying gifts.");
      expect(context.language).toBe("ar");
      expect(context.catalog.map((p: { name: string }) => p.name)).toEqual([
        "Oud Royal",
      ]);
      expect(context.aspectRatio).toBe("1:1");
      // gpt-image-2 takes five, and the picture will hold no more than five.
      expect(context.photographCapacity).toBe(5);
    });

    /**
     * "An ad for our bestsellers" names nothing. Before the director the image
     * came back holding invented bottles; now it holds the ones the shop
     * actually lists, because the director picked them by name.
     */
    it("puts real Products in an image that named none", async () => {
      mocks.fetchPublicRaster.mockImplementation(async () => photo(1));
      directs({ heroProducts: ["Oud Royal", "Bella Nera"] });

      await post({
        prompt: "an ad for our bestsellers",
        catalog: [
          product("Oud Royal", "https://cdn.example/oud.png"),
          product("Bella Nera", "https://cdn.example/nera.png"),
          product("Rose in Wonderland", "https://cdn.example/rose.png"),
        ],
      });

      const { text, images } = asked();
      expect(images).toHaveLength(2);
      expect(text).toContain('Photograph 1 is "Oud Royal"');
      expect(text).toContain('Photograph 2 is "Bella Nera"');
      expect(text).not.toContain("Rose in Wonderland");
    });

    it("keeps the price out of a hero shot and prints it on an offer", async () => {
      directs({
        adType: "product_hero",
        heroProducts: ["Bella Nera"],
        blocks: [
          {
            role: "headline",
            text: "Wear the night",
            sizePercent: 14,
            weight: "bold",
            case: "as_written",
            placement: "top_left",
          },
          {
            role: "price",
            text: "SAR 450",
            sizePercent: 5,
            weight: "medium",
            case: "as_written",
            placement: "bottom_right",
          },
        ],
      });
      await post({ products: [product("Bella Nera", null)] });

      const hero = asked().text;
      expect(hero).toContain('"Wear the night"');
      expect(hero).not.toContain('"SAR 450"');
      // Still known, so the article is lit like the thing it costs.
      expect(hero).toContain("Listed at SAR 450.");

      mocks.generateImage.mockClear();
      directs({
        adType: "promo_offer",
        heroProducts: ["Bella Nera"],
        blocks: [
          {
            role: "headline",
            text: "Wear the night",
            sizePercent: 14,
            weight: "bold",
            case: "as_written",
            placement: "top_left",
          },
          {
            role: "price",
            text: "SAR 450",
            sizePercent: 5,
            weight: "medium",
            case: "as_written",
            placement: "bottom_right",
          },
        ],
      });
      await post({ products: [product("Bella Nera", null)] });

      expect(asked().text).toContain('"SAR 450" — the price');
    });

    /**
     * The director is shown the article before it decides anything, which is
     * the whole fix for a bottle of amber glass coming back in brand teal.
     */
    it("shows the director the article before it decides", async () => {
      mocks.fetchPublicRaster.mockImplementation(async () => photo(7));

      await post({
        products: [product("Bella Nera", "https://cdn.example/nera.png")],
      });

      const [, looked] = mocks.directArtwork.mock.calls[0];
      expect(looked).toEqual([
        { name: "Bella Nera", bytes: Uint8Array.from([7]), mediaType: undefined },
      ]);
    });

    /** Nothing named means nothing chosen, so the head of the shop stands in. */
    it("looks at the catalogue when the request named nothing", async () => {
      mocks.fetchPublicRaster.mockImplementation(async () => photo(1));

      await post({
        prompt: "an ad for our bestsellers",
        catalog: [
          product("Oud Royal", "https://cdn.example/oud.png"),
          product("Bella Nera", "https://cdn.example/nera.png"),
        ],
      });

      const [, looked] = mocks.directArtwork.mock.calls[0];
      expect(looked.map((a: { name: string }) => a.name)).toEqual([
        "Oud Royal",
        "Bella Nera",
      ]);
    });

    /** One call per image and no memory between them is why it repeated. */
    it("tells the director what this session already made", async () => {
      await post({
        avoid: [
          { direction: "sculptural_hero", lighting: "rembrandt", surface: "seamless_paper" },
          { direction: "not a real one that survives", finish: "portra_warm" },
        ],
      });

      const [context] = mocks.directArtwork.mock.calls[0];
      expect(context.avoid).toEqual([
        {
          direction: "sculptural_hero",
          lighting: "rembrandt",
          surface: "seamless_paper",
          finish: null,
        },
        {
          direction: "not a real one that survives",
          lighting: null,
          surface: null,
          finish: "portra_warm",
        },
      ]);
    });

    it("hands the craft back so the next set can differ from this one", async () => {
      directs({ direction: "kinetic", lighting: "split_light", finish: "halation_bloom" });

      const set = (await post({})).events[0];
      expect(set.type === "set" && set.concepts[0].craft).toEqual({
        lighting: "split_light",
        surface: null,
        finish: "halation_bloom",
      });
    });

    /** An agent that decides silently is one nobody can correct. */
    it("announces every concept before a single picture exists", async () => {
      directs({
        adType: "promo_offer",
        direction: "graphic_poster",
        conceptName: "Frozen mid-pour",
        idea: "الطلب يسأل عن عرض",
      });

      const response = await post({});
      const [first] = response.events;
      expect(first).toMatchObject({
        type: "set",
        concepts: [
          {
            index: 0,
            adType: "promo_offer",
            family: "graphic_poster",
            conceptName: "Frozen mid-pour",
            idea: "الطلب يسأل عن عرض",
          },
        ],
      });
      // Announced first, so six tiles can appear before the first render lands.
      expect(response.events[1]?.type).toBe("image");
    });

    /**
     * The director carries its own fallback, so reaching here means something
     * broke that was not planned for. An undirected image is the failure this
     * route was rewritten to stop shipping, so it ships nothing instead.
     */
    it("refuses rather than render an image nobody directed", async () => {
      mocks.directArtwork.mockRejectedValue(new Error("gateway down"));

      const response = await post({});
      expect(response.status).toBe(502);
      expect(mocks.generateImage).not.toHaveBeenCalled();
    });
  });

  it("never caches, and never renders without a prompt", async () => {
    const response = await post({ prompt: "   " });

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });
});
