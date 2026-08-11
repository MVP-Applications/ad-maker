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
    },
    {
      name: "Billing",
      description: "Subscription and invoicing tools for recurring revenue.",
      imageUrl: null,
    },
    {
      name: "Connect",
      description: "Payments infrastructure for platforms and marketplaces.",
      imageUrl: null,
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
      industry: "Technology · Payments",
      summary: "Stripe provides programmable financial services.",
      mood: "modern, confident, premium",
      fontFamily: "Inter",
      colorA: "vivid violet",
      colorB: "deep navy",
      logoUrl: null,
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
    const start = atPhase(result.current, "idle").start;

    await act(() => start("HTTPS://WWW.Stripe.COM/Pricing"));

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/brief?domain=stripe.com&v=4",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/concepts");
    const generating = atPhase(result.current, "generating");
    expect(generating.submittedDomain).toBe("stripe.com");
    expect(generating.brief.domain).toBe("stripe.com");
    unmount();
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
    const start = atPhase(result.current, "idle").start;

    await act(() => start("stripe.com"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(atPhase(result.current, "idle").error).toBe(
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
    const start = atPhase(result.current, "idle").start;

    await act(() => start("stripe.com"));
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
    const start = atPhase(result.current, "idle").start;

    await act(() => start("stripe.com"));
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
    const start = atPhase(result.current, "idle").start;

    await act(() => start("stripe.com"));
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
      const start = atPhase(result.current, "idle").start;

      await act(() => start("stripe.com"));
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
