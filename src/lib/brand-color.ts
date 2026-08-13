const BRAND_COLOR = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `rgb(214, 0, 28)`, `rgba(214 0 28 / 80%)`, or a bare `214, 0, 28`. */
const RGB_COLOR =
  /^(?:rgba?\s*\(\s*)?(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/].*)?\)?$/i;

export type BrandColor = { hex: string; name: string | null };

/** Return the canonical CSS hex form accepted throughout an Ad Run. */
export function normalizeBrandColorHex(value: string): string | null {
  const raw = value.trim();
  if (!BRAND_COLOR.test(raw)) return null;
  return `#${raw.replace(/^#/, "").toLowerCase()}`;
}

/**
 * The six-digit form, which is the only one `<input type="color">` accepts.
 *
 * `normalizeBrandColorHex` keeps `#abc` as it was written, because that is a
 * legal CSS colour and the Brief carries what the site stated. A colour input
 * handed it silently falls back to black, so widen it here instead.
 */
export function expandBrandColorHex(value: string): string | null {
  const hex = normalizeBrandColorHex(value);
  if (!hex) return null;
  const body = hex.slice(1);
  return body.length === 3
    ? `#${body.split("").map((c) => c + c).join("")}`
    : hex;
}

/**
 * One colour as a person might type it — hex or RGB — as canonical hex.
 *
 * Both notations are read because both are what a brand guideline states, and
 * retyping `rgb(214, 0, 28)` as hex is arithmetic a person should not be asked
 * to do. Alpha parses but is dropped: an Ad Run's palette is opaque.
 */
export function parseColorInput(value: string): string | null {
  const hex = expandBrandColorHex(value);
  if (hex) return hex;

  const match = RGB_COLOR.exec(value.trim());
  if (!match) return null;

  const channels = [match[1], match[2], match[3]].map(Number);
  if (channels.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;

  return `#${channels.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** `#d6001c` -> `rgb(214, 0, 28)`, for showing a colour in the other notation. */
export function brandColorToRgb(value: string): string | null {
  const hex = expandBrandColorHex(value);
  if (!hex) return null;
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
