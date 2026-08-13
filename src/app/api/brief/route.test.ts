import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ researchAdRunBrief: vi.fn() }));

vi.mock("@/lib/generate/planner", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/generate/planner")>();
  return { ...original, researchAdRunBrief: mocks.researchAdRunBrief };
});

import type { AdRunBrief } from "@/lib/ad-run";
import { GET } from "./route";

const adRunBrief: AdRunBrief = {
  brief: {
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
  },
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
    {
      name: "Billing",
      description: "Manage subscriptions and recurring revenue.",
      imageUrl: null,
      price: null,
      currency: null,
      url: null,
      flagship: true,
    },
  ],
};

const request = (domain = "stripe.com", version: string | null = "5") => {
  const params = new URLSearchParams({ domain });
  if (version !== null) params.set("v", version);
  return new Request(`https://branda.test/api/brief?${params.toString()}`);
};

describe("GET /api/brief", () => {
  beforeEach(() => {
    mocks.researchAdRunBrief.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns the validated Brief with canonical cache headers", async () => {
    mocks.researchAdRunBrief.mockResolvedValue({ ok: true, value: adRunBrief });

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(adRunBrief);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(response.headers.get("cdn-cache-control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(mocks.researchAdRunBrief).toHaveBeenCalledWith(
      "stripe.com",
      expect.any(AbortSignal),
    );
  });

  // Concepts follow a choice made against this Brief, so the route that serves
  // it must not plan any.
  it("serves the catalog without planning concepts", async () => {
    mocks.researchAdRunBrief.mockResolvedValue({ ok: true, value: adRunBrief });

    const body = await (await GET(request())).json();

    expect(body).not.toHaveProperty("concepts");
    expect(body.products).toHaveLength(2);
  });

  it.each([
    ["an unversioned request", "stripe.com", null],
    ["an old format version", "stripe.com", "4"],
    ["an equivalent domain", "HTTPS://WWW.Stripe.com/pricing", "5"],
  ] as const)(
    "redirects %s to the versioned canonical cache key before researching",
    async (_label, domain, version) => {
      const response = await GET(request(domain, version));

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(
        "https://branda.test/api/brief?domain=stripe.com&v=5",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.researchAdRunBrief).not.toHaveBeenCalled();
    },
  );

  it.each([
    "/api/brief?domain=stripe.com&domain=linear.app",
    "/api/brief?domain=stripe.com&v=5&v=5",
    "/api/brief?domain=stripe.com&extra=true",
  ])("rejects ambiguous query %s", async (path) => {
    const response = await GET(new Request(new URL(path, "https://branda.test")));

    expect(response.status).toBe(400);
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect(mocks.researchAdRunBrief).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid-domain", 400],
    ["not-configured", 503],
    ["aborted", 499],
    ["domain-unreachable", 502],
    ["brand-unavailable", 502],
    ["products-unavailable", 502],
    ["internal", 500],
  ] as const)("maps %s to a no-store %s", async (code, status) => {
    const error =
      code === "internal" ||
      code === "domain-unreachable" ||
      code === "brand-unavailable" ||
      code === "products-unavailable"
        ? { code, cause: new Error("private deployment detail") }
        : { code };
    mocks.researchAdRunBrief.mockResolvedValue({ ok: false, error });

    const response = await GET(request());
    const body = await response.text();

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).not.toContain("OPENAI_API_KEY");
    expect(body).not.toContain("FAL_KEY");
    expect(body).not.toContain("private deployment detail");
  });
});
