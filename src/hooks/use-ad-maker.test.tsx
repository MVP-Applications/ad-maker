// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdRunBrief, AdRunPlan, PlannedConcept } from "@/lib/ad-run";
import { CREATIVE_DIRECTIONS } from "@/lib/generate/directions";
import { IMAGE_MODELS } from "@/lib/generate/models";
import { useAdMaker, type AdMakerController } from "./use-ad-maker";

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function planFor(
  domain = "stripe.com",
  productCount: 1 | 2 | 3 = 3,
): AdRunPlan {
  const products = [
    {
      name: "Payments",
      description: "Programmable payment acceptance for internet businesses.",
      imageUrl: null,
      price: null,
      currency: null,
      url: null,
      flagship: true,
    },
    {
      name: "Billing",
      description: "Subscription and invoicing tools for recurring revenue.",
      imageUrl: null,
      price: null,
      currency: null,
      url: null,
      flagship: true,
    },
    {
      name: "Connect",
      description: "Payments infrastructure for platforms and marketplaces.",
      imageUrl: null,
      price: null,
      currency: null,
      url: null,
      flagship: true,
    },
  ] as const;
  const concepts: PlannedConcept[] = CREATIVE_DIRECTIONS.slice(
    0,
    3 + productCount,
  ).map((direction, index) => {
    const product = products[index - 3];
    return {
      key: direction.key,
      model: IMAGE_MODELS[index].id,
      subject:
        index < 3
          ? { kind: "company" as const }
          : {
              kind: "product" as const,
              name: product.name,
              description: product.description,
              imageUrl: product.imageUrl,
            },
      headline: `Concept ${index + 1}`,
      subheadline: "A concise supporting line",
    };
  });

  return {
    brief: {
      domain,
      brandName: "Stripe",
      description: "Financial infrastructure for the internet.",
  headline: "Payments infrastructure for the internet.",
      industry: "Technology · Payments",
      summary: "Stripe provides programmable financial services.",
      mood: "modern, confident, premium",
      fontFamily: "Inter",
      colorA: "vivid violet",
      colorB: "deep navy",
      logoUrl: null,
      heroImageUrl: null,
      languages: ["en"],
      colors: [{ hex: "#635bff", name: "Purple" }],
    },
    concepts,
  };
}

/** The Brief that precedes a plan: same brand, and the Products it advertises. */
function briefFor(plan: AdRunPlan): AdRunBrief {
  return {
    brief: plan.brief,
    products: plan.concepts.flatMap(({ subject }) =>
      subject.kind === "product"
        ? [
            {
              name: subject.name,
              description: subject.description,
              imageUrl: subject.imageUrl,
              price: 99,
              currency: "USD",
              url: null,
              flagship: true,
            },
          ]
        : [],
    ),
  };
}

function jsonResponse(value: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 502,
    json: async () => value,
  } as Response;
}

/**
 * The two planning calls that now precede every Rendered Ad. Returns null for
 * an ad request so each test can keep its own render behavior.
 */
function planningResponse(plan: AdRunPlan, href: string): Response | null {
  if (href.startsWith("/api/brief")) return jsonResponse(briefFor(plan));
  if (href.startsWith("/api/concepts")) return jsonResponse(plan);
  return null;
}

function imageResponse(type = "image/png", ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 502,
    blob: async () => new Blob(["image"], { type }),
  } as Response;
}

function atPhase<Phase extends AdMakerController["phase"]>(
  controller: AdMakerController,
  phase: Phase,
): Extract<AdMakerController, { phase: Phase }> {
  expect(controller.phase).toBe(phase);
  if (controller.phase !== phase) throw new Error(`Expected ${phase}`);
  return controller as Extract<AdMakerController, { phase: Phase }>;
}

/**
 * The run now stops twice before it makes anything — once on the catalogue and
 * once on the Brief — so every test that wants ads walks through both. The
 * catalogue arrives fully selected, so keeping it whole is the default path.
 */
async function startAndGenerate(
  result: { current: AdMakerController },
  domain = "stripe.com",
): Promise<void> {
  await act(() => atPhase(result.current, "idle").start(domain));
  act(() => atPhase(result.current, "catalog").confirmSelection());
  act(() => atPhase(result.current, "dna").confirmBrand());
  await act(() => atPhase(result.current, "compose").generate());
}

describe("useAdMaker", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const createObjectURL = vi.fn<(blob: Blob) => string>();
  const revokeObjectURL = vi.fn<(url: string) => void>();

  beforeEach(() => {
    let nextUrl = 0;
    fetchMock.mockReset();
    createObjectURL.mockReset();
    createObjectURL.mockImplementation(() => `blob:ad-${++nextUrl}`);
    revokeObjectURL.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("canonicalizes a mixed-case submitted domain before planning", async () => {
    const pendingAd = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const planning = planningResponse(planFor(), String(input));
      return planning ? Promise.resolve(planning) : pendingAd.promise;
    });
    const { result, unmount } = renderHook(() => useAdMaker());

    await startAndGenerate(result, "HTTPS://WWW.Stripe.COM/Pricing");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/brief?domain=stripe.com&v=5",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/concepts");
    const generating = atPhase(result.current, "generating");
    expect(generating.submittedDomain).toBe("stripe.com");
    expect(generating.brief.domain).toBe("stripe.com");
    unmount();
  });

  // The Brief is an answer on its own now: it arrives, and the run waits.
  it("stops at the Brief and plans nothing until asked", async () => {
    const plan = planFor();
    const pendingAd = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const planning = planningResponse(plan, String(input));
      return planning ? Promise.resolve(planning) : pendingAd.promise;
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));

    // The catalogue arrives whole and entirely selected.
    const catalog = atPhase(result.current, "catalog");
    expect(catalog.brief.domain).toBe("stripe.com");
    expect(catalog.products).toEqual(briefFor(plan).products);
    expect(catalog.selectedCount).toBe(catalog.products.length);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/brief?domain=stripe.com&v=5",
    );

    act(() => catalog.confirmSelection());

    act(() => atPhase(result.current, "dna").confirmBrand());

    const compose = atPhase(result.current, "compose");
    expect(compose.products).toEqual(briefFor(plan).products);
    expect(compose.planning).toBe(false);
    expect(compose.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(() => compose.generate());

    expect(result.current.phase).toBe("generating");
  });

  it("keeps only the Products still selected when the catalogue is confirmed", async () => {
    const plan = planFor();
    const pendingAd = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const planning = planningResponse(plan, String(input));
      return planning ? Promise.resolve(planning) : pendingAd.promise;
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    act(() => atPhase(result.current, "catalog").deselectAll());
    expect(atPhase(result.current, "catalog").selectedCount).toBe(0);

    // Names are keyed case-insensitively, as the contract treats them.
    act(() => atPhase(result.current, "catalog").toggleProduct("BILLING"));
    expect(atPhase(result.current, "catalog").selectedCount).toBe(1);

    act(() => atPhase(result.current, "catalog").confirmSelection());

    expect(atPhase(result.current, "dna").products.map(({ name }) => name))
      .toEqual(["Billing"]);
  });

  // The cut is reversible: Back restores the catalogue and the selection that
  // produced it, so a wrong choice costs a click and not the whole extract.
  it("returns to the catalogue with the selection intact", async () => {
    const plan = planFor();
    const pendingAd = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const planning = planningResponse(plan, String(input));
      return planning ? Promise.resolve(planning) : pendingAd.promise;
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    const total = atPhase(result.current, "catalog").products.length;
    act(() => atPhase(result.current, "catalog").toggleProduct("Connect"));
    act(() => atPhase(result.current, "catalog").confirmSelection());

    expect(atPhase(result.current, "dna").products).toHaveLength(total - 1);

    act(() => atPhase(result.current, "dna").back());

    const catalog = atPhase(result.current, "catalog");
    expect(catalog.products).toHaveLength(total);
    expect(catalog.selectedCount).toBe(total - 1);
  });

  /**
   * The Brief is corrected on the same screen that leads back to the
   * catalogue, so the trip back must carry the corrections. Restoring the
   * catalogue wholesale restores the Brief the extract produced with it, and
   * every correction is lost without anything on screen saying so.
   */
  it("keeps Brief corrections across a trip back to the catalogue", async () => {
    const plan = planFor();
    const pendingAd = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const planning = planningResponse(plan, String(input));
      return planning ? Promise.resolve(planning) : pendingAd.promise;
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    act(() => atPhase(result.current, "catalog").confirmSelection());

    act(() =>
      atPhase(result.current, "dna").editBrief({
        brandName: "Corrected Name",
        fontFamily: "Georgia",
      }),
    );
    expect(atPhase(result.current, "dna").brief.brandName).toBe("Corrected Name");

    act(() => atPhase(result.current, "dna").back());
    act(() => atPhase(result.current, "catalog").confirmSelection());

    const dna = atPhase(result.current, "dna");
    expect(dna.brief.brandName).toBe("Corrected Name");
    expect(dna.brief.fontFamily).toBe("Georgia");
  });

  it("keeps or adds one Product without leaving the Brief", async () => {
    const plan = planFor();
    const pendingAd = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const planning = planningResponse(plan, String(input));
      return planning ? Promise.resolve(planning) : pendingAd.promise;
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    act(() => atPhase(result.current, "catalog").confirmSelection());

    const before = atPhase(result.current, "dna");
    const total = before.catalogue.length;
    const dropped = before.products[0].name;
    expect(before.products).toHaveLength(total);

    act(() => atPhase(result.current, "dna").toggleProduct(dropped));
    expect(atPhase(result.current, "dna").products).toHaveLength(total - 1);

    // Dropped, not gone: the catalogue still offers it back.
    expect(atPhase(result.current, "dna").catalogue).toHaveLength(total);
    act(() => atPhase(result.current, "dna").toggleProduct(dropped));
    expect(atPhase(result.current, "dna").products).toHaveLength(total);
  });

  it("gathers the hero shot and the catalogue's photographs for review", async () => {
    const plan = planFor();
    const catalogue = briefFor(plan).products.map((product, index) => ({
      ...product,
      imageUrl: index === 2 ? null : `https://cdn.example.com/p${index}.png`,
    }));
    fetchMock.mockImplementation((input) => {
      const href = String(input);
      if (href.startsWith("/api/brief")) {
        return Promise.resolve(
          jsonResponse({
            brief: { ...plan.brief, heroImageUrl: "https://cdn.example.com/hero.png" },
            products: catalogue,
          }),
        );
      }
      return Promise.resolve(planningResponse(plan, href) ?? imageResponse());
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    act(() => atPhase(result.current, "catalog").confirmSelection());

    // Hero first, then the catalogue's own, and never a Product without one.
    expect(atPhase(result.current, "dna").images).toEqual([
      "https://cdn.example.com/hero.png",
      "https://cdn.example.com/p0.png",
      "https://cdn.example.com/p1.png",
    ]);
  });

  it("toggles a Product off and on, and restores the whole catalogue", async () => {
    const plan = planFor();
    const pendingAd = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const planning = planningResponse(plan, String(input));
      return planning ? Promise.resolve(planning) : pendingAd.promise;
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    const total = atPhase(result.current, "catalog").products.length;

    act(() => atPhase(result.current, "catalog").toggleProduct("Payments"));
    expect(atPhase(result.current, "catalog").selectedCount).toBe(total - 1);

    act(() => atPhase(result.current, "catalog").toggleProduct("Payments"));
    expect(atPhase(result.current, "catalog").selectedCount).toBe(total);

    act(() => atPhase(result.current, "catalog").deselectAll());
    act(() => atPhase(result.current, "catalog").selectAll());
    expect(atPhase(result.current, "catalog").selectedCount).toBe(total);
  });

  // An Ad Run advertises flagships, so a selection holding none of them would
  // plan nothing at all. The kept Products are re-marked instead.
  it("re-marks the kept Products when the selection holds no flagship", async () => {
    const plan = planFor();
    const catalogue = briefFor(plan).products.map((product, index) => ({
      ...product,
      flagship: index === 0,
    }));
    const pendingAd = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const href = String(input);
      if (href.startsWith("/api/brief")) {
        return Promise.resolve(
          jsonResponse({ brief: plan.brief, products: catalogue }),
        );
      }
      if (href.startsWith("/api/concepts")) return Promise.resolve(jsonResponse(plan));
      return pendingAd.promise;
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    act(() => atPhase(result.current, "catalog").deselectAll());
    // "Connect" was not the flagship; keeping only it would leave none.
    act(() => atPhase(result.current, "catalog").toggleProduct("Connect"));
    act(() => atPhase(result.current, "catalog").confirmSelection());

    const kept = atPhase(result.current, "dna").products;
    expect(kept.map(({ name }) => name)).toEqual(["Connect"]);
    expect(kept.every(({ flagship }) => flagship)).toBe(true);
  });

  // Keeping only Products the shop never described leaves nothing to write an
  // ad about. Refused here, where the choice was made, rather than two screens
  // later as a planning failure.
  it("refuses a selection holding no Product it could advertise", async () => {
    const plan = planFor();
    const catalogue = briefFor(plan).products.map((product, index) =>
      index === 0 ? product : { ...product, description: "", flagship: false },
    );
    fetchMock.mockImplementation((input) => {
      const href = String(input);
      if (href.startsWith("/api/brief")) {
        return Promise.resolve(
          jsonResponse({ brief: plan.brief, products: catalogue }),
        );
      }
      return Promise.resolve(
        planningResponse(plan, href) ?? imageResponse(),
      );
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    act(() => atPhase(result.current, "catalog").deselectAll());
    act(() => atPhase(result.current, "catalog").toggleProduct("Billing"));

    const catalog = atPhase(result.current, "catalog");
    expect(catalog.selectedCount).toBe(1);
    expect(catalog.advertisableCount).toBe(0);

    act(() => catalog.confirmSelection());

    expect(result.current.phase).toBe("catalog");
  });

  it("refuses to leave the catalogue with nothing selected", async () => {
    const plan = planFor();
    fetchMock.mockImplementation((input) =>
      Promise.resolve(planningResponse(plan, String(input)) ?? imageResponse()),
    );
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    act(() => atPhase(result.current, "catalog").deselectAll());
    act(() => atPhase(result.current, "catalog").confirmSelection());

    expect(result.current.phase).toBe("catalog");
  });

  // A failed plan must not cost the extract that produced the Brief, so the
  // choices made against it survive and can simply be sent again.
  it("keeps the Brief when planning fails and can be asked again", async () => {
    const plan = planFor();
    let conceptCalls = 0;
    fetchMock.mockImplementation((input) => {
      const href = String(input);
      if (href.startsWith("/api/brief")) {
        return Promise.resolve(jsonResponse(briefFor(plan)));
      }
      if (href.startsWith("/api/concepts")) {
        conceptCalls += 1;
        return Promise.resolve(
          conceptCalls === 1
            ? jsonResponse({ error: "Director unavailable." }, false)
            : jsonResponse(plan),
        );
      }
      return Promise.resolve(imageResponse());
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    act(() => atPhase(result.current, "catalog").confirmSelection());
    act(() => atPhase(result.current, "dna").confirmBrand());
    await act(() => atPhase(result.current, "compose").generate());

    const failed = atPhase(result.current, "compose");
    expect(failed.error).toBe("Director unavailable.");
    expect(failed.planning).toBe(false);
    expect(failed.products).toEqual(briefFor(plan).products);

    await act(() => failed.generate());

    await waitFor(() => expect(result.current.phase).toBe("done"));
    // One Brief, two planning attempts, then the ads.
    expect(conceptCalls).toBe(2);
  });

  it("ignores a second request to generate while one is in flight", async () => {
    const pendingPlan = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const href = String(input);
      if (href.startsWith("/api/brief")) {
        return Promise.resolve(jsonResponse(briefFor(planFor())));
      }
      if (href.startsWith("/api/concepts")) return pendingPlan.promise;
      return Promise.resolve(imageResponse());
    });
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    act(() => atPhase(result.current, "catalog").confirmSelection());
    act(() => atPhase(result.current, "dna").confirmBrand());
    const compose = atPhase(result.current, "compose");
    void compose.generate();
    await waitFor(() =>
      expect(atPhase(result.current, "compose").planning).toBe(true),
    );

    await act(() => atPhase(result.current, "compose").generate());

    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).startsWith("/api/concepts"),
      ),
    ).toHaveLength(1);

    await act(async () => {
      pendingPlan.resolve(jsonResponse(planFor()));
      await pendingPlan.promise;
    });
  });

  it("rejects a valid Brief for a domain other than the submitted domain", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(briefFor(planFor("linear.app"))));
    const { result } = renderHook(() => useAdMaker());
    const start = atPhase(result.current, "idle").start;

    await act(() => start("stripe.com"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(atPhase(result.current, "idle").error).toBe(
      "The Brief did not match the submitted domain.",
    );
    expect(atPhase(result.current, "idle").domain).toBe("stripe.com");
  });

  // The Brief and the Ad Run planned from it are two answers now, and both are
  // checked: a plan that comes back for another brand never reaches a slot.
  it("rejects a planned Ad Run for a domain other than the submitted domain", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        String(input).startsWith("/api/brief")
          ? jsonResponse(briefFor(planFor()))
          : jsonResponse(planFor("linear.app")),
      ),
    );
    const { result } = renderHook(() => useAdMaker());

    await act(() => atPhase(result.current, "idle").start("stripe.com"));
    act(() => atPhase(result.current, "catalog").confirmSelection());
    act(() => atPhase(result.current, "dna").confirmBrand());
    await act(() => atPhase(result.current, "compose").generate());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(atPhase(result.current, "compose").error).toBe(
      "The Ad Run did not match the submitted domain.",
    );
  });

  it("stays generating when the original requests settle before an in-flight retry", async () => {
    const plan = planFor();
    const total = plan.concepts.length;
    const originalRenders = deferred<Response>();
    const retry = deferred<Response>();
    let adRequest = 0;
    fetchMock.mockImplementation((input) => {
      const planning = planningResponse(plan, String(input));
      if (planning) return Promise.resolve(planning);
      adRequest += 1;
      if (adRequest === 1)
        return Promise.resolve(imageResponse("image/png", false));
      if (adRequest <= total) return originalRenders.promise;
      return retry.promise;
    });
    const { result } = renderHook(() => useAdMaker());

    await startAndGenerate(result);
    await waitFor(() => {
      expect(atPhase(result.current, "generating").slots[0].status).toBe(
        "error",
      );
    });

    act(() => atPhase(result.current, "generating").retrySlot(0));
    expect(atPhase(result.current, "generating").slots[0].status).toBe(
      "loading",
    );

    await act(async () => originalRenders.resolve(imageResponse()));
    await waitFor(() =>
      expect(atPhase(result.current, "generating").doneCount).toBe(total - 1),
    );
    expect(atPhase(result.current, "generating").slots[0].status).toBe(
      "loading",
    );

    await act(async () => retry.resolve(imageResponse("image/webp")));
    await waitFor(() => expect(result.current.phase).toBe("done"));

    const callsBeforeDoneRetry = fetchMock.mock.calls.length;
    const completed = atPhase(result.current, "done");
    act(() => completed.retrySlot(1));
    expect(result.current.phase).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeDoneRetry);
  });

  it("aborts and ignores stale Rendered Ads after reset", async () => {
    const pendingAd = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const planning = planningResponse(planFor(), String(input));
      return planning ? Promise.resolve(planning) : pendingAd.promise;
    });
    const { result } = renderHook(() => useAdMaker());

    await startAndGenerate(result);
    const generating = atPhase(result.current, "generating");
    // Calls 0 and 1 are the Brief and the Concepts; the first ad follows them.
    const rootSignal = (fetchMock.mock.calls[2]?.[1] as RequestInit).signal;

    act(() => generating.reset());
    expect(rootSignal?.aborted).toBe(true);
    expect(result.current.phase).toBe("idle");
    expect(atPhase(result.current, "idle").domain).toBe("");

    await act(async () => {
      pendingAd.resolve(imageResponse());
      await pendingAd.promise;
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
  });

  it("keeps a settled gallery visible while retrying a failed slot", async () => {
    const plan = planFor();
    const total = plan.concepts.length;
    const retry = deferred<Response>();
    let adRequest = 0;
    fetchMock.mockImplementation((input) => {
      const planning = planningResponse(plan, String(input));
      if (planning) return Promise.resolve(planning);
      adRequest += 1;
      if (adRequest === 1) {
        return Promise.resolve(imageResponse("image/png", false));
      }
      if (adRequest <= total) return Promise.resolve(imageResponse());
      return retry.promise;
    });
    const { result } = renderHook(() => useAdMaker());

    await startAndGenerate(result);
    await waitFor(() => expect(result.current.phase).toBe("done"));

    act(() => atPhase(result.current, "done").retrySlot(0));
    expect(result.current.phase).toBe("done");
    expect(atPhase(result.current, "done").slots[0].status).toBe("loading");

    await act(async () => retry.resolve(imageResponse("image/webp")));
    await waitFor(() =>
      expect(atPhase(result.current, "done").slots[0].status).toBe("done"),
    );
  });

  it.each([1, 3] as const)(
    "renders and revokes a complete run with %s Product concepts",
    async (productCount) => {
      const plan = planFor("stripe.com", productCount);
      const total = plan.concepts.length;
      fetchMock.mockImplementation((input) =>
        Promise.resolve(
          planningResponse(plan, String(input)) ?? imageResponse(),
        ),
      );
      const { result, unmount } = renderHook(() => useAdMaker());

      await startAndGenerate(result);
      await waitFor(() => expect(result.current.phase).toBe("done"));
      const completed = atPhase(result.current, "done");
      expect(completed.slots).toHaveLength(total);
      expect(completed.doneCount).toBe(total);
      expect(
        completed.slots.slice(0, 3).map(({ concept }) => concept.subject),
      ).toEqual([
        { kind: "company" },
        { kind: "company" },
        { kind: "company" },
      ]);
      expect(
        completed.slots.slice(3).map(({ concept }) => concept.subject.kind),
      ).toEqual(Array.from({ length: productCount }, () => "product"));
      // One Brief, one Concepts call, then one request per Rendered Ad.
      expect(fetchMock).toHaveBeenCalledTimes(total + 2);
      expect(createObjectURL).toHaveBeenCalledTimes(total);

      unmount();
      expect(new Set(revokeObjectURL.mock.calls.map(([url]) => url))).toEqual(
        new Set(
          Array.from({ length: total }, (_, index) => `blob:ad-${index + 1}`),
        ),
      );
    },
  );
});
