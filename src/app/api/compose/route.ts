import { generateImage } from "ai";
import { NextResponse } from "next/server";
import { AD_RUN_LIMITS } from "@/lib/ad-run-policy";
import { normalizeFontFamily } from "@/lib/font-family";
import {
  buildDirectedPrompt,
  resolveProducts,
  type ArtContext,
  type CatalogProduct,
} from "@/lib/generate/art-plan";
import { directArtwork } from "@/lib/generate/director";
import {
  manyArticlesFidelity,
  oneArticleFidelity,
} from "@/lib/generate/fidelity";
import {
  falEditImage,
  gatewayImageModel,
  hasGatewayConfiguration,
} from "@/lib/generate/gateway";
import {
  imageModelById,
  photographCapacity,
  type ImageModel,
  type ImageModelId,
} from "@/lib/generate/models";
import {
  ASPECT_RATIO_MAX,
  isAspectRatio,
  shapeFor,
} from "@/lib/generate/shape";
import { fetchPublicRaster } from "@/lib/public-raster";
import { parsePublicHttpUrl } from "@/lib/public-url";

/**
 * POST /api/compose — one image from a person's own words.
 *
 * The planned Ad Run answers "advertise this brand" and decides the six concepts
 * itself. This answers a different question — "make me this" — so the words lead
 * and the brand follows.
 *
 * What sits between the two is the art director. This route used to hand an
 * image model the request and every fact it held about the named Products, in
 * one flat block, and a price and a catalogue description travelled as quoted
 * strings beside the brand name. Image models render quoted strings, so every
 * composed ad came back with its price stamped across it. Now a reasoning model
 * decides what the picture is and, crucially, the exact list of strings it may
 * contain; the facts still travel, fenced as knowledge rather than as copy.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const PROMPT_MAX = 1200;

const NO_STORE = {
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
};

const fail = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: NO_STORE });

/**
 * How many Products one image may name.
 *
 * A ceiling on the picture rather than on any model — fal's editing path takes
 * fourteen references and gpt-image five, but an advertisement holding five
 * distinct articles is already crowded, and each one costs upload size and
 * latency. Raise it when an image wants it, not because a provider allows it.
 */
const MENTION_MAX = 5;

/**
 * How much of the shop the director may read.
 *
 * Named Products are the person's own choice and always travel. This is the
 * rest — what a request like "an ad for our bestsellers" gets to choose from —
 * and it is bounded here rather than at the director because a 680-product
 * catalogue reaching a request body is a payload problem before it is a
 * prompting one.
 */
const CATALOG_MAX = 24;

/**
 * One Product and the photograph of it that will travel with the prompt.
 *
 * Both forms of the same picture: `bytes` rides along with the prompt on a model
 * that takes one, and `url` is what fal's editing path is given, which is the
 * only way those models look at a reference at all.
 */
type Photographed = {
  product: CatalogProduct;
  bytes: Uint8Array;
  url: string;
};

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Bounded the same way the rest of this route is: shape first, trust never. */
function catalogProducts(value: unknown, limit: number): CatalogProduct[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const raw = entry as Record<string, unknown>;
      const name = text(raw.name, AD_RUN_LIMITS.productName);
      if (!name) return [];

      const price = raw.price;
      return [
        {
          name,
          description: text(raw.description, AD_RUN_LIMITS.productDescription),
          imageUrl:
            typeof raw.imageUrl === "string"
              ? (parsePublicHttpUrl(raw.imageUrl)?.href ?? null)
              : null,
          price:
            typeof price === "number" &&
            Number.isFinite(price) &&
            price >= 0 &&
            price <= AD_RUN_LIMITS.price
              ? price
              : null,
          currency: text(raw.currency, AD_RUN_LIMITS.currency) || null,
        },
      ];
    })
    .slice(0, limit);
}

/**
 * The photographs, each still holding on to the Product it shows.
 *
 * Naming a Product stops the model inventing its name; only the photograph stops
 * it inventing the article. Loaded through the same public-raster check the Ad
 * Run uses, and a photo that will not load costs its Product a likeness rather
 * than costing the image — which is exactly why the pairing is carried rather
 * than the position: the Products that drop out here are not the ones the prompt
 * would have counted past.
 */
async function loadPhotographs(
  model: ImageModel,
  products: readonly CatalogProduct[],
  signal: AbortSignal,
): Promise<Photographed[]> {
  const capacity = photographCapacity(model);
  if (capacity === 0) return [];

  const loaded = await Promise.all(
    products.map(async (product) => {
      if (!product.imageUrl) return null;
      try {
        // Loaded even where only the URL is sent onward: this is the check that
        // the address is a public, size-bounded raster, and it must run either
        // way. Null for a URL the policy turned down, which costs the same as a
        // throw here: a Product named in words but not shown.
        const raster = await fetchPublicRaster(product.imageUrl, signal);
        return raster
          ? { product, bytes: raster.bytes, url: product.imageUrl }
          : null;
      } catch {
        return null;
      }
    }),
  );

  // Beyond what the model can be shown, a Product keeps its name and loses its
  // likeness — which the prompt then says plainly rather than attaching a
  // photograph the model was never going to look at.
  return loaded.flatMap((entry) => (entry ? [entry] : [])).slice(0, capacity);
}

/**
 * The director's reasoning, carried back beside the picture.
 *
 * Headers rather than a JSON envelope because the body is the image itself and
 * always has been. Percent-encoded because a rationale written for an Arabic
 * shop is not latin-1, and a header that is not latin-1 throws rather than
 * degrades.
 */
const directionHeaders = (input: {
  adType: string;
  direction: string;
  rationale: string;
}) => ({
  "X-Ad-Type": encodeURIComponent(input.adType),
  "X-Ad-Direction": encodeURIComponent(input.direction),
  "X-Ad-Rationale": encodeURIComponent(input.rationale),
});

export async function POST(req: Request) {
  if (!hasGatewayConfiguration()) {
    return fail("Image generation is not configured.", 503);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("Send a JSON body.", 400);
  }

  const prompt = text(body.prompt, PROMPT_MAX);
  if (!prompt) return fail("Describe the image you want first.", 400);

  const requested = text(body.model, AD_RUN_LIMITS.imageModelId);
  const model = imageModelById(requested as ImageModelId);
  if (!model) return fail("Unknown image model.", 400);

  /**
   * The shape, refused rather than approximated when this model has no way to
   * render it. Silently returning a square from a request for a 9:16 is the
   * behaviour this replaces.
   */
  const askedRatio = text(body.aspectRatio, ASPECT_RATIO_MAX);
  const ratio = isAspectRatio(askedRatio) ? askedRatio : "1:1";
  const shape = shapeFor(ratio, model);
  if (!shape) {
    return fail(`${model.displayName} cannot render ${ratio}.`, 400);
  }

  const named = catalogProducts(body.products, MENTION_MAX);
  const context: ArtContext = {
    request: prompt,
    brandName: text(body.brandName, AD_RUN_LIMITS.brandName) || "the brand",
    domain: text(body.domain, AD_RUN_LIMITS.domain),
    industry: text(body.industry, AD_RUN_LIMITS.industry),
    summary: text(body.summary, AD_RUN_LIMITS.summary),
    mood: text(body.mood, AD_RUN_LIMITS.mood),
    colorA: text(body.colorA, AD_RUN_LIMITS.promptColor),
    colorB: text(body.colorB, AD_RUN_LIMITS.promptColor),
    fontFamily: normalizeFontFamily(body.fontFamily),
    audience: text(body.audience, AD_RUN_LIMITS.audience),
    language: text(body.language, AD_RUN_LIMITS.language),
    named,
    catalog: catalogProducts(body.catalog, CATALOG_MAX),
    aspectRatio: ratio,
    photographCapacity: Math.min(photographCapacity(model), MENTION_MAX),
  };

  let plan;
  try {
    plan = await directArtwork(context, req.signal);
  } catch {
    if (req.signal.aborted) return fail("Cancelled.", 499);
    return fail("That image failed to render. Try again.", 502);
  }

  /**
   * Which Products the picture actually holds is the director's answer, not the
   * request's: a person who named none may still get a range, and one who named
   * three may be given a hero and two supporting articles. The photographs are
   * loaded after that decision because the numbering in the prompt counts them.
   */
  const subjects = resolveProducts(
    [...plan.heroProducts, ...plan.supportingProducts],
    context,
  ).slice(0, MENTION_MAX);

  const photographs = await loadPhotographs(model, subjects, req.signal);
  const shown = new Set(photographs.map(({ product }) => product));

  /**
   * One article gets the Ad Run's own wording rather than a plural rewrite of
   * it: that is the sentence with the most evidence behind it.
   */
  const fidelity =
    photographs.length === 1
      ? oneArticleFidelity(photographs[0].product.name)
      : photographs.length > 1
        ? manyArticlesFidelity(photographs.length)
        : "";

  const composed = buildDirectedPrompt({
    plan,
    context,
    photographed: photographs.map(({ product }) => product),
    described: subjects.filter((product) => !shown.has(product)),
    fidelity,
  });

  const headers = {
    ...NO_STORE,
    ...directionHeaders(plan),
  };

  try {
    /**
     * fal's editing path, for the models that reach a reference no other way.
     * The Ad Run has sent one product photograph down it since it was written,
     * and gets the real article back; the AI SDK cannot reach it, so this is a
     * direct REST call that answers with the finished bytes rather than a
     * generation result.
     */
    if (model.reference.kind === "fal_edit" && photographs.length > 0) {
      const edited = await falEditImage(
        {
          path: model.reference.path,
          prompt: composed,
          imageUrls: photographs.map(({ url }) => url),
          aspectRatio:
            shape.kind === "aspect_ratio" ? shape.aspectRatio : "1:1",
        },
        req.signal,
      );

      if (edited.bytes.byteLength === 0) {
        return fail("The model returned nothing.", 502);
      }

      return new NextResponse(Buffer.from(edited.bytes), {
        headers: {
          "Content-Type": edited.mediaType || "image/png",
          ...headers,
        },
      });
    }

    const { image } = await generateImage({
      model: gatewayImageModel(model.id),
      prompt:
        photographs.length > 0
          ? { text: composed, images: photographs.map(({ bytes }) => bytes) }
          : composed,
      ...(shape.kind === "pixel_size"
        ? { size: shape.size }
        : { aspectRatio: shape.aspectRatio }),
      /**
       * Fine material detail is what this buys, and a photographed article is
       * what spends it: NuPhy's WH80 came back with its transparent keycaps
       * rendered solid at medium, having got the case, light bar and layout
       * right. Refraction, micro-texture and small markings degrade first, and
       * they are exactly what makes a reproduced article recognisable.
       */
      providerOptions: {
        openai: { quality: photographs.length > 0 ? "high" : "medium" },
      },
      maxRetries: 0,
      abortSignal: req.signal,
    });

    const bytes = Uint8Array.from(Buffer.from(image.base64, "base64"));
    if (bytes.byteLength === 0) return fail("The model returned nothing.", 502);

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": image.mediaType ?? "image/png",
        ...headers,
      },
    });
  } catch (cause) {
    if (req.signal.aborted) return fail("Cancelled.", 499);
    console.error("[compose] render failed:", cause);
    return fail("That image failed to render. Try again.", 502);
  }
}
