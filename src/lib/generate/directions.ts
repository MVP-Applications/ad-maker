/**
 * Cross-runtime metadata for the Creative Directions available to an Ad Run.
 *
 * `rules` is what a Direction now is. The planner writes each ad's picture
 * itself and these bound what it may write — so two runs of the same Direction
 * describe different pictures while both stay recognisably that Direction. The
 * fixed paragraphs they were distilled from survive in concepts.ts, as the
 * fallback for a run whose planning call failed.
 *
 * They are written as things to do rather than things to avoid: an image model
 * handles "empty studio, one object" better than "no clutter", and every one of
 * these was a sentence that already worked.
 */
export const CREATIVE_DIRECTIONS = [
  {
    key: "product_hero",
    label: "Product Hero",
    bestFor: "physical products, hardware, tangible goods",
    rules: [
      "one single subject on a seamless studio backdrop",
      "one dramatic key light, plus a soft rim light in the second colour",
      "a deep, soft shadow beneath the subject",
      "subject slightly off-centre, leaving negative space for the headline",
      "the finish of a high-end print campaign",
    ],
  },
  {
    key: "isometric",
    label: "Isometric World",
    bestFor: "B2B SaaS, developer tools, APIs, platforms",
    rules: [
      "a clean isometric illustration of an abstract system: floating planes, nodes, connecting pipes",
      "precise 30-degree isometric angles throughout",
      "the first colour dominant, the second as accents, on a very light neutral background",
      "matte materials and soft ambient occlusion",
      "an empty, uncluttered composition",
    ],
  },
  {
    key: "typographic",
    label: "Type Poster",
    bestFor: "statement-driven brands, abstract products, bold positioning",
    rules: [
      "typography is the artwork; the headline fills most of the frame",
      "a flat single-colour background with type in the strongest opposite tone",
      "a strict grid with one deliberate asymmetric offset",
      "one thin rule line, with the wordmark anchoring a corner",
      "Swiss International Typographic Style: order, whitespace, tension",
    ],
  },
  {
    key: "macro_material",
    label: "Macro Material",
    bestFor: "beauty, food, fashion, premium finishes and textures",
    rules: [
      "one sumptuous material filling the frame: liquid, fabric, brushed metal, glass or an organic surface",
      "the material chosen to evoke what the brand sells",
      "shallow depth of field with a razor-sharp focal band",
      "luxurious raking light with glints of the second colour",
      "one calm, softly blurred region left clear for the text",
    ],
  },
  {
    key: "gradient_field",
    label: "Gradient Field",
    bestFor: "AI products, fintech, abstract or intangible services",
    rules: [
      "an expansive colour field flowing from the first colour into the second",
      "no objects at all: the gradient alone carries the feeling",
      "subtle grain, and one soft light bloom rising from the lower third",
      "the atmosphere of dawn over a horizon",
    ],
  },
  {
    key: "editorial_spread",
    label: "Editorial Spread",
    bestFor: "lifestyle, food and drink, travel, hospitality",
    rules: [
      "a quiet still-life on a table or shelf, art-directed like Kinfolk or Monocle",
      "natural window light and muted tones, with a single accent of the second colour",
      "objects related to the offering, and generous calm negative space",
      "text set like a refined magazine layout: small, precise, unhurried",
    ],
  },
  {
    key: "sculptural_object",
    label: "Sculptural Object",
    bestFor: "tech and AI brands with no physical product",
    rules: [
      "one abstract sculptural form — a twisted ribbon, torus or fluid glass shape — that embodies the offering",
      "floating in a softly lit infinite room washed in the first colour",
      "the form refracting and glowing with the second colour",
      "octane-render quality, soft global illumination, a mirror-calm floor reflection",
    ],
  },
  {
    key: "data_viz",
    label: "Chart as Art",
    bestFor: "analytics, BI, observability, data platforms",
    rules: [
      "one oversized chart form drawn as art rather than interface: an ascending line, layered area curves or a radial plot",
      "thick luminous strokes in the second colour over a deep canvas of the first",
      "faint grid ticks and glow, and a curve that feels optimistic and rising",
      "pure form: no axis labels, no numbers, no legend",
    ],
  },
  {
    key: "blueprint",
    label: "Blueprint",
    bestFor: "engineering, hardware, infrastructure, industrial",
    rules: [
      "a precise engineering drawing of a machine or system representing the offering",
      "fine white and second-colour line work with dashed construction lines",
      "a rich drafting-paper background in the first colour with a subtle grid",
      "small circular detail callouts that stay empty, carrying no annotation text",
      "the confidence of something drafted by hand on a light table",
    ],
  },
  {
    key: "retro_arcade",
    label: "Retro Arcade",
    bestFor: "gaming, entertainment, playful consumer brands",
    rules: [
      "a neon wireframe grid racing toward a glowing horizon, with a low chrome sun",
      "one bold geometric shape floating at the centre",
      "electric first and second colours against near-black",
      "scanline shimmer, phosphor glow, immaculate symmetry",
      "late-80s arcade nostalgia executed with modern polish",
    ],
  },
  {
    key: "monochrome_crop",
    label: "Monochrome Crop",
    bestFor: "luxury, watches, minimalist premium brands",
    rules: [
      "an ultra-tight crop of one exquisite detail: an edge, a curve, a clasp, a surface",
      "rendered entirely in tones of the first colour — highlights, midtones and shadows all within that hue",
      "one razor-thin accent line of the second colour",
      "dramatic chiaroscuro, with vast dark negative space where the type sits",
    ],
  },
  {
    key: "collage",
    label: "Paper Collage",
    bestFor: "agencies, education, media, creative brands",
    rules: [
      "hand-cut paper shapes — arcs, torn strips, circles — suggesting the offering",
      "layered with real drop shadows on a warm paper background",
      "a palette anchored in both brand colours with cream and kraft accents",
      "playful but rigorously composed, like a gallery poster",
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

/**
 * Directions that can show a supplied product photograph as itself.
 *
 * The other ten deliberately re-invent their subject — an abstract single-hue
 * crop, a line schematic, a neon grid, a chart. Handing one of those a real
 * photograph asks for two incompatible things and yields neither: the NuPhy
 * WH80 came back through `monochrome_crop` recoloured, its faceted edge
 * flattened, and its key legends invented. A Product ad that has a photo is
 * therefore steered here, where the reference is an asset rather than a
 * contradiction.
 */
export const PHOTO_SAFE_DIRECTIONS = new Set<CreativeDirectionKey>([
  "product_hero",
  "editorial_spread",
]);

export function isPhotoSafe(key: CreativeDirectionKey): boolean {
  return PHOTO_SAFE_DIRECTIONS.has(key);
}
