import { describe, expect, it } from "vitest";
import { manyArticlesFidelity, oneArticleFidelity } from "./fidelity";

/**
 * The paragraphs are prose, so these guard the load-bearing parts rather than
 * the wording: that the palette is taken off the article, that the scene is
 * handed back, and that both survive being said about more than one article.
 */
describe("article fidelity", () => {
  const one = oneArticleFidelity("WH80");
  const many = manyArticlesFidelity(3);

  it("names the article it was shown", () => {
    expect(one).toContain("The attached image is the REAL WH80.");
    expect(many).toContain("The 3 attached photographs are the REAL articles");
  });

  it("ties several articles to the numbering that identifies them", () => {
    expect(many).toContain("numbered against above");
  });

  for (const [label, block] of [
    ["one article", one],
    ["several articles", many],
  ] as const) {
    describe(label, () => {
      it("outranks the palette explicitly", () => {
        expect(block).toContain(
          "COLOUR OVERRIDE — this outranks the palette instructions above",
        );
        expect(block).toContain("keeps its own real colours");
        expect(block).toContain("Do not tint, recolour, or restyle");
      });

      it("scopes itself to the article and leaves the scene alone", () => {
        expect(block).toContain("SCOPE:");
        expect(block).toContain("build whatever scene is described there");
        expect(block).toMatch(/Relighting (the product|them)/);
      });

      it("asks for the geometry, not a resemblance", () => {
        expect(block).toContain("silhouette, proportions, panel edges");
        expect(block).toContain("geometry");
        expect(block).toContain("never substitute a similar-looking product");
      });

      it("reads as three scoped paragraphs", () => {
        expect(block.split("\n\n")).toHaveLength(3);
      });
    });
  }
});
