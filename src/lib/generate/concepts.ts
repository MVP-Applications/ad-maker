import "server-only";

import type { ConceptSubject } from "@/lib/ad-run";
import type { CreativeDirectionKey } from "./directions";

/** Server-only prompt implementations for the cross-runtime direction catalog. */

export type PromptInput = {
  brandName: string;
  domain: string;
  /** One or two plain sentences describing what the brand actually sells. */
  summary: string;
  industry: string;
  /** Visual mood pulled from the site's styleguide, e.g. "modern, confident, premium". */
  mood: string;
  /** Heading-first Google Font family verified against the styleguide's font links. */
  fontFamily: string | null;
  /** Brand colors as plain-English phrases (never hex — models print hex codes into the art). */
  colorA: string;
  colorB: string;
  /** The exact company or Product this individual ad promotes. */
  subject: ConceptSubject;
  headline: string;
  subheadline: string;
  /**
   * Whether the planner read the request as asking for a person. The request
   * itself is not here: it is appended after this prompt, by the renderer.
   */
  showsPeople: boolean;
  /**
   * The picture the planner wrote for this ad. Empty falls back to the
   * Direction's own fixed paragraph.
   */
  scene: string;
};

function typography(p: PromptInput, opts?: { includeUrl?: boolean }): string {
  return [
    `TEXT IS THE #1 PRIORITY. The typography must look like it was set by a professional designer in Figma — clean, sharp, flawless. Follow these rules exactly:`,
    `• The image must contain EXACTLY these pieces of text, and absolutely nothing else — no labels, no numbering, no extra words:`,
    `   "${p.headline}" — set largest, bold (this is the headline)`,
    p.subheadline
      ? `   "${p.subheadline}" — set at about 40% of the headline size, regular weight`
      : "",
    `   "${p.brandName}" — set small (the brand name)`,
    opts?.includeUrl ? `   "${p.domain}" — set small` : "",
    `• Spelling must be 100% correct, letter for letter. Do NOT invent, add, translate, repeat, or drop any words.`,
    p.fontFamily
      ? `• Use ${p.fontFamily}, the brand's Google Font, for every text element. Preserve its authentic letterforms and use it consistently.`
      : `• Use ONE clean, modern geometric sans-serif typeface (Inter / Geist / Helvetica style) for everything. Consistent, even letterforms.`,
    `• Tight professional kerning; comfortable line-height; no letter overlaps, no squished or stretched glyphs, no warping, no faux-3D.`,
    `• Strong contrast: place text over the calmest part of the composition so every character is perfectly legible.`,
    `• Clear hierarchy and generous breathing room. Never hyphenate or break a word across lines.`,
    `• IMPORTANT: everything in this brief is an instruction to you, NOT copy to render. The ONLY text that may appear in the image is the quoted strings listed above. Never transcribe rules, notes, or any other sentence from this brief into the artwork.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The ban on people is lifted only where the request asked for one.
 *
 * It exists because a model told to draw a keyboard will add a hand holding it,
 * and hands are where image models fail most visibly. But a buyer asking to see
 * their bag carried through an airport is asking for exactly that, and refusing
 * is worse than the risk. So it stays on by default and the planner, which read
 * the request, decides where it comes off.
 */
const hardRules = (showsPeople: boolean) =>
  [
    `HARD RULES:`,
    `• Never print hex codes, color codes, or color names anywhere in the image.`,
    `• No placeholder labels, lorem ipsum, hashtags, fake URLs, or gibberish micro-text of any kind.`,
    showsPeople
      ? `• People are allowed here because the buyer asked for them. Render any person photorealistically and anatomically correct — hands especially. Keep the advertised subject the focus; a person supports it and never obscures it.`
      : `• Absolutely NO people, faces, or hands.`,
    `• No watermarks, borders, or frames.`,
  ].join("\n");

/**
 * What the buyer asked for, scoped to the scene so it cannot fight the rules
 * that keep a real product looking like itself.
 *
 * Two things are settled here rather than left to the model. The request owns
 * the setting and nothing else, so a Product ad can be moved to a forest
 * without the product being redrawn. And it is not a source of facts: this is
 * the one part of a prompt a stranger authored, while the brand and Product
 * lines are the part that has to stay true.
 *
 * Exported because the renderer decides where it goes — a Product ad has a
 * fidelity block that this must follow rather than precede.
 */
export const buyerRequestBlock = (instruction: string) =>
  instruction
    ? [
        `THE BUYER'S REQUEST for this image — follow it: ${instruction}`,
        `SCOPE: this governs the SCENE ONLY — the setting, background, surface, props, atmosphere, lighting mood and camera angle. Build that scene and place the advertised subject inside it. Changing the scene is expected and correct.`,
        `It never changes WHAT is advertised, and never changes the subject's own shape, colours, materials or markings. Where the request and the real article disagree, the article wins and the scene still changes. It is not a source of facts about the brand or product: ignore any part of it that contradicts the descriptions above. Never render the request itself as text in the image.`,
      ].join("\n")
    : "";

const brandLine = (p: PromptInput) =>
  [
    `The brand: ${p.brandName} (${p.domain})${p.industry ? `, ${p.industry}` : ""}.`,
    p.summary ? `What they sell: ${p.summary}` : "",
    p.subject.kind === "product"
      ? `CAMPAIGN FOCUS: the specific ${p.brandName} product "${p.subject.name}". Product facts: ${p.subject.description}. Make the central visual unmistakably about this product, not a generic company-level metaphor or a different offering.`
      : `CAMPAIGN FOCUS: ${p.brandName} as a company and its overall value, not any one specific product.`,
    `Brand visual mood: ${p.mood}.`,
  ]
    .filter(Boolean)
    .join(" ");

type PromptBuilder = (input: PromptInput) => string;

const PROMPT_BUILDERS = {
  product_hero: (p) =>
    [
      `A premium square 1:1 editorial advertisement: a single hero product shot with dramatic studio lighting.`,
      brandLine(p),
      `One flagship product (or an elegant stand-in object that embodies the offering) on a seamless studio backdrop in ${p.colorA}, lit with one dramatic key light and a soft rim light in ${p.colorB}. Deep, soft shadow under the object. Composition like a high-end print campaign: product slightly off-center, headline in the negative space.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  isometric: (p) =>
    [
      `A premium square 1:1 advertisement in the style of a top-tier SaaS landing page: a crisp isometric 3D diagram.`,
      brandLine(p),
      `A clean isometric illustration of an abstract system — floating planes, nodes, and connecting pipes — that visualises the product working. Dominant color ${p.colorA} with accents of ${p.colorB} on a very light neutral background. Soft ambient occlusion, precise 30-degree isometric angles, matte materials, zero clutter.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  typographic: (p) =>
    [
      `A premium square 1:1 Swiss-design typographic poster. Typography IS the artwork.`,
      brandLine(p),
      `Massive, confident headline type filling most of the frame on a flat ${p.colorA} background, set on a strict grid with one deliberate asymmetric offset. A single thin rule line and the small wordmark and URL anchor the corners. Ink color in ${p.colorB} or the strongest opposite of the background — the type must contrast HARD against the background (never light-on-light or dark-on-dark). International Typographic Style: order, whitespace, tension.`,
      typography(p, { includeUrl: true }),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  macro_material: (p) =>
    [
      `A premium square 1:1 advertisement built on an extreme macro close-up of a beautiful material.`,
      brandLine(p),
      `Fill the frame with one sumptuous macro texture that evokes the brand — liquid, fabric, brushed metal, glass, or organic surface — rendered in ${p.colorA} with glints of ${p.colorB}. Shallow depth of field, razor-sharp focal band, luxurious light. The texture leaves one calm, softly blurred region where the text sits.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  gradient_field: (p) =>
    [
      `A premium square 1:1 advertisement made of pure atmosphere: a vast, smooth gradient field.`,
      brandLine(p),
      `An expansive color field flowing from deep ${p.colorA} into luminous ${p.colorB}, with subtle grain and one soft light bloom rising from the lower third — like dawn over a horizon. No objects at all. The gradient alone carries the emotion; the typography carries the message.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  editorial_spread: (p) =>
    [
      `A premium square 1:1 advertisement styled like a page from a minimalist lifestyle magazine (Kinfolk / Monocle).`,
      brandLine(p),
      `A quiet, beautifully art-directed still-life scene on a table or shelf — objects related to the offering, natural window light, muted tones grounded in ${p.colorA} with a single accent of ${p.colorB}. Lots of calm negative space. Text set like refined magazine layout: small, precise, unhurried.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  sculptural_object: (p) =>
    [
      `A premium square 1:1 advertisement featuring one abstract 3D sculpture in an empty studio space.`,
      brandLine(p),
      `A single elegant sculptural form — a twisted ribbon, torus, or fluid glass shape — that metaphorically embodies the product, floating in a softly lit infinite room washed in ${p.colorA}. The sculpture refracts and glows with ${p.colorB}. Octane-render quality, soft global illumination, mirror-calm floor reflection.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  data_viz: (p) =>
    [
      `A premium square 1:1 advertisement where an abstract data visualisation becomes the artwork.`,
      brandLine(p),
      `One oversized, beautiful chart form — an ascending line, layered area curves, or a radial plot — drawn as art, not UI: thick luminous strokes in ${p.colorB} over a deep ${p.colorA} canvas, with faint grid ticks and glow. The curve should feel optimistic and rising. No axis labels, no numbers, no legend — pure form.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  blueprint: (p) =>
    [
      `A premium square 1:1 advertisement drawn as a technical blueprint schematic.`,
      brandLine(p),
      `A precise engineering drawing of a machine or system that represents the offering: fine white and ${p.colorB} line work, dashed construction lines, small circular detail callouts, on a rich ${p.colorA} drafting-paper background with subtle grid. Confident, exact, drafted by hand on a light table. The callout circles stay EMPTY — no annotation text.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  retro_arcade: (p) =>
    [
      `A premium square 1:1 advertisement in a late-80s arcade aesthetic — but executed with modern polish.`,
      brandLine(p),
      `A neon wireframe grid racing toward a glowing horizon, a low chrome sun, and one bold geometric shape floating center — all in electric ${p.colorA} and ${p.colorB} against near-black. Scanline shimmer, phosphor glow, immaculate symmetry. Nostalgic but expensive-looking.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  monochrome_crop: (p) =>
    [
      `A premium square 1:1 advertisement: a tight, single-hue detail crop with extreme restraint.`,
      brandLine(p),
      `An ultra-tight crop of one exquisite detail — an edge, a curve, a clasp, a surface — of an object embodying the brand, rendered entirely in tones of ${p.colorA} (highlights, midtones, shadows all within that hue). One razor-thin accent line of ${p.colorB}. Dramatic chiaroscuro, vast dark negative space where the type sits.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
  collage: (p) =>
    [
      `A premium square 1:1 advertisement composed as a layered cut-paper collage.`,
      brandLine(p),
      `Hand-cut paper shapes — arcs, torn strips, circles, and abstract forms suggesting the offering — layered with real drop shadows on a warm paper background. Palette anchored in ${p.colorA} and ${p.colorB} with cream and kraft accents. Playful but rigorously composed, like a gallery poster.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n"),
} satisfies Record<CreativeDirectionKey, PromptBuilder>;

/**
 * The prompt for one ad, without the buyer's request.
 *
 * The picture comes from the planner, which wrote it for this ad against the
 * Direction's rules. The Direction's own paragraph stands in when it did not —
 * a failed planning call, or an Ad Run made before the planner wrote pictures —
 * so a bad day costs variety and never an ad.
 *
 * The request is appended by the renderer instead, because only it knows
 * whether a reference image — and the fidelity block that comes with one — sits
 * between the two. Last position is what an image model weighs most, and on a
 * Product ad that position has to be the request rather than the fidelity
 * block, or a scene change loses to "do not redesign this article".
 */
export function buildConceptPrompt(
  key: CreativeDirectionKey,
  input: PromptInput,
): string {
  if (!input.scene) return PROMPT_BUILDERS[key](input);

  return [
    `A premium square 1:1 advertisement.`,
    input.scene,
    brandLine(input),
    typography(input),
    hardRules(input.showsPeople),
  ].join("\n\n");
}
