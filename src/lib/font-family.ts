import { AD_RUN_LIMITS } from "@/lib/ad-run-policy";

const SAFE_FONT_FAMILY = /^[\p{L}\p{N}][\p{L}\p{N} .,'&()+-]*$/u;

/**
 * A CSS weight wearing a family's clothes.
 *
 * The extractor reads type off a stylesheet and sometimes reports the weight
 * it found rather than the family — ae.hm.com comes back as "Weight 7". It
 * passes every test above, so it reaches the Brief, is shown to the reader as
 * the brand's typeface, and is handed to an image model as one. A weight is
 * not a typeface, and the honest answer is that none was read.
 *
 * Deliberately narrow: real families do carry numbers and weight words
 * ("Helvetica Neue 55 Roman", "Archivo Black"), so only a value that is
 * *nothing but* a weight is refused.
 */
const WEIGHT_NOT_FAMILY =
  /^(?:(?:font[- ]?)?(?:weight|wght|w)\s*[:=]?\s*\d{1,4}|\d{1,4}|(?:thin|extra[- ]?light|ultra[- ]?light|light|regular|normal|book|medium|semi[- ]?bold|demi[- ]?bold|bold|extra[- ]?bold|ultra[- ]?bold|black|heavy)(?:\s*\d{1,4})?)$/i;

/** Keep externally extracted font names bounded and inert inside image prompts. */
export function normalizeFontFamily(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const family = value.trim();
  if (
    family.length === 0 ||
    family.length > AD_RUN_LIMITS.fontFamily ||
    !SAFE_FONT_FAMILY.test(family) ||
    WEIGHT_NOT_FAMILY.test(family)
  ) {
    return null;
  }
  return family;
}
