import { z } from "zod";
import {
  normalizeBrandColorHex,
  type BrandColor,
} from "@/lib/brand-color";
import { normalizeFontFamily } from "@/lib/font-family";
import type { Product } from "@/lib/ad-run";
import {
  AD_CATALOG_MAX,
  AD_PRODUCT_CONCEPT_MIN,
  AD_RUN_LIMITS,
} from "@/lib/ad-run-policy";
import { parsePublicHttpUrl } from "@/lib/public-url";

/**
 * Brand research, served by the brand-extractor service.
 *
 * One POST replaces what used to be four Context.dev calls. The service reads
 * the site's own published data — schema.org, the store catalogue, the theme's
 * stylesheets — and picks the products worth advertising, so everything below
 * is a fact the site states rather than an inference about it.
 *
 * Every field is optional on the wire and validated here: this is an untrusted
 * response even when it comes from our own service, and a partial extract must
 * degrade the Brief rather than fail it.
 */
const DEFAULT_ENDPOINT = "http://127.0.0.1:8080";

/** The extractor reads pages and calls a model; it is not a fast service. */
const EXTRACT_TIMEOUT_MS = 90_000;

export function extractorEndpoint(): string {
  return process.env.BRAND_EXTRACTOR_URL?.trim() || DEFAULT_ENDPOINT;
}

export function hasContextConfiguration(): boolean {
  return Boolean(extractorEndpoint());
}

export type BrandProfile = {
  domain: string;
  name: string | null;
  description: string | null;
  slogan: string | null;
  industry: string | null;
  logoUrl: string | null;
};

export type StyleguideProfile = {
  mood: string;
  colors: BrandColor[];
  fontFamily: string | null;
};

export type ProductProfile = Product;

/** Everything one extract yields, in the shape the planner consumes. */
export type BrandResearch = {
  brand: BrandProfile;
  styleguide: StyleguideProfile;
  summary: string;
  products: ProductProfile[];
};

export class BrandExtractorError extends Error {
  constructor(
    readonly kind: "unreachable" | "no-extract" | "no-products" | "malformed",
    message: string,
  ) {
    super(message);
    this.name = "BrandExtractorError";
  }
}

const sourced = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value: value.nullish() }).partial().nullish();

const productSchema = z.object({
  name: z.string().nullish(),
  description: z.string().nullish(),
  images: z.array(z.string()).nullish(),
});

const responseSchema = z.object({
  brand: z
    .object({
      name: sourced(z.string()),
      logo: sourced(z.string()),
      colors: sourced(z.record(z.string(), z.unknown())),
      font: sourced(z.string()),
      headline: sourced(z.string()),
      description: sourced(z.string()),
    })
    .partial()
    .nullish(),
  flagships: z.array(productSchema).nullish(),
  facts: z
    .object({ sample_copy: z.array(z.string()).nullish() })
    .partial()
    .nullish(),
  profile: z
    .object({
      tone: z.string().nullish(),
      positioning: z.string().nullish(),
    })
    .partial()
    .nullish(),
});

type ExtractResponse = z.infer<typeof responseSchema>;

const valueOf = (node: { value?: unknown } | null | undefined): string | null => {
  const raw = node?.value;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

/**
 * The extractor reports colours by role — primary/secondary/accent/background —
 * and the Brief wants an ordered palette.
 *
 * Only the roles are used. `all` is the theme's full ranked list, which on a
 * Tailwind site carries framework defaults (#9ca3af, #111827) alongside the
 * brand's own colours; those are saturated enough to outrank the background
 * when the prompt picks its pair, which turned NuPhy's teal-and-white into
 * teal-and-blue. It is read only when the roles cannot fill a pair at all.
 */
function paletteFrom(colors: unknown): BrandColor[] {
  if (!colors || typeof colors !== "object") return [];
  const record = colors as Record<string, unknown>;
  const named: BrandColor[] = [];
  const seen = new Set<string>();

  const push = (value: unknown, name: string | null) => {
    const hex = typeof value === "string" ? normalizeBrandColorHex(value) : null;
    if (!hex || seen.has(hex)) return;
    seen.add(hex);
    named.push({ hex, name });
  };

  push(record.primary, "Accent");
  push(record.background, "Background");
  push(record.text ?? record.secondary, "Text");
  push(record.accent, "Accent");

  if (named.length < 2 && Array.isArray(record.all)) {
    for (const value of record.all) push(value, null);
  }
  return named.slice(0, AD_RUN_LIMITS.palette);
}

/** A public raster URL the renderer may hand to a model, or nothing. */
function logoFrom(value: string | null): string | null {
  if (!value || value.length > AD_RUN_LIMITS.logoUrl) return null;
  return parsePublicHttpUrl(value)?.href ?? null;
}

/**
 * The extractor's `profile` is model-inferred rather than scraped, so only the
 * fields that shape a look are read from it. `competitors` names real third
 * parties on a guess and must never reach an ad.
 */
function researchFrom(domain: string, body: ExtractResponse): BrandResearch {
  const brand = body.brand ?? {};
  const products = (body.flagships ?? []).flatMap((product) => {
    const name = (product.name ?? "").trim();
    const description = (product.description ?? "").trim();
    if (!name || !description) return [];
    return [{
      name: name.slice(0, AD_RUN_LIMITS.productName),
      description: description.slice(0, AD_RUN_LIMITS.productDescription),
      // First image only: the extractor lists them in the shop's own order, so
      // the first is the primary shot. Same public-URL rules as the logo.
      imageUrl: logoFrom((product.images ?? [])[0] ?? null),
    }];
  });

  if (products.length < AD_PRODUCT_CONCEPT_MIN) {
    throw new BrandExtractorError(
      "no-products",
      `extractor returned ${products.length} advertisable products`,
    );
  }

  return {
    brand: {
      domain,
      name: valueOf(brand.name),
      description: valueOf(brand.description) ?? valueOf(brand.headline),
      slogan: valueOf(brand.headline),
      industry: body.profile?.positioning?.trim() || null,
      logoUrl: logoFrom(valueOf(brand.logo)),
    },
    styleguide: {
      mood: body.profile?.tone?.trim() || "",
      colors: paletteFrom(brand.colors?.value),
      fontFamily: normalizeFontFamily(valueOf(brand.font)),
    },
    summary: (body.facts?.sample_copy ?? []).join(" ").trim(),
    // The whole catalog the extractor found, not the handful an Ad Run uses:
    // the person choosing a Product cannot pick one the Brief never carried.
    products: products.slice(0, AD_CATALOG_MAX),
  };
}

/**
 * One domain -> everything the planner needs.
 *
 * `with_profile` is required, not optional: it is the switch that runs both
 * model-backed steps, and without it there are no flagship products to
 * advertise and no tone to render in.
 */
export async function researchBrand(
  domain: string,
  signal?: AbortSignal,
): Promise<BrandResearch> {
  const timeout = AbortSignal.timeout(EXTRACT_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(new URL("/extract", extractorEndpoint()), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `https://${domain}`, with_profile: true }),
      signal: combined,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new BrandExtractorError(
      "unreachable",
      `brand-extractor did not answer at ${extractorEndpoint()}`,
    );
  }

  if (response.status === 422) {
    throw new BrandExtractorError("no-extract", "extractor could not read that site");
  }
  if (!response.ok) {
    throw new BrandExtractorError(
      "unreachable",
      `brand-extractor returned HTTP ${response.status}`,
    );
  }

  let parsed: ExtractResponse;
  try {
    parsed = responseSchema.parse(await response.json());
  } catch (cause) {
    throw new BrandExtractorError(
      "malformed",
      `brand-extractor response did not parse: ${String(cause).slice(0, 200)}`,
    );
  }

  return researchFrom(domain, parsed);
}
