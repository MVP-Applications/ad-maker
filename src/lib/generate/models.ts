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
 * Cross-runtime Image Model catalog. Capabilities live with the model record.
 *
 * The segment before the first slash is the routing provider consumed by
 * `gatewayImageModel`; everything after it is the provider's own model path.
 *
 * `acceptsImage` is what drives tier membership. Only the two OpenAI models
 * take a reference image — the fal entries here are text-to-image endpoints,
 * whose editing variants live behind separate `/edit` paths — and a reference
 * is worth far more on a Product ad, where the real article can be shown, than
 * on a company ad. So the image-capable models sit in the secondary tier, which
 * renders Products. The cost is that company ads no longer receive the logo.
 */
export const IMAGE_MODELS = [
  {
    id: "fal/fal-ai/nano-banana-pro",
    tier: "primary",
    displayName: "Nano Banana Pro",
    acceptsImage: false,
    sizing: "aspect_ratio",
  },
  {
    id: "fal/xai/grok-imagine-image",
    tier: "primary",
    displayName: "Grok Imagine",
    acceptsImage: false,
    sizing: "aspect_ratio",
  },
  {
    id: "fal/fal-ai/bytedance/seedream/v4.5/text-to-image",
    tier: "primary",
    displayName: "Seedream 4.5",
    acceptsImage: false,
    sizing: "aspect_ratio",
  },
  {
    id: "openai/gpt-image-2",
    tier: "secondary",
    displayName: "GPT Image 2",
    acceptsImage: true,
    sizing: "pixel_size",
  },
  {
    id: "openai/gpt-image-1.5",
    tier: "secondary",
    displayName: "GPT Image 1.5",
    acceptsImage: true,
    sizing: "pixel_size",
  },
  {
    // Third Product slot: fal has no edit endpoint for Imagen, so this one
    // stays text-only and its Product ad is drawn from the description alone.
    id: "fal/fal-ai/imagen4/preview/ultra",
    tier: "secondary",
    displayName: "Imagen 4 Ultra",
    acceptsImage: false,
    sizing: "aspect_ratio",
  },
] as const satisfies readonly {
  id: string;
  tier: ImageModelTier;
  displayName: string;
  acceptsImage: boolean;
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
