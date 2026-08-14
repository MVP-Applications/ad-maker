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
  type ImageModelId,
} from "@/lib/generate/models";
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

/**
 * The Products the person named, stated as the only ones that exist.
 *
 * Without this the model invents: "an ad for 5 perfumes" against a shop with 107
 * of them produced five bottles named Noir Essence, Royal Oud and Bella Rose,
 * none of which nouvona.com sells. Naming the real ones — and saying plainly
 * that they are the only ones — is what stops that.
 */
function productLines(products: readonly MentionedProduct[]): string {
  if (products.length === 0) return "";

  const listed = products.map((product, index) => {
    const price =
      product.price !== null && product.currency
        ? ` (${product.currency} ${product.price})`
        : "";
    return `${index + 1}. "${product.name}"${price} — ${product.description}`;
  });

  const photographed = products.filter(({ imageUrl }) => imageUrl).length;

  return [
    `THE PRODUCTS IN THIS IMAGE — exactly these ${products.length}, and no others:`,
    ...listed,
    photographed > 0
      ? `The ${photographed === products.length ? "attached photographs are" : "attached photographs are"} the REAL articles, in the order listed. Reproduce each one exactly as photographed — its shape, cap, label, materials and colours. Never substitute a similar-looking product, never invent an extra one, and never redraw a label.`
      : "",
    `Do not add any product that is not listed above, and do not invent names, brands or claims for them.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Kept out of the model's way: the direction is the person's, not ours. */
function composePrompt(input: {
  prompt: string;
  brandName: string;
  colorA: string;
  colorB: string;
  fontFamily: string | null;
  products: readonly MentionedProduct[];
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
    productLines(input.products),
    "Advertising photography. No watermarks. Do not print any hex codes or colour names as text.",
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

  const aspectRatio = ["1:1", "16:9", "9:16", "4:5"].includes(
    text(body.aspectRatio, 8),
  )
    ? text(body.aspectRatio, 8)
    : "1:1";

  const products = mentionedProducts(body.products);
  const composed = composePrompt({
    prompt,
    brandName: text(body.brandName, AD_RUN_LIMITS.brandName) || "the brand",
    colorA: text(body.colorA, AD_RUN_LIMITS.promptColor),
    colorB: text(body.colorB, AD_RUN_LIMITS.promptColor),
    fontFamily: normalizeFontFamily(body.fontFamily),
    products,
  });

  /**
   * The photographs, in the order the Products were named.
   *
   * Naming a Product stops the model inventing its name; only the photograph
   * stops it inventing the article. Loaded through the same public-raster check
   * the Ad Run uses, and a photo that will not load costs its Product a likeness
   * rather than costing the image.
   */
  const photographs =
    takesProductPhoto(model) && model.reference.kind === "native"
      ? (
          await Promise.all(
            products.map(async ({ imageUrl }) => {
              if (!imageUrl) return null;
              try {
                return await fetchPublicRaster(imageUrl, req.signal);
              } catch {
                return null;
              }
            }),
          )
        ).flatMap((raster) => (raster ? [raster.bytes] : []))
      : [];

  try {
    const { image } = await generateImage({
      model: gatewayImageModel(model.id),
      prompt:
        photographs.length > 0
          ? { text: composed, images: photographs }
          : composed,
      aspectRatio: aspectRatio as `${number}:${number}`,
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
