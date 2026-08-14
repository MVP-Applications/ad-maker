import type { ImageModel, ImageModelSizing } from "./models";

/**
 * The shape a composed image is asked for, in the form its model can take it.
 *
 * The Ad Run is always square, so `renderer.ts` carries one spec per sizing kind
 * and is finished with the question. The studio lets a person choose, which
 * surfaces the thing that comment in `models.ts` was written about: OpenAI's
 * image models reject `aspectRatio` and fall back to their own default size
 * without saying so. A 9:16 asked of gpt-image-2 came back square — not
 * refused, just square — so the vocabulary is declared per sizing kind here and
 * nothing offers a shape its model cannot render.
 */
export type ShapeSpec =
  | { kind: "aspect_ratio"; aspectRatio: AspectRatio }
  | { kind: "pixel_size"; size: PixelSize };

/**
 * Every shape the studio knows how to name, across both kinds of model. No
 * model offers all six; `supportedRatios` says which of them one will take.
 */
export const ASPECT_RATIOS = [
  "1:1",
  "4:5",
  "2:3",
  "3:2",
  "16:9",
  "9:16",
] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/** The longest an aspect ratio can be, for bounding it out of a request body. */
export const ASPECT_RATIO_MAX = 8;

export function isAspectRatio(value: string): value is AspectRatio {
  return (ASPECT_RATIOS as readonly string[]).includes(value);
}

/**
 * OpenAI's three published sizes. There is no fourth: 4:5, 16:9 and 9:16 have
 * no pixel size to translate into, which is why they are not offered for a
 * model that sizes this way rather than approximated into the nearest one.
 */
type PixelSize = "1024x1024" | "1024x1536" | "1536x1024";

const PIXEL_SIZES = {
  "1:1": "1024x1024",
  "2:3": "1024x1536",
  "3:2": "1536x1024",
} as const satisfies Partial<Record<AspectRatio, PixelSize>>;

/**
 * What each kind of model will take.
 *
 * `aspect_ratio` lists what the studio has always offered these models, which
 * is the correct parameter for them; whether each fal model's own ratio enum
 * accepts all four is a separate question this does not claim to answer.
 * `pixel_size` is exactly the set that has a size to send.
 */
const RATIOS_BY_SIZING: Record<ImageModelSizing, readonly AspectRatio[]> = {
  aspect_ratio: ["1:1", "4:5", "16:9", "9:16"],
  pixel_size: ["1:1", "2:3", "3:2"],
};

export function supportedRatios(model: ImageModel): readonly AspectRatio[] {
  return RATIOS_BY_SIZING[model.sizing];
}

/**
 * The shape spec to send, or null when this model cannot render this ratio —
 * which the caller is expected to refuse over, not paper over.
 */
export function shapeFor(
  ratio: AspectRatio,
  model: ImageModel,
): ShapeSpec | null {
  if (!supportedRatios(model).includes(ratio)) return null;

  if (model.sizing === "pixel_size") {
    const size = (PIXEL_SIZES as Partial<Record<AspectRatio, PixelSize>>)[ratio];
    return size ? { kind: "pixel_size", size } : null;
  }

  return { kind: "aspect_ratio", aspectRatio: ratio };
}

const ORIENTATION = {
  "1:1": "square",
  "4:5": "portrait",
  "2:3": "portrait",
  "9:16": "portrait",
  "3:2": "landscape",
  "16:9": "landscape",
} as const satisfies Record<AspectRatio, "square" | "portrait" | "landscape">;

/**
 * The closest shape this model can render to the one already chosen.
 *
 * Switching models must not silently restyle the picture from tall to wide, so
 * orientation is what carries over: a portrait stays a portrait even when its
 * exact ratio has no equivalent. Square is the floor, because every model has
 * one.
 */
export function nearestRatio(
  ratio: AspectRatio,
  model: ImageModel,
): AspectRatio {
  const offered = supportedRatios(model);
  if (offered.includes(ratio)) return ratio;

  return (
    offered.find((candidate) => ORIENTATION[candidate] === ORIENTATION[ratio]) ??
    "1:1"
  );
}
