/**
 * What an image model is told about a real article it has been shown.
 *
 * Both paths that attach a photograph need this and neither can be trusted to
 * remember all of it: the Ad Run shows one article, the studio shows up to five,
 * and every paragraph below was added to answer a specific way the picture came
 * back wrong.
 *
 * The three are ordered as a chain of scope. The first says reproduce the
 * article; the second takes the palette away from it; the third gives the scene
 * back to everything else.
 */

/**
 * The palette and a real article, read together, say "recolour this". They did:
 * a white keyboard came back tinted brand-teal with its chamfered edge
 * flattened, because a single-hue render deletes the contrast an edge is made
 * of. So the palette is scoped to the scene, here, where it wins.
 */
const COLOUR_OVERRIDE =
  "COLOUR OVERRIDE — this outranks the palette instructions above: the brand colours apply to the BACKGROUND, the lighting, and the TYPOGRAPHY only.";

/**
 * Without this the block reads as "change nothing", and the scene that was
 * asked for loses to it: the product came back faithful and the forest it was
 * supposed to be standing in never appeared.
 */
const SCENE_IS_SET_ELSEWHERE =
  "The setting, background, surface, props, atmosphere and camera are set elsewhere in this brief — build whatever scene is described there and place";

/** One article, attached to one render. What the Ad Run has always sent. */
export function oneArticleFidelity(productName: string): string {
  return [
    `The attached image is the REAL ${productName}. The product shown in this ad MUST be this exact article — match its silhouette, proportions, panel edges, materials, finish and markings faithfully. Study the reference and reproduce its geometry; never redesign it, never substitute a similar-looking product, and never invent surface details it does not have.`,
    `${COLOUR_OVERRIDE} The product itself keeps its own real colours and materials exactly as photographed. Do not tint, recolour, or restyle it to match the palette.`,
    `SCOPE: everything above governs the PRODUCT ITSELF, not the picture around it. ${SCENE_IS_SET_ELSEWHERE} this exact article into it. Relighting the product to match that scene is correct; redrawing the product is not.`,
  ].join("\n\n");
}

/**
 * Several articles in one picture, addressed by the number they were listed
 * under. The singular version cannot simply be repeated per photograph: said
 * five times, "the product shown MUST be this exact article" is five claims
 * about the same picture, and the numbering is the only thing that says which
 * article each one is about.
 */
export function manyArticlesFidelity(count: number): string {
  return [
    `The ${count} attached photographs are the REAL articles, each one belonging to the Product it is numbered against above. Every product shown in this image MUST be one of those exact articles — match each one's silhouette, proportions, panel edges, materials, finish and markings faithfully. Study each reference and reproduce its geometry; never redesign one, never substitute a similar-looking product, and never invent surface details it does not have.`,
    `${COLOUR_OVERRIDE} Each product keeps its own real colours and materials exactly as photographed, including where two of them differ from each other. Do not tint, recolour, or restyle them to match the palette or to match one another.`,
    `SCOPE: everything above governs the PRODUCTS THEMSELVES, not the picture around them. ${SCENE_IS_SET_ELSEWHERE} these exact articles into it. Relighting them to match that scene is correct; redrawing them is not.`,
  ].join("\n\n");
}
