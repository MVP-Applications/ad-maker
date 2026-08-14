import type { Product } from "@/lib/ad-run";

/**
 * Naming a Product in the prompt box, the way "@" names a person elsewhere.
 *
 * The point is that the words a person types reach the model attached to real
 * articles rather than to nothing: "an ad for 5 perfumes" against a shop with
 * 107 of them produced five invented bottles, because the request never carried
 * a single real one.
 */

/** What is being typed after an "@", if the caret sits inside one. */
export type ActiveMention = {
  /** Index of the "@" itself. */
  start: number;
  /** Index just past the caret. */
  end: number;
  /** What has been typed since the "@", which may be empty. */
  query: string;
};

/**
 * An "@" only opens a mention at a word boundary, so an email address does not,
 * and the query stops at a newline. Anything longer than a Product name is a
 * sentence the person kept typing, not a search.
 */
const QUERY_MAX = 60;

export function activeMention(
  value: string,
  caret: number,
): ActiveMention | null {
  const upTo = value.slice(0, caret);
  const start = upTo.lastIndexOf("@");
  if (start < 0) return null;

  // Preceded by a letter or digit means it is inside a word: an email, a handle.
  const before = start > 0 ? upTo[start - 1] : " ";
  if (/[\p{L}\p{N}]/u.test(before)) return null;

  const query = upTo.slice(start + 1);
  if (query.length > QUERY_MAX || /[\n\r]/.test(query)) return null;

  return { start, end: caret, query };
}

/**
 * Products whose name contains what has been typed, best first.
 *
 * Contains rather than starts-with: a shop names its products
 * "عطر أتكينسونس روز إن وندور لاند" — brand in the middle, size at the end — so
 * a person searching "روز" would find nothing under a prefix match. Names that
 * do start with the query still sort first, because that is the stronger intent.
 */
export function matchProducts(
  products: readonly Product[],
  query: string,
  limit = 8,
): Product[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return products.slice(0, limit);

  const scored = products.flatMap((product) => {
    const index = product.name.toLocaleLowerCase().indexOf(needle);
    return index < 0 ? [] : [{ product, index }];
  });

  return scored
    .sort((a, b) => a.index - b.index)
    .slice(0, limit)
    .map(({ product }) => product);
}

/** Replace the "@query" under the caret with the Product's own name. */
export function insertMention(
  value: string,
  mention: ActiveMention,
  product: Product,
): { value: string; caret: number } {
  const token = `@${product.name} `;
  return {
    value: value.slice(0, mention.start) + token + value.slice(mention.end),
    caret: mention.start + token.length,
  };
}

/**
 * Name a Product at the caret, whether or not an "@" is open there.
 *
 * The picker replaces the "@query" that opened it. This is for naming one from
 * somewhere else — the panel's own list, where there is no "@" to replace and
 * the caret is simply wherever the person last left it. It still defers to an
 * open "@": naming a Product while half a query sits under the caret should
 * finish that query rather than leave it stranded beside the answer.
 */
export function nameProductAt(
  value: string,
  caret: number,
  product: Product,
): { value: string; caret: number } {
  const open = activeMention(value, caret);
  // A query still being typed has no space on the end. One that does is a name
  // already finished — most often one this very function just wrote, since it
  // leaves the caret directly after "@Name ". Replacing that would delete the
  // last Product named in order to name the next one. Product names contain
  // spaces, so this cannot be a rule about spaces inside the query, only about
  // the one that ends it.
  if (open && !/\s$/.test(open.query)) return insertMention(value, open, product);

  const before = value.slice(0, caret);
  const after = value.slice(caret);
  // Spaced off what is already there, but only where there is not a space
  // already: a name welded onto the last word is a different word, and two
  // spaces where the caret was is a gap the person has to go back and close.
  const lead = !before || /\s$/.test(before) ? "" : " ";
  const trail = /^\s/.test(after) ? "" : " ";
  const token = `${lead}@${product.name}${trail}`;

  return { value: before + token + after, caret: caret + token.length };
}

/**
 * The Products still named in the text.
 *
 * The picker records what was chosen, but the text is what the person sees and
 * edits — deleting a name has to un-mention it, or an image arrives carrying a
 * Product nobody asked for any more. The text wins.
 */
export function mentionedIn(
  text: string,
  chosen: readonly Product[],
): Product[] {
  const seen = new Set<string>();
  return chosen.flatMap((product) => {
    const key = product.name.trim().toLocaleLowerCase();
    if (seen.has(key) || !text.includes(product.name)) return [];
    seen.add(key);
    return [product];
  });
}
