import { describe, expect, test } from "vitest";
import type { Product } from "@/lib/ad-run";
import {
  activeMention,
  insertMention,
  matchProducts,
  mentionedIn,
} from "./mentions";

const product = (name: string): Product => ({
  name,
  description: "A perfume the shop actually sells.",
  imageUrl: null,
  price: null,
  currency: null,
  url: null,
  flagship: false,
});

// Real names from nouvona.com: the brand sits in the middle and the size at the
// end, which is why a prefix-only search would find nothing useful.
const CATALOGUE = [
  product("عطر أتكينسونس روز إن وندور لاند او دي برفيوم -100مل"),
  product("عطر أتكينسونس جاسمين تانجرين او دي برفيوم -100مل"),
  product("عطر أبيركرومبي آند فيتش فيرست انتستنكت للرجال -100مل"),
  product("Royal Oud Reserve"),
];

describe("finding the mention under the caret", () => {
  test("opens on an @ at the start of the text", () => {
    expect(activeMention("@roy", 4)).toEqual({ start: 0, end: 4, query: "roy" });
  });

  test("opens on an @ after a space, mid-sentence", () => {
    const value = "an ad for @roz";
    expect(activeMention(value, value.length)).toMatchObject({ query: "roz" });
  });

  test("opens with an empty query the moment @ is typed", () => {
    expect(activeMention("show me @", 9)).toMatchObject({ query: "" });
  });

  // Otherwise every email address in a prompt opens a product picker.
  test("stays shut inside a word", () => {
    expect(activeMention("mail me at hi@nouvona.com", 25)).toBeNull();
  });

  test("stays shut once the query runs onto a new line", () => {
    expect(activeMention("@roz\nand something else", 22)).toBeNull();
  });

  test("stays shut when the caret is before the @", () => {
    expect(activeMention("hello @roz", 3)).toBeNull();
  });

  test("follows the caret rather than the end of the text", () => {
    const value = "@roz and more words after";
    expect(activeMention(value, 4)).toMatchObject({ query: "roz" });
  });
});

describe("matching the catalogue", () => {
  test("offers the head of the catalogue before anything is typed", () => {
    expect(matchProducts(CATALOGUE, "", 2)).toHaveLength(2);
  });

  // The decisive case: "روز" sits in the middle of the name.
  test("matches a word inside the name, not only its start", () => {
    const found = matchProducts(CATALOGUE, "روز");

    expect(found).toHaveLength(1);
    expect(found[0].name).toContain("روز إن وندور لاند");
  });

  test("matches the brand shared by several products", () => {
    expect(matchProducts(CATALOGUE, "أتكينسونس")).toHaveLength(2);
  });

  test("ignores case for latin names", () => {
    expect(matchProducts(CATALOGUE, "ROYAL")[0].name).toBe("Royal Oud Reserve");
  });

  test("sorts a name that starts with the query first", () => {
    const catalogue = [product("Deep Royal Oud"), product("Royal Oud")];

    expect(matchProducts(catalogue, "royal")[0].name).toBe("Royal Oud");
  });

  test("offers nothing when nothing matches", () => {
    expect(matchProducts(CATALOGUE, "زززز")).toEqual([]);
  });
});

describe("inserting the chosen Product", () => {
  test("replaces the typed query with the Product's own name", () => {
    const value = "an ad for @roz";
    const mention = activeMention(value, value.length)!;

    const next = insertMention(value, mention, CATALOGUE[0]);

    expect(next.value).toBe(`an ad for @${CATALOGUE[0].name} `);
    expect(next.caret).toBe(next.value.length);
  });

  test("keeps whatever followed the caret", () => {
    const value = "@roy on marble";
    const mention = activeMention(value, 4)!;

    expect(insertMention(value, mention, CATALOGUE[3]).value).toBe(
      "@Royal Oud Reserve  on marble",
    );
  });
});

describe("what the request finally carries", () => {
  test("keeps a Product whose name is still in the text", () => {
    const text = `an ad for @${CATALOGUE[0].name} on marble`;

    expect(mentionedIn(text, [CATALOGUE[0]])).toEqual([CATALOGUE[0]]);
  });

  // The text is what the person sees and edits, so deleting a name un-mentions
  // it. Otherwise an image arrives carrying a Product nobody asked for.
  test("drops a Product whose name was deleted", () => {
    expect(mentionedIn("an ad for something else", [CATALOGUE[0]])).toEqual([]);
  });

  test("never carries the same Product twice", () => {
    const text = `@${CATALOGUE[1].name} and @${CATALOGUE[1].name}`;

    expect(mentionedIn(text, [CATALOGUE[1], CATALOGUE[1]])).toHaveLength(1);
  });

  test("keeps the order they were chosen in", () => {
    const text = `@${CATALOGUE[3].name} @${CATALOGUE[0].name}`;

    expect(
      mentionedIn(text, [CATALOGUE[3], CATALOGUE[0]]).map(({ name }) => name),
    ).toEqual([CATALOGUE[3].name, CATALOGUE[0].name]);
  });
});
