import {
  AD_PRIMARY_MODEL_COUNT,
  AD_RUN_MAX_SIZE,
} from "@/lib/ad-run-policy";

export type ImageModelTier = "primary" | "secondary";

/**
 * How a provider wants a square asked for. OpenAI's image models reject
 * `aspectRatio` outright and silently fall back to their own default size;
 * fal's take `aspectRatio` and have no `size` parameter.
 */
export type ImageModelSizing = "aspect_ratio" | "pixel_size";

/**
 * How a model can be shown the one reference image, if at all.
 *
 * `native`   — the generation endpoint takes the image itself.
 * `fal_edit` — the image goes to fal's editing path over REST, because two
 *              things are true at once: fal's text-to-image endpoints accept an
 *              image field and then ignore it (a perfume bottle reference came
 *              back as a leather bag for an invented brand), and the AI SDK
 *              cannot reach the editing path, sending `image_url` where it
 *              requires `image_urls`. Direct REST reproduced the bottle exactly.
 * `none`     — text only.
 */
export type ImageReference =
  | { kind: "native" }
  | { kind: "fal_edit"; path: string }
  | { kind: "none" };

/** Can this model be shown a Product's photograph? */
export function takesProductPhoto(model: ImageModel): boolean {
  return model.reference.kind !== "none";
}

/**
 * What the editing endpoints take: fal documents fourteen reference images and
 * its own example passes two.
 */
const FAL_EDIT_MAX = 14;

/**
 * Two real photographs composed faithfully on gpt-image-1.5 — both bottles, own
 * caps, own labels, nothing invented. Beyond five is untested here and every one
 * costs upload size and latency, so this moves on evidence.
 */
const NATIVE_MAX = 5;

/** How many photographs this model can be shown at once. */
export function photographCapacity(model: ImageModel): number {
  switch (model.reference.kind) {
    case "none":
      return 0;
    case "fal_edit":
      return FAL_EDIT_MAX;
    case "native":
      return NATIVE_MAX;
  }
}

/**
 * Can this model be shown the brand's logo? Only where the image is a reference
 * for a new picture — an editing endpoint starts from what it is given, so a
 * logo sent to one returns a defaced logo rather than an advertisement.
 */
export function takesLogo(model: ImageModel): boolean {
  return model.reference.kind === "native";
}

/**
 * Cross-runtime Image Model catalog. Capabilities live with the model record.
 *
 * The segment before the first slash is the routing provider consumed by
 * `gatewayImageModel`; everything after it is the provider's own model path.
 *
 * Reference capability drives tier membership: a photograph is worth far more
 * on a Product ad, where the real article can be shown, than on a company ad.
 * The three models that can carry one hold the Product slots.
 */
export const IMAGE_MODELS = [
  {
    id: "openai/gpt-image-1.5",
    tier: "primary",
    displayName: "GPT Image 1.5",
    reference: { kind: "native" },
    sizing: "pixel_size",
  },
  {
    id: "fal/xai/grok-imagine-image",
    tier: "primary",
    displayName: "Grok Imagine",
    reference: { kind: "none" },
    sizing: "aspect_ratio",
  },
  {
    id: "fal/fal-ai/imagen4/preview/ultra",
    tier: "primary",
    displayName: "Imagen 4 Ultra",
    reference: { kind: "none" },
    sizing: "aspect_ratio",
  },
  {
    id: "openai/gpt-image-2",
    tier: "secondary",
    displayName: "GPT Image 2",
    reference: { kind: "native" },
    sizing: "pixel_size",
  },
  {
    id: "fal/fal-ai/nano-banana-pro",
    tier: "secondary",
    displayName: "Nano Banana Pro",
    reference: { kind: "fal_edit", path: "fal-ai/nano-banana-pro/edit" },
    sizing: "aspect_ratio",
  },
  {
    id: "fal/fal-ai/bytedance/seedream/v4.5/text-to-image",
    tier: "secondary",
    displayName: "Seedream 4.5",
    reference: {
      kind: "fal_edit",
      path: "fal-ai/bytedance/seedream/v4.5/edit",
    },
    sizing: "aspect_ratio",
  },
] as const satisfies readonly {
  id: string;
  tier: ImageModelTier;
  displayName: string;
  reference: ImageReference;
  sizing: ImageModelSizing;
}[];

export type ImageModel = (typeof IMAGE_MODELS)[number];
export type ImageModelId = ImageModel["id"];

const imageModelCount: typeof AD_RUN_MAX_SIZE = IMAGE_MODELS.length;

export const IMAGE_MODEL_IDS = IMAGE_MODELS.map(({ id }) => id) as [
  ImageModelId,
  ...ImageModelId[],
];

export function imageModelById(id: string): ImageModel | undefined {
  return IMAGE_MODELS.find((model) => model.id === id);
}

export function imageModelsByTier(tier: ImageModelTier): readonly ImageModel[] {
  return IMAGE_MODELS.filter((model) => model.tier === tier);
}

const primaryModelCount = imageModelsByTier("primary").length;
if (primaryModelCount !== AD_PRIMARY_MODEL_COUNT) {
  throw new Error(
    `Expected ${AD_PRIMARY_MODEL_COUNT} primary Image Models, received ${primaryModelCount}`,
  );
}

/** Assign every Image Model once, with primary placements before secondary ones. */
export function assignImageModels(
  random: () => number = Math.random,
): readonly ImageModelId[] {
  const shuffle = (models: readonly ImageModel[]) => {
    const result = [...models];
    for (let index = result.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  };

  const assigned = [
    ...shuffle(imageModelsByTier("primary")),
    ...shuffle(imageModelsByTier("secondary")),
  ].map(({ id }) => id);
  if (assigned.length !== imageModelCount) {
    throw new Error(`Expected ${imageModelCount} Image Models, received ${assigned.length}`);
  }
  return assigned;
}
