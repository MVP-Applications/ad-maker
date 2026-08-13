import { z } from "zod";
import {
  normalizeBrandColorHex,
  type BrandColor,
} from "@/lib/brand-color";
import { normalizeFontFamily } from "@/lib/font-family";
import { productKey, withFlagships, type Product } from "@/lib/ad-run";
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
  heroImageUrl: string | null;
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
  /** Tags the site publishes itself in, as the site states them. */
  languages: string[];
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
  // Unknown rather than number: a shop that states "204.95" as a string, or as
  // nothing at all, should cost that one product its price tag and not cost the
  // whole extract its Brief. The numeric check lives in productFrom.
  price: z.unknown(),
  currency: z.string().nullish(),
  url: z.string().nullish(),
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
      hero_image: sourced(z.string()),
    })
    .partial()
    .nullish(),
  // The whole catalogue, and the shortlist chosen out of it. Both are read:
  // one is what a person picks from, the other is what a run advertises by
  // default, and collapsing them loses whichever question is not being asked.
  products: z.array(productSchema).nullish(),
  flagships: z.array(productSchema).nullish(),
  facts: z
    .object({
      sample_copy: z.array(z.string()).nullish(),
      languages: z.array(z.string()).nullish(),
    })
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
 * One catalogue entry, or nothing when the shop does not even name it.
 *
 * A missing description is not a reason to drop one. Shops describe a small
 * fraction of what they list — nuphy.com describes 29 of its 680 products —
 * and a name, a photograph and a price are everything the person choosing one
 * needs. Only the ad-writing step needs more, and it asks separately.
 */
function productFrom(
  product: z.infer<typeof productSchema>,
): Omit<Product, "flagship"> | null {
  const name = (product.name ?? "").trim();
  const description = (product.description ?? "").trim();
  if (!name) return null;

  const price = product.price;
  return {
    name: name.slice(0, AD_RUN_LIMITS.productName),
    description: description.slice(0, AD_RUN_LIMITS.productDescription),
    // First image only: the extractor lists them in the shop's own order, so
    // the first is the primary shot. Same public-URL rules as the logo.
    imageUrl: logoFrom((product.images ?? [])[0] ?? null),
    price:
      typeof price === "number" &&
      Number.isFinite(price) &&
      price >= 0 &&
      price <= AD_RUN_LIMITS.price
        ? price
        : null,
    currency:
      (product.currency ?? "").trim().slice(0, AD_RUN_LIMITS.currency) || null,
    url: logoFrom(product.url ?? null),
  };
}

/**
 * Bound the catalogue without cutting away the Products worth advertising.
 *
 * A plain slice would: the shortlist is appended after the catalogue, and on a
 * shop longer than the ceiling those entries fall off the end — leaving a Brief
 * with hundreds of Products and nothing to advertise, which reads to the person
 * as "we found no products" on the largest catalogues we handle.
 */
function boundCatalogue(entries: Product[]): Product[] {
  if (entries.length <= AD_CATALOG_MAX) return entries;

  // The shortlist goes first and the rest fill what is left, so the ceiling
  // still holds when the shortlist alone would exceed it.
  let shortlist = Math.min(
    entries.filter(({ flagship }) => flagship).length,
    AD_CATALOG_MAX,
  );
  let rest = AD_CATALOG_MAX - shortlist;

  return entries.filter((entry) => {
    const room = entry.flagship ? shortlist : rest;
    if (room <= 0) return false;
    if (entry.flagship) shortlist -= 1;
    else rest -= 1;
    return true;
  });
}

/**
 * The extractor's `profile` is model-inferred rather than scraped, so only the
 * fields that shape a look are read from it. `competitors` names real third
 * parties on a guess and must never reach an ad.
 */
function researchFrom(domain: string, body: ExtractResponse): BrandResearch {
  const brand = body.brand ?? {};

  // The shortlist names which catalogue entries are worth advertising. Entries
  // it names that the catalogue does not carry are kept anyway: a run needs
  // Products more than the catalogue needs to be the only source of them.
  const flagshipKeys = new Set(
    (body.flagships ?? []).flatMap((product) => {
      const name = (product.name ?? "").trim();
      return name ? [productKey(name)] : [];
    }),
  );

  const seen = new Set<string>();
  const entries = [...(body.products ?? []), ...(body.flagships ?? [])].flatMap(
    (raw) => {
      const product = productFrom(raw);
      if (!product) return [];
      const key = productKey(product.name);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ ...product, flagship: flagshipKeys.has(key) }];
    },
  );

  // Nothing was shortlisted, so the run falls back to the head of the
  // catalogue — the shop's own order, which is how it ranks itself.
  const products = withFlagships(boundCatalogue(entries));

  if (!products.some(({ flagship }) => flagship)) {
    const described = entries.filter(({ description }) => description).length;
    throw new BrandExtractorError(
      "no-products",
      `extractor returned ${entries.length} products, ${described} of them described`,
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
      heroImageUrl: logoFrom(valueOf(brand.hero_image)),
    },
    styleguide: {
      mood: body.profile?.tone?.trim() || "",
      colors: paletteFrom(brand.colors?.value),
      fontFamily: normalizeFontFamily(valueOf(brand.font)),
    },
    summary: (body.facts?.sample_copy ?? []).join(" ").trim(),
    languages: (body.facts?.languages ?? []).flatMap((language) => {
      const tag = language.trim().slice(0, AD_RUN_LIMITS.language);
      return tag ? [tag] : [];
    }).slice(0, AD_RUN_LIMITS.languages),
    // The whole catalog the extractor found, not the handful an Ad Run uses:
    // the person choosing a Product cannot pick one the Brief never carried.
    products,
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
