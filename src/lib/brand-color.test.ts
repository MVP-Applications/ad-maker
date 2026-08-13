import { describe, expect, it } from "vitest";
import {
  brandColorToRgb,
  expandBrandColorHex,
  normalizeBrandColorHex,
  parseColorInput,
} from "./brand-color";

describe("expandBrandColorHex", () => {
  // A colour input silently falls back to black on the three-digit form, so
  // the widening is what keeps a shorthand palette editable at all.
  it("widens the three-digit form", () => {
    expect(expandBrandColorHex("#abc")).toBe("#aabbcc");
    expect(expandBrandColorHex("f00")).toBe("#ff0000");
  });

  it("leaves the six-digit form alone", () => {
    expect(expandBrandColorHex("#D6001C")).toBe("#d6001c");
  });

  it("refuses what is not a colour", () => {
    expect(expandBrandColorHex("rebeccapurple")).toBeNull();
  });
});

describe("parseColorInput", () => {
  it.each([
    ["#d6001c", "#d6001c"],
    ["D6001C", "#d6001c"],
    ["#abc", "#aabbcc"],
  ])("reads the hex form %s", (input, expected) => {
    expect(parseColorInput(input)).toBe(expected);
  });

  it.each([
    ["rgb(214, 0, 28)", "#d6001c"],
    ["rgb(214 0 28)", "#d6001c"],
    ["RGB(214,0,28)", "#d6001c"],
    ["214, 0, 28", "#d6001c"],
    ["rgb(0,0,0)", "#000000"],
    ["rgb(255, 255, 255)", "#ffffff"],
  ])("reads the RGB form %s", (input, expected) => {
    expect(parseColorInput(input)).toBe(expected);
  });

  // Alpha is accepted so a pasted rgba() is not a dead end, but an Ad Run's
  // palette is opaque and the channel is dropped rather than half-honoured.
  it("reads rgba and drops the alpha", () => {
    expect(parseColorInput("rgba(214, 0, 28, 0.5)")).toBe("#d6001c");
  });

  it.each([
    ["an out-of-range channel", "rgb(256, 0, 0)"],
    ["too few channels", "rgb(214, 0)"],
    ["a colour name", "red"],
    ["nothing at all", "   "],
  ])("refuses %s", (_why, input) => {
    expect(parseColorInput(input)).toBeNull();
  });
});

describe("brandColorToRgb", () => {
  it("states a hex in the other notation", () => {
    expect(brandColorToRgb("#d6001c")).toBe("rgb(214, 0, 28)");
    expect(brandColorToRgb("#abc")).toBe("rgb(170, 187, 204)");
  });

  it("refuses what is not a colour", () => {
    expect(brandColorToRgb("nope")).toBeNull();
  });
});

describe("normalizeBrandColorHex", () => {
  // Unchanged behaviour, pinned because the new helpers build on it.
  it("keeps the shorthand it was given", () => {
    expect(normalizeBrandColorHex("#ABC")).toBe("#abc");
  });
});
