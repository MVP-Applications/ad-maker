import "server-only";

import { createFal } from "@ai-sdk/fal";
import { createOpenAI } from "@ai-sdk/openai";
import type { ImageModel, LanguageModel } from "ai";

/**
 * Direct provider keys, one per routing prefix used in the Image Model
 * catalog. Both are required: an Ad Run always spans OpenAI and fal.
 */
const REQUIRED_KEYS = ["OPENAI_API_KEY", "FAL_KEY"] as const;

export function hasGatewayConfiguration(): boolean {
  return REQUIRED_KEYS.every((name) => Boolean(process.env[name]?.trim()));
}

function apiKey(name: (typeof REQUIRED_KEYS)[number]): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("AI generation is not configured");
  return value;
}

/** Split "provider/rest/of/path" on the FIRST slash only — fal model paths
 * carry their own slashes and must survive intact. */
function route(model: string): { provider: string; path: string } {
  const slash = model.indexOf("/");
  if (slash < 1) throw new Error(`Model ${model} has no provider prefix`);
  return { provider: model.slice(0, slash), path: model.slice(slash + 1) };
}

export function gatewayTextModel(model: "openai/gpt-5.4-mini"): LanguageModel {
  return createOpenAI({ apiKey: apiKey("OPENAI_API_KEY") })(route(model).path);
}

export function gatewayImageModel(model: string): ImageModel {
  const { provider, path } = route(model);
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey: apiKey("OPENAI_API_KEY") }).imageModel(path);
    case "fal":
      return createFal({ apiKey: apiKey("FAL_KEY") }).imageModel(path);
    default:
      throw new Error(`No provider configured for ${provider}`);
  }
}

/**
 * fal's editing paths, over REST rather than the AI SDK.
 *
 * Two measured facts force this. fal's text-to-image endpoints accept an image
 * field and ignore it — an AEN perfume bottle handed to `nano-banana-pro` came
 * back as a leather bag for an invented brand — so a Product photo must reach
 * the `/edit` path to matter. And the AI SDK cannot reach it: it sends
 * `image_url` where those endpoints require `image_urls`, failing every call
 * with `body.image_urls: Field required`. The same request placed here returned
 * the bottle, unchanged, relit into the scene.
 *
 * Takes the photograph's URL rather than its bytes, which is what fal wants
 * anyway. Callers validate that URL first; nothing unvalidated reaches here.
 */
const FAL_REST = "https://fal.run";
const FAL_RESULT_MAX_BYTES = 25 * 1024 * 1024;

export type FalEditRequest = {
  path: string;
  prompt: string;
  imageUrl: string;
  aspectRatio: "1:1";
};

function statusError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export async function falEditImage(
  request: FalEditRequest,
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; mediaType: string }> {
  const response = await fetch(`${FAL_REST}/${request.path}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey("FAL_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: request.prompt,
      image_urls: [request.imageUrl],
      aspect_ratio: request.aspectRatio,
      num_images: 1,
    }),
    signal,
  });

  if (!response.ok) {
    throw statusError(
      `fal ${request.path} returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
      response.status,
    );
  }

  const body = (await response.json()) as {
    images?: { url?: unknown; content_type?: unknown }[];
  };
  const image = body.images?.[0];
  if (typeof image?.url !== "string") {
    throw statusError(`fal ${request.path} returned no image`, 502);
  }

  const rendered = await fetch(image.url, { signal });
  if (!rendered.ok) {
    throw statusError(
      `fal result fetch returned HTTP ${rendered.status}`,
      rendered.status,
    );
  }
  const bytes = new Uint8Array(await rendered.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > FAL_RESULT_MAX_BYTES) {
    throw statusError(`fal result was ${bytes.byteLength} bytes`, 502);
  }

  return {
    bytes,
    mediaType:
      typeof image.content_type === "string"
        ? image.content_type
        : (rendered.headers.get("content-type") ?? "image/png"),
  };
}

export type GatewayImageFailure =
  | { kind: "transient" }
  | { kind: "image_input_rejected" }
  | { kind: "nontransient" }
  | { kind: "aborted" };

function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current) && chain.length < 6) {
    seen.add(current);
    chain.push(current);
    const record = current as { lastError?: unknown; cause?: unknown };
    current = record.lastError ?? record.cause;
  }
  return chain;
}

/** Normalize provider-specific Gateway errors for the Rendered Ad module. */
export function classifyGatewayImageError(
  error: unknown,
  hadLogo: boolean,
  signal?: AbortSignal,
): GatewayImageFailure {
  const chain = errorChain(error);
  const text = chain
    .map((entry) => (entry as { message?: unknown }).message)
    .filter((message): message is string => typeof message === "string")
    .join(" ")
    .toLowerCase();

  if (
    signal?.aborted ||
    chain.some(
      (entry) =>
        (entry as { name?: unknown }).name === "AbortError" ||
        (entry as { reason?: unknown }).reason === "abort",
    )
  ) {
    return { kind: "aborted" };
  }

  const status = chain
    .map((entry) => {
      const record = entry as { status?: unknown; statusCode?: unknown };
      return record.status ?? record.statusCode;
    })
    .find((value): value is number => typeof value === "number");

  if (
    hadLogo &&
    (status === 404 ||
      /image input|input image|image edit|editing|does not support.{0,30}image|unsupported.{0,30}image|not found/.test(
        text,
      ))
  ) {
    return { kind: "image_input_rejected" };
  }

  if (
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    /fetch failed|timed? ?out|timeout|econn|socket hang up|network error/.test(text)
  ) {
    return { kind: "transient" };
  }

  return { kind: "nontransient" };
}
