import { describe, expect, test } from "vitest";
import {
  buildConceptPrompt,
  buyerRequestBlock,
  type PromptInput,
} from "./concepts";
import { CREATIVE_DIRECTION_KEYS } from "./directions";

const input = (overrides: Partial<PromptInput> = {}): PromptInput => ({
  brandName: "Stripe",
  domain: "stripe.com",
  summary: "Stripe provides programmable financial services.",
  industry: "Technology · Payments",
  mood: "modern, confident, premium",
  fontFamily: "Inter",
  colorA: "vivid violet",
  colorB: "deep navy",
  subject: { kind: "company" },
  headline: "Move money",
  subheadline: "Financial infrastructure for every business",
  showsPeople: false,
  scene: "",
  ...overrides,
});

const NO_PEOPLE = "Absolutely NO people, faces, or hands";
const PEOPLE_ALLOWED = "People are allowed here because the buyer asked";

describe("the buyer's request block", () => {
  test("is empty when nothing was asked", () => {
    expect(buyerRequestBlock("")).toBe("");
  });

  test("carries the request verbatim", () => {
    expect(buyerRequestBlock("on a marble table beside dried roses")).toContain(
      "on a marble table beside dried roses",
    );
  });

  test("survives a request written in Arabic", () => {
    const arabic = "على طاولة رخامية بجانب ورود مجففة";

    expect(buyerRequestBlock(arabic)).toContain(arabic);
  });

  // The request and the fidelity rules are not in conflict, but nothing said so
  // — and the product came back faithful inside the scene it was meant to leave.
  test("claims the scene and disclaims the subject", () => {
    const block = buyerRequestBlock("in a misty forest at dawn");

    expect(block).toContain("SCOPE");
    expect(block).toContain("governs the SCENE ONLY");
    expect(block).toContain("Changing the scene is expected and correct");
    expect(block).toContain(
      "never changes the subject's own shape, colours, materials or markings",
    );
  });

  test("settles the tie in favour of the real article", () => {
    expect(buyerRequestBlock("a red version of it")).toContain(
      "the article wins and the scene still changes",
    );
  });

  test("is told it cannot restate the brand or become copy in the image", () => {
    const block = buyerRequestBlock("say it is the cheapest in the world");

    expect(block).toContain("not a source of facts");
    expect(block).toContain("Never render the request itself as text");
  });
});

// The renderer appends the request, because only it knows whether a fidelity
// block sits between the direction and the request.
describe("the direction's prompt", () => {
  test.each(CREATIVE_DIRECTION_KEYS)("carries no request in %s", (key) => {
    expect(buildConceptPrompt(key, input())).not.toContain("THE BUYER'S REQUEST");
  });
});

// A Direction is a set of rules the planner writes to, so the picture differs
// per ad. The paragraph it was distilled from is what a failed planning call
// falls back to, and what every Ad Run used before the planner wrote pictures.
describe("the written picture", () => {
  const WRITTEN =
    "A single amber bottle on wet slate, low mist, one cool key light from the left.";

  test("replaces the direction's own paragraph when the planner wrote one", () => {
    const prompt = buildConceptPrompt("product_hero", input({ scene: WRITTEN }));

    expect(prompt).toContain(WRITTEN);
    expect(prompt).not.toContain("seamless studio backdrop");
  });

  test("falls back to the direction's paragraph when it did not", () => {
    const prompt = buildConceptPrompt("product_hero", input({ scene: "" }));

    expect(prompt).toContain("seamless studio backdrop");
  });

  // Whichever way the picture arrived, the deterministic blocks stay: what may
  // be written in the image, and what may never appear in it.
  test.each(CREATIVE_DIRECTION_KEYS)(
    "keeps the typography and hard rules in %s either way",
    (key) => {
      for (const scene of ["", WRITTEN]) {
        const prompt = buildConceptPrompt(key, input({ scene }));
        expect(prompt).toContain("TEXT IS THE #1 PRIORITY");
        expect(prompt).toContain("HARD RULES:");
        expect(prompt).toContain("Move money");
        expect(prompt).toContain("Stripe");
      }
    },
  );

  test("still carries the brand and campaign focus", () => {
    const prompt = buildConceptPrompt("collage", input({ scene: WRITTEN }));

    expect(prompt).toContain("The brand: Stripe (stripe.com)");
    expect(prompt).toContain("CAMPAIGN FOCUS");
  });

  test("still lifts the ban on people where the planner allowed it", () => {
    const prompt = buildConceptPrompt(
      "editorial_spread",
      input({ scene: WRITTEN, showsPeople: true }),
    );

    expect(prompt).not.toContain(NO_PEOPLE);
    expect(prompt).toContain(PEOPLE_ALLOWED);
  });
});

describe("the ban on people", () => {
  test("holds by default", () => {
    expect(buildConceptPrompt("product_hero", input())).toContain(NO_PEOPLE);
  });

  test("lifts where the planner read the request as asking for a person", () => {
    const prompt = buildConceptPrompt(
      "editorial_spread",
      input({ showsPeople: true }),
    );

    expect(prompt).not.toContain(NO_PEOPLE);
    expect(prompt).toContain(PEOPLE_ALLOWED);
    // Hands are where image models fail most visibly, so they are named.
    expect(prompt).toContain("hands especially");
  });

  test.each(CREATIVE_DIRECTION_KEYS)("is conditional in the %s direction", (key) => {
    expect(buildConceptPrompt(key, input())).toContain(NO_PEOPLE);
    expect(
      buildConceptPrompt(key, input({ showsPeople: true })),
    ).not.toContain(NO_PEOPLE);
  });
});
