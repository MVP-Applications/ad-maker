import { generateImage } from "ai";
import { NextResponse } from "next/server";
import { AD_RUN_LIMITS } from "@/lib/ad-run-policy";
import { normalizeFontFamily } from "@/lib/font-family";
import {
  gatewayImageModel,
  hasGatewayConfiguration,
} from "@/lib/generate/gateway";
import {
  imageModelById,
  takesProductPhoto,
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
 * The planned Ad Run answers "advertise this brand" and decides the six
 * concepts itself. This answers a different question — "make me this" — so it
 * takes the direction as typed and only supplies what the person should not
 * have to retype: the brand's name, its two colours, and its typeface. The
 * words lead; the brand follows.
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
 * Two real photographs composed faithfully on gpt-image-1.5 — both bottles, own
 * caps, own labels, nothing invented. Ten is untested and every one costs upload
 * size and latency, so the ceiling starts here and moves on evidence.
 */
const MENTION_MAX = 5;

/** The subset of a catalogue entry an image needs. */
type MentionedProduct = {
  name: string;
  description: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
};

/** One Product and the photograph of it that will travel with the prompt. */
type Photographed = { product: MentionedProduct; bytes: Uint8Array };

/** Name, price and description on one line, however the Product is being shown. */
function productLine(product: MentionedProduct): string {
  const price =
    product.price !== null && product.currency
      ? ` (${product.currency} ${product.price})`
      : "";
  return `"${product.name}"${price} — ${product.description}`;
}

/**
 * The Products the person named, stated as the only ones that exist.
 *
 * Without this the model invents: "an ad for 5 perfumes" against a shop with 107
 * of them produced five bottles named Noir Essence, Royal Oud and Bella Rose,
 * none of which nouvona.com sells. Naming the real ones — and saying plainly
 * that they are the only ones — is what stops that.
 *
 * The photographed ones are numbered against the attachments themselves rather
 * than against the list, because the two disagree the moment a Product has no
 * photograph on file or its photograph fails to load. A single numbering across
 * both claimed the second attachment was the second name; name three, photograph
 * the first and third, and the model is being told the second bottle it can see
 * is called what the second name says — which is the labelling this whole block
 * exists to prevent.
 */
function productLines(
  photographed: readonly MentionedProduct[],
  described: readonly MentionedProduct[],
): string {
  const total = photographed.length + described.length;
  if (total === 0) return "";

  return [
    `THE PRODUCTS IN THIS IMAGE — exactly these ${total}, and no others:`,
    ...photographed.map(
      (product, index) => `Photograph ${index + 1} is ${productLine(product)}`,
    ),
    ...described.map(
      (product) =>
        `${productLine(product)} (no photograph supplied — build it from this description alone).`,
    ),
    photographed.length > 0
      ? `Each attached photograph is the REAL article, and the numbering above says which photograph is which Product. Reproduce each one exactly as photographed — its shape, cap, label, materials and colours. Never substitute a similar-looking product, never invent an extra one, and never redraw a label.`
      : "",
    `Do not add any product that is not listed above, and do not invent names, brands or claims for them.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Three rules every composed image closes with, adapted from the image-ad
 * prompt library in arcads-claude-code (MIT).
 *
 * None of them is creative direction — the direction is the person's, and these
 * do not touch it. Each forbids one thing the model was never asked for and
 * reaches for anyway, and each is a failure that shows up across every current
 * image model rather than on one provider.
 */
const GUARDRAILS = [
  // Asked for an ad, a model will hand back a picture of a phone showing one.
  `Render the advertisement itself, edge to edge — not a screenshot of one sitting in a feed. No app or platform interface of any kind: no profile row, avatar, handle or Sponsored label; no caption or post text; no like, comment, share or save buttons; no engagement counts; no navigation or tab bars; no story progress bars; no phone, browser or device chrome.`,
  // A headline is worth nothing with its last two letters past the canvas.
  `Keep every piece of text and every focal subject within the central 84% of the canvas, leaving roughly 8% clear on all four sides. Backgrounds and fields of colour may run to the edge; words and subjects may not touch or cross it. If a subject will not fit, scale it down — never crop the text.`,
  // Both halves of one habit: treating text as texture rather than as language.
  `Inside any block of text, use plain words only — no emoji, no decorative unicode, no stray symbols mid-sentence. Where this prompt states a count, render exactly that many: nothing extra invented, nothing left out.`,
];

/** Kept out of the model's way: the direction is the person's, not ours. */
function composePrompt(input: {
  prompt: string;
  brandName: string;
  colorA: string;
  colorB: string;
  fontFamily: string | null;
  photographed: readonly MentionedProduct[];
  described: readonly MentionedProduct[];
}): string {
  const brand = [
    `Brand: ${input.brandName}.`,
    input.colorA && input.colorB
      ? `Brand colours: ${input.colorA} and ${input.colorB}.`
      : "",
    input.fontFamily ? `Typography echoes ${input.fontFamily}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    input.prompt.trim(),
    "",
    brand,
    productLines(input.photographed, input.described),
    "Advertising photography. No watermarks. Do not print any hex codes or colour names as text.",
    ...GUARDRAILS,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Bounded the same way the rest of this route is: shape first, trust never. */
function mentionedProducts(value: unknown): MentionedProduct[] {
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
    .slice(0, MENTION_MAX);
}

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/**
 * The photographs, each still holding on to the Product it shows.
 *
 * Naming a Product stops the model inventing its name; only the photograph
 * stops it inventing the article. Loaded through the same public-raster check
 * the Ad Run uses, and a photo that will not load costs its Product a likeness
 * rather than costing the image — which is exactly why the pairing is carried
 * rather than the position: the Products that drop out here are not the ones
 * the prompt would have counted past.
 */
async function loadPhotographs(
  model: ImageModel,
  products: readonly MentionedProduct[],
  signal: AbortSignal,
): Promise<Photographed[]> {
  if (!takesProductPhoto(model) || model.reference.kind !== "native") return [];

  const loaded = await Promise.all(
    products.map(async (product) => {
      if (!product.imageUrl) return null;
      try {
        // Null for a URL the policy turned down, which costs the same as a
        // throw here: a Product named in words but not shown.
        const raster = await fetchPublicRaster(product.imageUrl, signal);
        return raster ? { product, bytes: raster.bytes } : null;
      } catch {
        return null;
      }
    }),
  );

  return loaded.flatMap((entry) => (entry ? [entry] : []));
}

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

  const products = mentionedProducts(body.products);

  // Composed after the photographs, because which Products have one is what
  // the numbering in the prompt is counting.
  const photographs = await loadPhotographs(model, products, req.signal);
  const shown = new Set(photographs.map(({ product }) => product));

  const composed = composePrompt({
    prompt,
    brandName: text(body.brandName, AD_RUN_LIMITS.brandName) || "the brand",
    colorA: text(body.colorA, AD_RUN_LIMITS.promptColor),
    colorB: text(body.colorB, AD_RUN_LIMITS.promptColor),
    fontFamily: normalizeFontFamily(body.fontFamily),
    photographed: photographs.map(({ product }) => product),
    described: products.filter((product) => !shown.has(product)),
  });

  try {
    const { image } = await generateImage({
      model: gatewayImageModel(model.id),
      prompt:
        photographs.length > 0
          ? { text: composed, images: photographs.map(({ bytes }) => bytes) }
          : composed,
      ...(shape.kind === "pixel_size"
        ? { size: shape.size }
        : { aspectRatio: shape.aspectRatio }),
      maxRetries: 0,
      abortSignal: req.signal,
    });

    const bytes = Uint8Array.from(Buffer.from(image.base64, "base64"));
    if (bytes.byteLength === 0) return fail("The model returned nothing.", 502);

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": image.mediaType ?? "image/png",
        ...NO_STORE,
      },
    });
  } catch (cause) {
    if (req.signal.aborted) return fail("Cancelled.", 499);
    console.error("[compose] render failed:", cause);
    return fail("That image failed to render. Try again.", 502);
  }
}
