import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ planAdRunConcepts: vi.fn() }));

vi.mock("@/lib/generate/planner", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/generate/planner")>();
  return { ...original, planAdRunConcepts: mocks.planAdRunConcepts };
});

import type { AdRunBrief, AdRunPlan } from "@/lib/ad-run";
import { CREATIVE_DIRECTIONS } from "@/lib/generate/directions";
import { IMAGE_MODELS } from "@/lib/generate/models";
import { POST } from "./route";

const brief: AdRunBrief["brief"] = {
  domain: "stripe.com",
  brandName: "Stripe",
  description: "Financial infrastructure for the internet.",
  headline: "Payments infrastructure for the internet.",
  industry: "Technology · Payments",
  summary: "Stripe provides programmable financial services.",
  mood: "modern, confident, premium",
  fontFamily: "Inter",
  colorA: "rich indigo",
  colorB: "deep navy",
  logoUrl: null,
  heroImageUrl: null,
  languages: ["en"],
  colors: [{ hex: "#635bff", name: "Purple" }],
};

const adRunBrief: AdRunBrief = {
  brief,
  products: [
    {
      name: "Payments",
      description: "Accept payments online and in person.",
      imageUrl: null,
      price: null,
      currency: null,
      url: null,
      flagship: true,
    },
  ],
};

const plan: AdRunPlan = {
  brief,
  concepts: [0, 1, 2, 3].map((index) => ({
    key: CREATIVE_DIRECTIONS[index].key,
    model: IMAGE_MODELS[index].id,
    subject:
      index < 3
        ? { kind: "company" as const }
        : {
            // A Concept subject carries only what an ad may show — no price,
            // no shop URL, no shortlist mark.
            kind: "product" as const,
            name: "Payments",
            description: "Accept payments online and in person.",
            imageUrl: null,
          },
    headline: `Concept ${index + 1}`,
    subheadline: "A concise supporting line",
    instruction: "",
    showsPeople: false,
  })),
};

const post = (body: unknown) =>
  new Request("https://branda.test/api/concepts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/concepts", () => {
  beforeEach(() => {
    mocks.planAdRunConcepts.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("plans an Ad Run from the posted Brief and never caches it", async () => {
    mocks.planAdRunConcepts.mockResolvedValue({ ok: true, value: plan });

    const response = await POST(post(adRunBrief));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(plan);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect(mocks.planAdRunConcepts).toHaveBeenCalledWith(
      adRunBrief,
      expect.any(AbortSignal),
    );
  });

  // The one field a person types. It rides alongside the Brief rather than
  // inside it, because a Brief describes a shop and this describes one request.
  it("forwards the buyer's request to the planner", async () => {
    mocks.planAdRunConcepts.mockResolvedValue({ ok: true, value: plan });

    const response = await POST(
      post({ ...adRunBrief, instruction: "a man walking through an airport" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.planAdRunConcepts).toHaveBeenCalledWith(
      { ...adRunBrief, instruction: "a man walking through an airport" },
      expect.any(AbortSignal),
    );
  });

  it("plans without one when the body omits it", async () => {
    mocks.planAdRunConcepts.mockResolvedValue({ ok: true, value: plan });

    await POST(post(adRunBrief));

    expect(mocks.planAdRunConcepts).toHaveBeenCalledWith(
      { ...adRunBrief, instruction: undefined },
      expect.any(AbortSignal),
    );
  });

  // The Brief made a round trip through the browser, so it is re-validated here
  // exactly as the Rendered Ad query is; nothing is trusted for having come back.
  it.each([
    ["a malformed body", "not json"],
    ["a missing brief", { products: adRunBrief.products }],
    ["an unknown field", { ...adRunBrief, extra: true }],
    ["an empty catalog", { brief, products: [] }],
    ["a noncanonical domain", { ...adRunBrief, brief: { ...brief, domain: "WWW.Stripe.com" } }],
    [
      "duplicate Products",
      {
        brief,
        products: [adRunBrief.products[0], { ...adRunBrief.products[0] }],
      },
    ],
  ])("rejects %s with 400 before planning", async (_label, body) => {
    const response = await POST(post(body));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.planAdRunConcepts).not.toHaveBeenCalled();
  });

  it.each([
    ["not-configured", 503],
    ["aborted", 499],
    ["internal", 500],
  ] as const)("maps %s to a no-store %s", async (code, status) => {
    const error =
      code === "internal"
        ? { code, cause: new Error("private deployment detail") }
        : { code };
    mocks.planAdRunConcepts.mockResolvedValue({ ok: false, error });

    const response = await POST(post(adRunBrief));
    const body = await response.text();

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).not.toContain("OPENAI_API_KEY");
    expect(body).not.toContain("FAL_KEY");
    expect(body).not.toContain("private deployment detail");
  });
});
