import { generateImage } from "ai";
import { NextResponse } from "next/server";
import { AD_RUN_LIMITS } from "@/lib/ad-run-policy";
import { normalizeFontFamily } from "@/lib/font-family";
import {
  gatewayImageModel,
  hasGatewayConfiguration,
} from "@/lib/generate/gateway";
import { imageModelById, type ImageModelId } from "@/lib/generate/models";

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

/** Kept out of the model's way: the direction is the person's, not ours. */
function composePrompt(input: {
  prompt: string;
  brandName: string;
  colorA: string;
  colorB: string;
  fontFamily: string | null;
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
    "Advertising photography. No watermarks. Do not print any hex codes or colour names as text.",
  ].join("\n");
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

  try {
    const { image } = await generateImage({
      model: gatewayImageModel(model.id),
      prompt: composePrompt({
        prompt,
        brandName: text(body.brandName, AD_RUN_LIMITS.brandName) || "the brand",
        colorA: text(body.colorA, AD_RUN_LIMITS.promptColor),
        colorB: text(body.colorB, AD_RUN_LIMITS.promptColor),
        fontFamily: normalizeFontFamily(body.fontFamily),
      }),
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
