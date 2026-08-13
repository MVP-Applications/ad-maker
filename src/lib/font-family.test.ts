import { describe, expect, it } from "vitest";
import { normalizeFontFamily } from "./font-family";

describe("normalizeFontFamily", () => {
  it.each([
    "Inter",
    "Helvetica Neue",
    "Times New Roman",
    "PT Sans",
    "Neue Haas Grotesk Display Pro",
  ])("keeps the family %s", (family) => {
    expect(normalizeFontFamily(family)).toBe(family);
  });

  it("trims what it keeps", () => {
    expect(normalizeFontFamily("  Georgia  ")).toBe("Georgia");
  });

  it.each([
    ["a non-string", 7],
    ["nothing", "   "],
    ["a script tag", "<script>alert(1)</script>"],
    ["something overlong", "x".repeat(200)],
  ])("refuses %s", (_why, value) => {
    expect(normalizeFontFamily(value)).toBeNull();
  });

  /**
   * The extractor reads type off a stylesheet and sometimes reports the weight
   * rather than the family — ae.hm.com comes back as "Weight 7". Left alone it
   * is shown as the brand's typeface and handed to an image model as one.
   */
  describe("a weight is not a family", () => {
    it.each([
      "Weight 7",
      "weight 700",
      "font-weight 400",
      "wght 300",
      "700",
      "Bold",
      "semi-bold",
      "Extra Light",
      "black",
    ])("refuses %s", (value) => {
      expect(normalizeFontFamily(value)).toBeNull();
    });

    // Real families carry numbers and weight words, and must survive.
    it.each([
      "Helvetica Neue 55 Roman",
      "Archivo Black",
      "Avenir Next Bold Italic",
      "Gotham Book",
      "Bodoni 72",
      "Founders Grotesk Light Regular",
    ])("keeps %s", (family) => {
      expect(normalizeFontFamily(family)).toBe(family);
    });
  });
});
