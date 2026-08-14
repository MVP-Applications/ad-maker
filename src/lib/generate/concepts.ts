import "server-only";

import type { ConceptSubject } from "@/lib/ad-run";
import {
  CREATIVE_DIRECTIONS,
  CREATIVE_DIRECTION_KEYS,
  type CreativeDirectionKey,
} from "./directions";

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

/**
 * The picture a Direction describes when nothing wrote one for this ad.
 *
 * Assembled from the Direction's own `rules`, which is what that field was for:
 * the twelve paragraphs below were distilled into rules precisely so a rule set
 * could stand in for its paragraph. It costs some of the prose — a hand-written
 * sentence about phosphor glow reads better than a bulleted one — and it buys
 * the thing that matters more, which is that the catalogue can grow without
 * every new Direction owing a paragraph before it is allowed to exist.
 */
function fromRules(key: CreativeDirectionKey): PromptBuilder {
  const direction = CREATIVE_DIRECTIONS.find((c) => c.key === key);
  return (p) =>
    [
      `A premium square 1:1 advertisement${direction ? ` in the style of ${direction.label}` : ""}.`,
      brandLine(p),
      direction
        ? [
            `Build the picture to these rules, in ${p.colorA} with accents of ${p.colorB}:`,
            ...direction.rules.map((rule) => `• ${rule}`),
          ].join("\n")
        : `A confident, well-composed advertising image in ${p.colorA} with accents of ${p.colorB}.`,
      typography(p),
      hardRules(p.showsPeople),
    ].join("\n\n");
}



/**
 * One builder per family, every one assembled from that family's own rules.
 *
 * There were twelve hand-written paragraphs here once, one per Creative
 * Direction, each welding a subject treatment to a light to a palette to a
 * camera. They are gone with the directions they described: a family says what
 * a picture MEANS, and the look is composed from the craft axes underneath it,
 * so a fixed paragraph would now be a second opinion competing with the plan.
 */
const PROMPT_BUILDERS: Record<CreativeDirectionKey, PromptBuilder> =
  Object.fromEntries(
    CREATIVE_DIRECTION_KEYS.map((key) => [key, fromRules(key)]),
  ) as Record<CreativeDirectionKey, PromptBuilder>;

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
