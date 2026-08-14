/**
 * The concept families, from the `product-image-prompts` skill.
 *
 * These replace forty Creative Directions, and the trade was deliberate. Forty
 * was a menu of finished looks — a neon grid, a blueprint, a chart drawn as art
 * — and a director picking from a menu is choosing a treatment rather than
 * having an idea. Twelve families are not smaller; they are a different kind of
 * thing. Each one is a way of MEANING something about a product, and the look is
 * then composed from the craft axes underneath it.
 *
 * `reads` is what the family says to whoever sees it. It is the field that
 * decides which one a brief actually wants, and it is stated because "best for"
 * describes a category while "reads" describes an effect, and the effect is the
 * reason to choose.
 *
 * The first six are the set: a delivery of six ads takes one from each, never
 * two from any. The last six substitute in where a category fits better.
 */
export const CREATIVE_DIRECTIONS = [
  {
    key: "sculptural_hero",
    label: "Sculptural Hero",
    bestFor: "the object itself, when the object is worth looking at",
    reads: "confident, premium — this is the thing",
    core: true,
    rules: [
      "the product treated as an object of design, not merchandise",
      "plinths, floating suspension, mirrored bases or geometric risers",
      "a single dramatic light and deep negative space",
      "nothing in frame that is not doing work",
    ],
  },
  {
    key: "editorial_still_life",
    label: "Editorial Still Life",
    bestFor: "craft, ingredients, provenance, anything made rather than manufactured",
    reads: "crafted, considered, tactile",
    core: true,
    rules: [
      "an art-directed tabletop with a supporting cast: raw ingredients, tools, torn paper, glassware, fabric folds",
      "composed like a magazine spread, never like a catalogue",
      "the arrangement deliberate enough to look unarranged",
    ],
  },
  {
    key: "human_moment",
    label: "Human Moment",
    bestFor: "anything used, worn, carried, poured or held",
    reads: "desirable, alive, aspirational",
    core: true,
    rules: [
      "hands, a partial figure, a real environment, caught mid-action",
      "motion blur is allowed and often correct",
      "never a smiling stock model looking at the camera",
    ],
  },
  {
    key: "surreal_conceptual",
    label: "Surreal / Conceptual",
    bestFor: "categories crowded with sameness, where the idea has to do the work",
    reads: "scroll-stopping, shareable",
    core: true,
    rules: [
      "scale distortion, impossible physics, the product as architecture or landscape",
      "repetition into infinity, or the product opened to reveal an interior world",
      "commit completely — a half-committed surreal image reads as a mistake",
    ],
  },
  {
    key: "graphic_poster",
    label: "Graphic Poster",
    bestFor: "campaigns, launches, anything that has to carry a headline",
    reads: "brand-forward, campaign-ready",
    core: true,
    rules: [
      "bold colour blocking, hard geometry, oversized negative space",
      "the product small in frame on a strong diagonal or a strict grid",
      "Swiss, Bauhaus, risograph or nineties advertising energy",
      "room left deliberately for the type",
    ],
  },
  {
    key: "elemental_material",
    label: "Elemental / Material",
    bestFor: "liquids, textures, ingredients, anything with a physical claim",
    reads: "visceral, premium, kinetic",
    core: true,
    rules: [
      "the product meeting a raw substance: water, smoke, sand, ice, crushed stone, fire, silk, soil, molten glass",
      "splash, suspension and the moment of contact",
      "the substance behaving the way it really behaves",
    ],
  },

  /* Substitutes — used where a category fits one of these better than a core family. */
  {
    key: "macro_texture",
    label: "Macro Texture",
    bestFor: "finishes, weaves, foams, powders, grain, pigment",
    reads: "intimate, exact, expensive",
    core: false,
    rules: [
      "an extreme close on surface: weave, foam, condensation, grain, pigment",
      "the texture legible enough to feel",
      "the whole product inferred rather than shown",
    ],
  },
  {
    key: "set_design_maximalism",
    label: "Built Set",
    bestFor: "playful brands, launches, anything that can afford spectacle",
    reads: "crafted, generous, deliberate",
    core: false,
    rules: [
      "a built environment of paper, foam or acrylic: arches, staircases, miniature architecture",
      "handmade, and visibly so",
      "the product placed in the set rather than composited onto it",
    ],
  },
  {
    key: "interior_vignette",
    label: "Interior Vignette",
    bestFor: "homeware, furniture, appliances, anything that lives in a room",
    reads: "settled, designed, real",
    core: false,
    rules: [
      "the product living in a beautifully designed room",
      "shot like an architecture magazine: real daylight, real architecture",
      "the room composed, never staged with clutter",
    ],
  },
  {
    key: "flat_lay_knolling",
    label: "Flat Lay / Knolling",
    bestFor: "kits, ranges, sets, anything with parts",
    reads: "ordered, complete, obsessive",
    core: false,
    rules: [
      "top-down, everything disassembled and aligned on a grid",
      "even spacing, even light, right angles throughout",
      "obsessive order as the point",
    ],
  },
  {
    key: "seasonal_narrative",
    label: "Seasonal / Narrative",
    bestFor: "occasions, gifting, food and drink, moments with a date on them",
    reads: "warm, human, of a moment",
    core: false,
    rules: [
      "a moment in time: a rainy window, a golden-hour picnic, a cold morning kitchen, a night market",
      "the light and the weather carrying the season",
      "the product belonging to the moment rather than announcing itself",
    ],
  },
  {
    key: "kinetic",
    label: "Kinetic",
    bestFor: "sport, drinks, performance, anything that moves",
    reads: "urgent, physical, alive",
    core: false,
    rules: [
      "a freeze-frame: an explosion, a pour, a drop, a splash, a shatter, a levitation",
      "visible motion energy — trails, spray, debris caught mid-air",
      "the product itself held perfectly sharp inside it",
    ],
  },
] as const;

export type CreativeDirection = (typeof CREATIVE_DIRECTIONS)[number];
export type CreativeDirectionKey = CreativeDirection["key"];

export const CREATIVE_DIRECTION_KEYS = CREATIVE_DIRECTIONS.map(
  ({ key }) => key,
) as [CreativeDirectionKey, ...CreativeDirectionKey[]];

export function directionByKey(key: string): CreativeDirection | undefined {
  return CREATIVE_DIRECTIONS.find((direction) => direction.key === key);
}

/** The six a full set is drawn from, one each. */
export const CORE_DIRECTIONS = CREATIVE_DIRECTIONS.filter(({ core }) => core);

/**
 * Families that can show a supplied product photograph as itself.
 *
 * Two of the twelve deliberately re-invent their subject. `surreal_conceptual`
 * distorts scale and physics, and `graphic_poster` reduces the product to a
 * shape inside a colour field — handing either a real photograph asks for two
 * incompatible things and yields neither. The NuPhy WH80 came back through an
 * abstract treatment recoloured, its faceted edge flattened, and its key
 * legends invented.
 *
 * The other ten can hold a real article, which is the point of building the
 * catalogue this way: art direction is free, the object is not.
 */
export const PHOTO_SAFE_DIRECTIONS = new Set<CreativeDirectionKey>(
  CREATIVE_DIRECTIONS.filter(
    ({ key }) => key !== "surreal_conceptual" && key !== "graphic_poster",
  ).map(({ key }) => key),
);

export function isPhotoSafe(key: CreativeDirectionKey): boolean {
  return PHOTO_SAFE_DIRECTIONS.has(key);
}
