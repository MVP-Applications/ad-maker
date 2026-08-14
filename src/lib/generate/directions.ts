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

  /**
   * The second twenty-eight.
   *
   * The first twelve covered the styles an Ad Run needs to fill six slots
   * without repeating itself, and they were written when a direction had to
   * carry a whole picture on its own. These are written for a director that
   * composes: each one says what the picture is OF and leaves the light, the
   * lens, the surface and the grade to the axes in `craft.ts`, which is why
   * they read shorter than the twelve above rather than thinner.
   */
  {
    key: "in_hand",
    label: "In Hand",
    bestFor: "small objects, tools, cosmetics, anything whose scale matters",
    rules: [
      "the article held or being used, so its real size is unmistakable",
      "the hand and the setting deliberately understated",
      "the article kept sharp and fully readable at all times",
    ],
  },
  {
    key: "unboxing",
    label: "Unboxing",
    bestFor: "premium packaging, gifts, subscription products",
    rules: [
      "the article emerging from its packaging, the box part of the picture",
      "tissue, moulded insert or wrap still in frame",
      "the moment just before it is fully revealed",
    ],
  },
  {
    key: "exploded_view",
    label: "Exploded View",
    bestFor: "engineered goods, kits, anything with parts worth showing",
    rules: [
      "the article separated into its components, floating in ordered space",
      "even spacing along one axis, every part legible",
      "no annotation, no numbering, no callout text",
    ],
  },
  {
    key: "knolling",
    label: "Knolling",
    bestFor: "kits, ranges, tool sets, anything that comes as a collection",
    rules: [
      "every object laid out flat and photographed from directly above",
      "objects aligned to a strict grid at right angles",
      "even spacing, even light, nothing overlapping",
    ],
  },
  {
    key: "still_life_classical",
    label: "Classical Still Life",
    bestFor: "food, drink, fragrance, heritage brands",
    rules: [
      "a painterly arrangement in the manner of a Dutch still life",
      "deep shadow, one directional light, rich muted colour",
      "fruit, cloth, glass or vessel arranged around the article",
    ],
  },
  {
    key: "levitation",
    label: "Levitation",
    bestFor: "tech, footwear, anything that wants to feel weightless",
    rules: [
      "the article suspended in mid-air with nothing supporting it",
      "a shadow beneath it on a distant surface, proving the height",
      "absolute stillness — this is a float, not a throw",
    ],
  },
  {
    key: "splash_freeze",
    label: "Frozen Motion",
    bestFor: "drinks, liquids, sport, anything kinetic",
    rules: [
      "a single instant of movement frozen absolutely sharp",
      "liquid, powder or fabric caught mid-air around the article",
      "the article itself perfectly still at the centre of it",
    ],
  },
  {
    key: "cross_section",
    label: "Cross Section",
    bestFor: "layered products, food, materials, engineered goods",
    rules: [
      "the article cut cleanly in half to reveal its interior",
      "the cut face square to the camera and fully in focus",
      "the layers or internals as the actual subject",
    ],
  },
  {
    key: "scale_miniature",
    label: "Miniature World",
    bestFor: "services, platforms, anything abstract that needs a metaphor",
    rules: [
      "a tiny constructed world built around or on the article",
      "miniature figures or scenery at model-railway scale",
      "the article rendered at full size, so the scale contrast is the idea",
    ],
  },
  {
    key: "shadow_play",
    label: "Shadow Play",
    bestFor: "minimalist brands, architecture, fashion",
    rules: [
      "the shadow doing more work than the object casting it",
      "one hard light and a shape that throws a graphic shadow",
      "vast plain surface for the shadow to fall across",
    ],
  },
  {
    key: "reflection_double",
    label: "Doubled",
    bestFor: "luxury, beauty, anything symmetrical",
    rules: [
      "the article and its reflection both fully in frame",
      "a mirror-flat surface directly beneath or beside it",
      "the reflection sharp enough to read as a second subject",
    ],
  },
  {
    key: "texture_wall",
    label: "Texture Wall",
    bestFor: "materials, fashion, interiors, tactile goods",
    rules: [
      "a single material filling the entire background as a flat wall",
      "the article set against it with almost no depth",
      "the contrast between the two surfaces carrying the picture",
    ],
  },
  {
    key: "archival_document",
    label: "Archival",
    bestFor: "heritage brands, publishers, institutions, anniversaries",
    rules: [
      "the look of a document photographed from an archive",
      "aged paper, filing marks, the patina of something kept",
      "no invented dates, stamps, seals or written words",
    ],
  },
  {
    key: "botanical_study",
    label: "Botanical Study",
    bestFor: "beauty, wellness, food, natural ingredients",
    rules: [
      "plants and raw ingredients arranged as a specimen study",
      "even, precise light and a plain ground",
      "the article among them as one specimen of several",
    ],
  },
  {
    key: "ingredient_deconstruction",
    label: "Ingredients",
    bestFor: "food, drink, cosmetics, supplements",
    rules: [
      "what the article is made from, laid out around it",
      "raw components in their unprocessed state",
      "only ingredients the brand actually names",
    ],
  },
  {
    key: "street_documentary",
    label: "Street Documentary",
    bestFor: "streetwear, footwear, urban and youth brands",
    rules: [
      "the unposed feel of a photograph taken in the street",
      "real city surfaces, real weather, nothing art-directed",
      "the article present in the scene rather than presented by it",
    ],
  },
  {
    key: "interior_scene",
    label: "Interior",
    bestFor: "furniture, homeware, appliances, interiors",
    rules: [
      "the article in a real room, placed where it would actually live",
      "architecture and daylight doing the composition",
      "the room designed and quiet, never staged with clutter",
    ],
  },
  {
    key: "workspace_scene",
    label: "Workspace",
    bestFor: "hardware, software, tools, professional goods",
    rules: [
      "a working desk or bench mid-task rather than tidied",
      "the article in use position, surrounded by the work it serves",
      "at most two supporting objects in frame",
    ],
  },
  {
    key: "landscape_scale",
    label: "Landscape",
    bestFor: "outdoor, travel, automotive, energy, infrastructure",
    rules: [
      "an expansive natural landscape with the article small within it",
      "the horizon and the weather as the real subject",
      "scale contrast carrying the whole idea",
    ],
  },
  {
    key: "aerial_pattern",
    label: "Aerial",
    bestFor: "logistics, agriculture, travel, infrastructure",
    rules: [
      "the ground seen from far above, flattened into pattern",
      "roads, fields, water or architecture reading as abstract geometry",
      "one element breaking the pattern",
    ],
  },
  {
    key: "night_city",
    label: "Night City",
    bestFor: "nightlife, entertainment, spirits, urban tech",
    rules: [
      "a city after dark, lit entirely by its own lights",
      "wet surfaces multiplying every light source",
      "deep shadow between the lit areas",
    ],
  },
  {
    key: "liquid_suspension",
    label: "Suspension",
    bestFor: "fragrance, serums, drinks, chemistry",
    rules: [
      "the article submerged or suspended in a clear fluid",
      "bubbles, refraction and slow drift around it",
      "the fluid tinted with the brand's own colour",
    ],
  },
  {
    key: "smoke_atmosphere",
    label: "Atmosphere",
    bestFor: "fragrance, spirits, audio, anything sensory",
    rules: [
      "drifting smoke, mist or vapour filling the space around the article",
      "a single light beam giving the atmosphere its shape",
      "the article emerging from it rather than hidden by it",
    ],
  },
  {
    key: "kinetic_streak",
    label: "Kinetic",
    bestFor: "sport, automotive, delivery, performance products",
    rules: [
      "movement rendered as light trails and directional blur",
      "the article held sharp while the world around it smears",
      "one clear direction of travel through the frame",
    ],
  },
  {
    key: "grid_system",
    label: "Grid System",
    bestFor: "ranges, catalogues, comparison, platform brands",
    rules: [
      "the frame divided into an even grid of equal cells",
      "one subject or colour field per cell, consistently lit",
      "one cell deliberately different from the rest",
    ],
  },
  {
    key: "risograph_print",
    label: "Riso Print",
    bestFor: "independent brands, events, publishing, culture",
    rules: [
      "two or three flat spot inks with visible misregistration",
      "coarse halftone dots and paper showing through",
      "bold simple shapes rather than photographic detail",
    ],
  },
  {
    key: "brutalist_type",
    label: "Brutalist",
    bestFor: "fashion, music, provocative or contrarian positioning",
    rules: [
      "raw, oversized, deliberately unrefined typography as the artwork",
      "hard edges, harsh contrast, no decoration whatsoever",
      "one image element treated as a block, not as a photograph",
    ],
  },
  {
    key: "vintage_advert",
    label: "Vintage Advert",
    bestFor: "heritage brands, food, hospitality, nostalgia plays",
    rules: [
      "the layout language of a mid-century print advertisement",
      "illustrated or photographed subject with generous framed margins",
      "period composition executed with modern printing quality",
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
 * The rest deliberately re-invent their subject — an abstract single-hue crop, a
 * line schematic, a neon grid, a chart, a thing cut in half. Handing one of
 * those a real photograph asks for two incompatible things and yields neither:
 * the NuPhy WH80 came back through `monochrome_crop` recoloured, its faceted
 * edge flattened, and its key legends invented. A Product ad that has a photo is
 * therefore steered here, where the reference is an asset rather than a
 * contradiction.
 *
 * Two of these for a long time, which meant every photographed article in the
 * catalogue arrived as a studio hero or a Kinfolk table. The list is long now
 * for that reason and no other: a real photograph deserved more than two ways
 * of being looked at.
 */
export const PHOTO_SAFE_DIRECTIONS = new Set<CreativeDirectionKey>([
  "product_hero",
  "editorial_spread",
  "in_hand",
  "unboxing",
  "knolling",
  "still_life_classical",
  "levitation",
  "splash_freeze",
  "shadow_play",
  "reflection_double",
  "texture_wall",
  "botanical_study",
  "ingredient_deconstruction",
  "street_documentary",
  "interior_scene",
  "workspace_scene",
  "landscape_scale",
  "night_city",
  "liquid_suspension",
  "smoke_atmosphere",
  "kinetic_streak",
  "scale_miniature",
]);

export function isPhotoSafe(key: CreativeDirectionKey): boolean {
  return PHOTO_SAFE_DIRECTIONS.has(key);
}
