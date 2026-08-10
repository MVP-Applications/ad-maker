/** Cross-runtime metadata for the Creative Directions available to an Ad Run. */
export const CREATIVE_DIRECTIONS = [
  {
    key: "product_hero",
    label: "Product Hero",
    bestFor: "physical products, hardware, tangible goods",
  },
  {
    key: "isometric",
    label: "Isometric World",
    bestFor: "B2B SaaS, developer tools, APIs, platforms",
  },
  {
    key: "typographic",
    label: "Type Poster",
    bestFor: "statement-driven brands, abstract products, bold positioning",
  },
  {
    key: "macro_material",
    label: "Macro Material",
    bestFor: "beauty, food, fashion, premium finishes and textures",
  },
  {
    key: "gradient_field",
    label: "Gradient Field",
    bestFor: "AI products, fintech, abstract or intangible services",
  },
  {
    key: "editorial_spread",
    label: "Editorial Spread",
    bestFor: "lifestyle, food and drink, travel, hospitality",
  },
  {
    key: "sculptural_object",
    label: "Sculptural Object",
    bestFor: "tech and AI brands with no physical product",
  },
  {
    key: "data_viz",
    label: "Chart as Art",
    bestFor: "analytics, BI, observability, data platforms",
  },
  {
    key: "blueprint",
    label: "Blueprint",
    bestFor: "engineering, hardware, infrastructure, industrial",
  },
  {
    key: "retro_arcade",
    label: "Retro Arcade",
    bestFor: "gaming, entertainment, playful consumer brands",
  },
  {
    key: "monochrome_crop",
    label: "Monochrome Crop",
    bestFor: "luxury, watches, minimalist premium brands",
  },
  {
    key: "collage",
    label: "Paper Collage",
    bestFor: "agencies, education, media, creative brands",
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
