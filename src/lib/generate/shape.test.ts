import { describe, expect, it } from "vitest";
import { imageModelById, IMAGE_MODELS } from "./models";
import {
  ASPECT_RATIOS,
  isAspectRatio,
  nearestRatio,
  shapeFor,
  supportedRatios,
} from "./shape";

const openai = imageModelById("openai/gpt-image-2")!;
const fal = imageModelById("fal/fal-ai/imagen4/preview/ultra")!;

describe("isAspectRatio", () => {
  it("accepts the declared vocabulary and nothing else", () => {
    for (const ratio of ASPECT_RATIOS) expect(isAspectRatio(ratio)).toBe(true);
    expect(isAspectRatio("21:9")).toBe(false);
    expect(isAspectRatio("")).toBe(false);
    expect(isAspectRatio("1:1 ")).toBe(false);
  });
});

describe("shapeFor", () => {
  it("sends a pixel size to a model that rejects aspect ratios", () => {
    expect(shapeFor("1:1", openai)).toEqual({
      kind: "pixel_size",
      size: "1024x1024",
    });
    expect(shapeFor("2:3", openai)).toEqual({
      kind: "pixel_size",
      size: "1024x1536",
    });
    expect(shapeFor("3:2", openai)).toEqual({
      kind: "pixel_size",
      size: "1536x1024",
    });
  });

  it("refuses a shape it would otherwise answer with a square", () => {
    expect(shapeFor("9:16", openai)).toBeNull();
    expect(shapeFor("16:9", openai)).toBeNull();
    expect(shapeFor("4:5", openai)).toBeNull();
  });

  it("passes the ratio through for a model that takes one", () => {
    expect(shapeFor("9:16", fal)).toEqual({
      kind: "aspect_ratio",
      aspectRatio: "9:16",
    });
    expect(shapeFor("4:5", fal)).toEqual({
      kind: "aspect_ratio",
      aspectRatio: "4:5",
    });
  });

  it("offers every Image Model a square", () => {
    for (const model of IMAGE_MODELS) {
      expect(supportedRatios(model)).toContain("1:1");
      expect(shapeFor("1:1", model)).not.toBeNull();
    }
  });

  it("only ever offers a shape it can send", () => {
    for (const model of IMAGE_MODELS) {
      for (const ratio of ASPECT_RATIOS) {
        expect(shapeFor(ratio, model) === null).toBe(
          !supportedRatios(model).includes(ratio),
        );
      }
    }
  });
});

describe("nearestRatio", () => {
  it("keeps a shape the model already offers", () => {
    expect(nearestRatio("9:16", fal)).toBe("9:16");
    expect(nearestRatio("2:3", openai)).toBe("2:3");
  });

  it("keeps the orientation when the exact shape retires", () => {
    expect(nearestRatio("9:16", openai)).toBe("2:3");
    expect(nearestRatio("4:5", openai)).toBe("2:3");
    expect(nearestRatio("16:9", openai)).toBe("3:2");
    expect(nearestRatio("2:3", fal)).toBe("4:5");
    expect(nearestRatio("3:2", fal)).toBe("16:9");
  });

  it("lands on a shape the model offers, from anywhere", () => {
    for (const model of IMAGE_MODELS) {
      for (const ratio of ASPECT_RATIOS) {
        expect(supportedRatios(model)).toContain(nearestRatio(ratio, model));
      }
    }
  });
});
