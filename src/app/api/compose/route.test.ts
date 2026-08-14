import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateImage: vi.fn(),
  fetchPublicRaster: vi.fn(),
  hasGatewayConfiguration: vi.fn(() => true),
}));

vi.mock("ai", () => ({ generateImage: mocks.generateImage }));

vi.mock("@/lib/generate/gateway", () => ({
  gatewayImageModel: (id: string) => id,
  hasGatewayConfiguration: mocks.hasGatewayConfiguration,
}));

vi.mock("@/lib/public-raster", () => ({
  fetchPublicRaster: mocks.fetchPublicRaster,
}));

import { POST } from "./route";

/** One pixel of PNG, which is all the route ever looks at. */
const PIXEL = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");

const photo = (byte: number) => ({ bytes: Uint8Array.from([byte]) });

const post = (body: Record<string, unknown>) =>
  POST(
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
    mocks.fetchPublicRaster.mockReset();
    mocks.hasGatewayConfiguration.mockReturnValue(true);
    mocks.generateImage.mockResolvedValue({
      image: { base64: PIXEL, mediaType: "image/png" },
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

    it("describes every Product when the model cannot be shown one", async () => {
      await post({
        model: "fal/xai/grok-imagine-image",
        products: [product("Bella Nera", "https://cdn.example/nera.png")],
      });

      const { text, images } = asked();
      expect(images).toEqual([]);
      expect(mocks.fetchPublicRaster).not.toHaveBeenCalled();
      expect(text).toContain('"Bella Nera"');
      expect(text).toContain("no photograph supplied");
      expect(text).not.toContain("Photograph 1 is");
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

  it("never caches, and never renders without a prompt", async () => {
    const response = await post({ prompt: "   " });

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });
});
