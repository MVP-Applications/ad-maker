import { generateImage as generateImageWithAi } from "ai";
import type { RenderedAdQuery } from "@/lib/ad-run";
import { fetchPublicRaster, type PublicRaster } from "@/lib/public-raster";
import { buildConceptPrompt } from "./concepts";
import {
  classifyGatewayImageError,
  gatewayImageModel,
  hasGatewayConfiguration,
  type GatewayImageFailure,
} from "./gateway";
import {
  imageModelById,
  type ImageModelId,
  type ImageModelSizing,
} from "./models";
import type { CreativeDirectionKey } from "./directions";

export type RenderedAdMediaType = "image/png" | "image/jpeg" | "image/webp";

export type RenderedAd = {
  bytes: Uint8Array;
  mediaType: RenderedAdMediaType;
  concept: CreativeDirectionKey;
  model: ImageModelId;
};

export type RenderAdFailure =
  | { code: "not_configured" }
  | { code: "generation_failed"; retryable: boolean }
  | { code: "aborted" };

export type RenderAdResult =
  | { ok: true; value: RenderedAd }
  | { ok: false; error: RenderAdFailure };

export type ImageGenerationFailure = GatewayImageFailure;

/**
 * Every Rendered Ad is square. Providers disagree on how to ask: the shape is
 * carried as one discriminated spec so exactly one parameter is ever sent, and
 * a provider can never silently fall back to its own default size.
 */
export type SquareSpec =
  | { kind: "aspect_ratio"; aspectRatio: "1:1" }
  | { kind: "pixel_size"; size: "1024x1024" };

const SQUARE: Record<ImageModelSizing, SquareSpec> = {
  aspect_ratio: { kind: "aspect_ratio", aspectRatio: "1:1" },
  pixel_size: { kind: "pixel_size", size: "1024x1024" },
};

export type ImageQuality = "medium" | "high";

/**
 * Fine material detail is what this setting buys, and it is what a Product ad
 * spends it on: NuPhy's WH80 came back with its transparent keycaps rendered
 * solid at medium, having got the case, light bar and layout right. Refraction,
 * micro-texture and small markings are the first things to degrade. Company ads
 * stay at medium — they carry no article whose materials have to survive.
 */
const qualityFor = (query: RenderedAdQuery): ImageQuality =>
  query.subject.kind === "product" && query.subject.imageUrl ? "high" : "medium";

export type ImageGenerationRequest = {
  model: ImageModelId;
  prompt: string;
  logo: PublicRaster | null;
  square: SquareSpec;
  quality: ImageQuality;
};

export type ImageGenerationResult =
  | {
      ok: true;
      value: { bytes: Uint8Array; mediaType: RenderedAdMediaType };
    }
  | { ok: false; error: ImageGenerationFailure };

export type AdRendererDependencies = {
  isReady(): boolean;
  generateImage(
    request: ImageGenerationRequest,
    signal?: AbortSignal,
  ): Promise<ImageGenerationResult>;
  loadRaster(url: string, signal?: AbortSignal): Promise<PublicRaster | null>;
  sleep(milliseconds: number, signal?: AbortSignal): Promise<void>;
};

export type AdRenderer = {
  render(query: RenderedAdQuery, signal?: AbortSignal): Promise<RenderAdResult>;
};

const LOGO_INSTRUCTION = (brandName: string) =>
  `The attached image is ${brandName}'s REAL logo mark. Where the wordmark/logo appears, reproduce this exact mark faithfully — do not redraw, restyle, or hallucinate a different logo.`;

/**
 * The direction above describes a scene in the brand's colours, and a Product
 * ad supplies the real article — read together they say "recolour this". They
 * did: a white keyboard came back tinted brand-teal with its chamfered edge
 * flattened, because a single-hue render deletes the contrast an edge is made
 * of. So the palette is scoped to the scene here, last, where it wins.
 */
const PRODUCT_INSTRUCTION = (productName: string) =>
  [
    `The attached image is the REAL ${productName}. The product shown in this ad MUST be this exact article — match its silhouette, proportions, panel edges, materials, finish and markings faithfully. Study the reference and reproduce its geometry; never redesign it, never substitute a similar-looking product, and never invent surface details it does not have.`,
    `COLOUR OVERRIDE — this outranks the palette instructions above: the brand colours apply to the BACKGROUND, the lighting, and the TYPOGRAPHY only. The product itself keeps its own real colours and materials exactly as photographed. Do not tint, recolour, or restyle it to match the palette.`,
  ].join("\n\n");

/** What one reference image is, so the prompt can say so. */
type Reference = { raster: PublicRaster; instruction: string };

const TRANSIENT_DELAYS = [800, 1800] as const;

const failed = (retryable: boolean): RenderAdResult => ({
  ok: false,
  error: { code: "generation_failed", retryable },
});

export function createAdRenderer(dependencies: AdRendererDependencies): AdRenderer {
  return {
    async render(query, signal) {
      if (signal?.aborted) return { ok: false, error: { code: "aborted" } };

      let ready = false;
      try {
        ready = dependencies.isReady();
      } catch {
        // Configuration checks are intentionally converted to the same safe result.
      }
      if (!ready) return { ok: false, error: { code: "not_configured" } };

      const model = imageModelById(query.model);
      if (!model) return failed(false);

      const promptInput = {
        brandName: query.brandName,
        domain: query.domain,
        summary: query.summary,
        industry: query.industry,
        mood: query.mood,
        fontFamily: query.fontFamily,
        colorA: query.colorA,
        colorB: query.colorB,
        subject: query.subject,
        headline: query.headline,
        subheadline: query.subheadline,
      };
      const basePrompt = buildConceptPrompt(query.concept, promptInput);

      // One reference image per render. A Product ad spends it on the product
      // itself — showing the real article beats reproducing the wordmark on an
      // ad whose whole subject is that article. Company ads still get the logo.
      const candidate =
        query.subject.kind === "product" && query.subject.imageUrl
          ? { url: query.subject.imageUrl, instruction: PRODUCT_INSTRUCTION(query.subject.name) }
          : query.logoUrl
            ? { url: query.logoUrl, instruction: LOGO_INSTRUCTION(query.brandName) }
            : null;

      let reference: Reference | null = null;
      if (model.acceptsImage && candidate) {
        try {
          const raster = await dependencies.loadRaster(candidate.url, signal);
          if (raster) reference = { raster, instruction: candidate.instruction };
        } catch {
          // A reference is enrichment, never a reason to lose the Rendered Ad.
        }
        if (signal?.aborted) return { ok: false, error: { code: "aborted" } };
      }

      let logo: PublicRaster | null = reference?.raster ?? null;
      let prompt = reference ? `${basePrompt}\n\n${reference.instruction}` : basePrompt;
      let logoDowngraded = false;
      let transientFailures = 0;

      for (;;) {
        if (signal?.aborted) return { ok: false, error: { code: "aborted" } };

        let generated: ImageGenerationResult;
        try {
          generated = await dependencies.generateImage(
            {
              model: query.model,
              prompt,
              logo,
              square: SQUARE[model.sizing],
              quality: qualityFor(query),
            },
            signal,
          );
        } catch {
          if (signal?.aborted) return { ok: false, error: { code: "aborted" } };
          return failed(false);
        }

        if (generated.ok) {
          return {
            ok: true,
            value: {
              ...generated.value,
              concept: query.concept,
              model: query.model,
            },
          };
        }

        if (generated.error.kind === "aborted" || signal?.aborted) {
          return { ok: false, error: { code: "aborted" } };
        }

        if (
          generated.error.kind === "image_input_rejected" &&
          logo !== null &&
          !logoDowngraded
        ) {
          logo = null;
          prompt = basePrompt;
          logoDowngraded = true;
          continue;
        }

        if (generated.error.kind !== "transient") return failed(false);
        if (transientFailures >= TRANSIENT_DELAYS.length) return failed(true);

        const delay = TRANSIENT_DELAYS[transientFailures++];
        try {
          await dependencies.sleep(delay, signal);
        } catch {
          if (signal?.aborted) return { ok: false, error: { code: "aborted" } };
          return failed(true);
        }
      }
    },
  };
}

function mediaType(value: string | undefined): RenderedAdMediaType | null {
  if (value === undefined) return "image/png";
  const normalized = value.toLowerCase().split(";", 1)[0].trim();
  return normalized === "image/png" ||
    normalized === "image/jpeg" ||
    normalized === "image/webp"
    ? normalized
    : null;
}

async function generateImage(
  request: ImageGenerationRequest,
  signal?: AbortSignal,
): Promise<ImageGenerationResult> {
  try {
    const { image } = await generateImageWithAi({
      model: gatewayImageModel(request.model),
      prompt: request.logo
        ? { text: request.prompt, images: [request.logo.bytes] }
        : request.prompt,
      ...(request.square.kind === "pixel_size"
        ? { size: request.square.size }
        : { aspectRatio: request.square.aspectRatio }),
      providerOptions: { openai: { quality: request.quality } },
      maxRetries: 0,
      abortSignal: signal,
    });

    const outputMediaType = mediaType(image.mediaType);
    const bytes = Uint8Array.from(Buffer.from(image.base64, "base64"));
    if (!outputMediaType || bytes.byteLength === 0) {
      return { ok: false, error: { kind: "nontransient" } };
    }
    return { ok: true, value: { bytes, mediaType: outputMediaType } };
  } catch (error) {
    return {
      ok: false,
      error: classifyGatewayImageError(error, request.logo !== null, signal),
    };
  }
}

function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }

    const timer = setTimeout(done, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason ?? new Error("Aborted"));
    };
    function done() {
      signal?.removeEventListener("abort", abort);
      resolve();
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export const adRenderer = createAdRenderer({
  isReady: hasGatewayConfiguration,
  generateImage,
  loadRaster: fetchPublicRaster,
  sleep,
});
