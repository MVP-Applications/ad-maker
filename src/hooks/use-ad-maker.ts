"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  briefHref,
  decodeAdRunBrief,
  decodeAdRunPlan,
  isAdvertisable,
  productKey,
  renderedAdHref,
  withFlagships,
  type AdBrief,
  type AdRunBrief,
  type PlannedConcept,
  type Product,
} from "@/lib/ad-run";
import { normalizeDomain } from "@/lib/net";

type ImageExtension = "png" | "jpg" | "webp";

type SlotBase = {
  concept: PlannedConcept;
  attempt: number;
};

type LoadingAdSlot = SlotBase & {
  status: "loading";
};

type DoneAdSlot = SlotBase & {
  status: "done";
  /** Object URL owned by this workflow. */
  url: string;
  ext: ImageExtension;
};

type ErrorAdSlot = SlotBase & {
  status: "error";
  message: string;
};

export type AdSlot = LoadingAdSlot | DoneAdSlot | ErrorAdSlot;

type IdleController = {
  phase: "idle";
  domain: string;
  setDomain(value: string): void;
  error: string | null;
  start(rawDomain: string): Promise<void>;
};

type BriefController = {
  phase: "brief";
  submittedDomain: string;
  /** Seconds spent reading the site, counted rather than estimated. */
  elapsed: number;
  reset(): void;
};

/**
 * The catalogue, for keeping or discarding. Everything the shop sells arrives
 * selected: the extract found it, and saying which of it is yours is quicker
 * from a full list than from an empty one.
 */
type CatalogController = {
  phase: "catalog";
  submittedDomain: string;
  brief: AdBrief;
  products: readonly Product[];
  /** Product keys, so a name's casing cannot make one Product into two. */
  selected: ReadonlySet<string>;
  selectedCount: number;
  /**
   * How many of the selected Products an ad could be written about. A shop
   * describes only part of its range, and a run needs at least one of those.
   */
  advertisableCount: number;
  toggleProduct(name: string): void;
  selectAll(): void;
  deselectAll(): void;
  confirmSelection(): void;
  reset(): void;
};

/**
 * Everything the extract found about the brand itself, laid out to be checked
 * before it reaches an advertisement. Editable: a field the extract read wrong
 * is corrected here rather than recognised later in a finished ad.
 */
type DnaController = {
  phase: "dna";
  submittedDomain: string;
  brief: AdBrief;
  products: readonly Product[];
  /** Every photograph the extract carries: the hero shot, then the catalogue. */
  images: readonly string[];
  /** Everything the shop sells, so a Product dropped here can be added back. */
  catalogue: readonly Product[];
  /** Correct one or more Brief fields; the run carries the corrected copy. */
  editBrief(patch: Partial<AdBrief>): void;
  /** Keep or drop one Product without leaving the Brief. */
  toggleProduct(name: string): void;
  confirmBrand(): void;
  back(): void;
  reset(): void;
};

/**
 * The Brief is read and nothing has been decided yet. The run waits here for
 * the choices that shape it; today the only one is whether to make it at all.
 */
type ComposeController = {
  phase: "compose";
  submittedDomain: string;
  brief: AdBrief;
  products: readonly Product[];
  /** True from the moment Concepts are asked for until they arrive or fail. */
  planning: boolean;
  error: string | null;
  generate(): Promise<void>;
  reset(): void;
};

type ActiveController = {
  submittedDomain: string;
  brief: AdBrief;
  elapsed: number;
  doneCount: number;
  retrySlot(index: number): void;
  reset(): void;
  downloadAd(index: number): void;
};

type GeneratingController = ActiveController & {
  phase: "generating";
  slots: readonly AdSlot[];
};

type DoneController = ActiveController & {
  phase: "done";
  slots: readonly AdSlot[];
  downloadAll(): void;
  shareToX(): Promise<void>;
};

export type AdMakerController =
  | IdleController
  | BriefController
  | CatalogController
  | DnaController
  | ComposeController
  | GeneratingController
  | DoneController;

type InternalState =
  | { stage: "idle"; error: string | null }
  | { stage: "brief"; epoch: number; submittedDomain: string }
  | {
      stage: "catalog";
      epoch: number;
      submittedDomain: string;
      adRunBrief: AdRunBrief;
      selected: ReadonlySet<string>;
    }
  | {
      stage: "dna";
      epoch: number;
      submittedDomain: string;
      adRunBrief: AdRunBrief;
      /** The catalogue as it stood before the cut, so Back can restore it. */
      catalogue: AdRunBrief;
      selected: ReadonlySet<string>;
    }
  | {
      stage: "compose";
      epoch: number;
      submittedDomain: string;
      adRunBrief: AdRunBrief;
      planning: boolean;
      error: string | null;
    }
  | {
      stage: "gallery";
      epoch: number;
      submittedDomain: string;
      brief: AdBrief;
      slots: readonly AdSlot[];
      settled: boolean;
    };

const SHARE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://link.context.dev/branda";

const DEFAULT_ERROR = "We couldn't read that site. Try another domain.";

function buildShareCaption(domain: string): string {
  return `just turned ${domain} into scroll-stopping, on-brand ads in seconds with @getcontextdev 🎨\n\npaste a public domain → instant on-brand ads. no designer needed.`;
}

function extensionFor(blob: Blob): ImageExtension {
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("jpeg") || blob.type.includes("jpg")) return "jpg";
  return "png";
}

function replaceSlot(
  slots: readonly AdSlot[],
  index: number,
  next: AdSlot,
): readonly AdSlot[] {
  return slots.map((slot, slotIndex) =>
    slotIndex === index ? next : slot,
  );
}

function allSlotsFinished(slots: readonly AdSlot[]): boolean {
  return slots.every((slot) => slot.status !== "loading");
}

function filenameSegment(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "ad"
  );
}

function adFilename(
  domain: string,
  concept: PlannedConcept,
  index: number,
  extension: ImageExtension,
): string {
  const subject =
    concept.subject.kind === "product" ? concept.subject.name : "company";
  return `${domain}-${index + 1}-${filenameSegment(subject)}-${concept.key}.${extension}`;
}

function responseError(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return DEFAULT_ERROR;
}

export function useAdMaker(): AdMakerController {
  const [domain, setDomain] = useState("");
  const [state, setReactState] = useState<InternalState>({
    stage: "idle",
    error: null,
  });
  const stateRef = useRef(state);
  const [elapsed, setElapsed] = useState(0);
  const epochRef = useRef(0);
  const rootControllerRef = useRef<AbortController | null>(null);
  const attemptsRef = useRef<number[]>([]);
  const objectUrlsRef = useRef(new Set<string>());
  const downloadTimersRef = useRef(new Set<number>());

  const commit = useCallback((next: InternalState) => {
    stateRef.current = next;
    setReactState(next);
  }, []);

  const revokeUrl = useCallback((url: string) => {
    if (!objectUrlsRef.current.delete(url)) return;
    URL.revokeObjectURL(url);
  }, []);

  const invalidateCurrentRun = useCallback(() => {
    epochRef.current += 1;
    rootControllerRef.current?.abort();
    rootControllerRef.current = null;
    attemptsRef.current = [];

    for (const timer of downloadTimersRef.current) window.clearTimeout(timer);
    downloadTimersRef.current.clear();

    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current.clear();
    return epochRef.current;
  }, []);

  const isCurrentAttempt = useCallback(
    (epoch: number, index: number, attempt: number, signal: AbortSignal) =>
      !signal.aborted &&
      epochRef.current === epoch &&
      rootControllerRef.current?.signal === signal &&
      attemptsRef.current[index] === attempt,
    [],
  );

  const fetchSlot = useCallback(
    async (
      epoch: number,
      brief: AdBrief,
      concept: PlannedConcept,
      index: number,
      attempt: number,
      signal: AbortSignal,
    ) => {
      try {
        const response = await fetch(renderedAdHref(brief, concept), {
          signal,
        });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const blob = await response.blob();
        if (!isCurrentAttempt(epoch, index, attempt, signal)) return;

        // No await occurs between the staleness check and ownership registration.
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.add(url);

        const current = stateRef.current;
        if (
          current.stage !== "gallery" ||
          current.epoch !== epoch ||
          current.slots[index]?.attempt !== attempt
        ) {
          revokeUrl(url);
          return;
        }

        const slots = replaceSlot(current.slots, index, {
          status: "done",
          concept,
          attempt,
          url,
          ext: extensionFor(blob),
        });
        commit({
          ...current,
          slots,
          settled: current.settled || allSlotsFinished(slots),
        });
      } catch (error) {
        if (!isCurrentAttempt(epoch, index, attempt, signal)) return;
        const current = stateRef.current;
        if (
          current.stage !== "gallery" ||
          current.epoch !== epoch ||
          current.slots[index]?.attempt !== attempt
        ) {
          return;
        }
        const slots = replaceSlot(current.slots, index, {
          status: "error",
          concept,
          attempt,
          message: (error as Error)?.message || "Render failed",
        });
        commit({
          ...current,
          slots,
          settled: current.settled || allSlotsFinished(slots),
        });
      }
    },
    [commit, isCurrentAttempt, revokeUrl],
  );

  const isStale = useCallback(
    (epoch: number, rootController: AbortController) =>
      rootController.signal.aborted ||
      epochRef.current !== epoch ||
      rootControllerRef.current !== rootController,
    [],
  );

  const start = useCallback(
    async (rawDomain: string) => {
      setDomain(rawDomain);
      const submittedDomain = normalizeDomain(rawDomain);
      if (!submittedDomain) {
        invalidateCurrentRun();
        commit({
          stage: "idle",
          error: "Please enter a valid domain, e.g. stripe.com",
        });
        return;
      }

      const epoch = invalidateCurrentRun();
      const rootController = new AbortController();
      rootControllerRef.current = rootController;
      setElapsed(0);
      commit({ stage: "brief", epoch, submittedDomain });

      try {
        const response = await fetch(briefHref(submittedDomain), {
          signal: rootController.signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(responseError(payload));

        const adRunBrief: AdRunBrief = decodeAdRunBrief(payload);
        if (adRunBrief.brief.domain !== submittedDomain) {
          throw new Error("The Brief did not match the submitted domain.");
        }
        if (isStale(epoch, rootController)) return;

        // The run stops here. Planning is a separate call precisely so that the
        // choices made against this Brief can come between the two.
        commit({
          stage: "catalog",
          epoch,
          submittedDomain,
          adRunBrief,
          selected: new Set(adRunBrief.products.map(({ name }) => productKey(name))),
        });
      } catch (error) {
        if (isStale(epoch, rootController)) return;
        rootControllerRef.current = null;
        commit({
          stage: "idle",
          error: (error as Error)?.message || DEFAULT_ERROR,
        });
      }
    },
    [commit, invalidateCurrentRun, isStale],
  );

  const withCatalog = useCallback(
    (change: (selected: ReadonlySet<string>) => ReadonlySet<string>) => {
      const current = stateRef.current;
      if (current.stage !== "catalog") return;
      commit({ ...current, selected: change(current.selected) });
    },
    [commit],
  );

  const toggleProduct = useCallback(
    (name: string) =>
      withCatalog((selected) => {
        const next = new Set(selected);
        const key = productKey(name);
        if (!next.delete(key)) next.add(key);
        return next;
      }),
    [withCatalog],
  );

  const selectAll = useCallback(() => {
    const current = stateRef.current;
    if (current.stage !== "catalog") return;
    withCatalog(
      () =>
        new Set(
          current.adRunBrief.products.map(({ name }) => productKey(name)),
        ),
    );
  }, [withCatalog]);

  const deselectAll = useCallback(
    () => withCatalog(() => new Set<string>()),
    [withCatalog],
  );

  /**
   * Keep what was selected and carry it forward as the catalogue.
   *
   * An Ad Run advertises flagships, and a selection can easily contain none of
   * them — so the kept Products are re-marked, falling back to the head of the
   * list exactly as an unshortlisted extract does.
   */
  const confirmSelection = useCallback(() => {
    const current = stateRef.current;
    if (current.stage !== "catalog") return;
    const kept = current.adRunBrief.products.filter(({ name }) =>
      current.selected.has(productKey(name)),
    );
    // Nothing describable means nothing to advertise, and the run would fail
    // several screens later with a message about planning rather than about
    // this choice. Refuse here, where the choice was made.
    if (!kept.some(isAdvertisable)) return;

    commit({
      stage: "dna",
      epoch: current.epoch,
      submittedDomain: current.submittedDomain,
      adRunBrief: {
        brief: current.adRunBrief.brief,
        products: withFlagships(kept),
      },
      catalogue: current.adRunBrief,
      selected: current.selected,
    });
  }, [commit]);

  /** Back to the catalogue, with the selection that produced this cut intact. */
  const backToCatalog = useCallback(() => {
    const current = stateRef.current;
    if (current.stage !== "dna") return;
    commit({
      stage: "catalog",
      epoch: current.epoch,
      submittedDomain: current.submittedDomain,
      // The catalogue's products, but the Brief as it now stands. Restoring
      // the catalogue wholesale would restore the Brief the extract produced
      // and silently undo every correction made against it, which is a long
      // way to lose work: the person went back to change the products.
      adRunBrief: {
        ...current.catalogue,
        brief: current.adRunBrief.brief,
      },
      selected: current.selected,
    });
  }, [commit]);

  /**
   * Correct one field of the Brief the extract produced.
   *
   * The extract reads a site rather than being told about it, so it is wrong
   * often enough that a person has to be able to say so — and this screen is
   * the last place before the Brief reaches a model. The patch is merged into
   * the Brief the run carries, so what is generated is what is on screen.
   */
  const editBrief = useCallback((patch: Partial<AdBrief>) => {
    const current = stateRef.current;
    if (current.stage !== "dna") return;
    commit({
      ...current,
      adRunBrief: {
        ...current.adRunBrief,
        brief: { ...current.adRunBrief.brief, ...patch },
      },
    });
  }, [commit]);

  /**
   * Keep or drop one Product without leaving the Brief.
   *
   * The catalogue is the source of what may be added back, so a Product
   * dropped here is not gone — it returns to the same place in the shop's own
   * order it came from. The selection is kept in step so a later trip back to
   * the catalogue shows what this screen decided.
   */
  const toggleDnaProduct = useCallback((name: string) => {
    const current = stateRef.current;
    if (current.stage !== "dna") return;

    const key = productKey(name);
    const kept = current.adRunBrief.products;
    const isKept = kept.some((product) => productKey(product.name) === key);

    const keptKeys = new Set(kept.map((product) => productKey(product.name)));
    if (isKept) keptKeys.delete(key);
    else keptKeys.add(key);

    const next = current.catalogue.products.filter((product) =>
      keptKeys.has(productKey(product.name)),
    );

    // The same rule the catalogue enforces: a run needs something it can
    // actually write an ad about, and refusing here says so where it is read.
    if (!next.some(isAdvertisable)) return;

    const selected = new Set(current.selected);
    if (isKept) selected.delete(key);
    else selected.add(key);

    commit({
      ...current,
      adRunBrief: {
        ...current.adRunBrief,
        products: withFlagships(next),
      },
      selected,
    });
  }, [commit]);

  const confirmBrand = useCallback(() => {
    const current = stateRef.current;
    if (current.stage !== "dna") return;
    commit({
      stage: "compose",
      epoch: current.epoch,
      submittedDomain: current.submittedDomain,
      adRunBrief: current.adRunBrief,
      planning: false,
      error: null,
    });
  }, [commit]);

  const generate = useCallback(async () => {
    const current = stateRef.current;
    const rootController = rootControllerRef.current;
    if (
      current.stage !== "compose" ||
      current.planning ||
      !rootController ||
      rootController.signal.aborted
    ) {
      return;
    }

    const { epoch, submittedDomain, adRunBrief } = current;
    commit({ ...current, planning: true, error: null });

    try {
      const response = await fetch("/api/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adRunBrief),
        signal: rootController.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(payload));

      const plan = decodeAdRunPlan(payload);
      if (plan.brief.domain !== submittedDomain) {
        throw new Error("The Ad Run did not match the submitted domain.");
      }
      if (isStale(epoch, rootController)) return;

      const slots = plan.concepts.map((concept) => ({
        status: "loading" as const,
        concept,
        attempt: 1,
      }));
      attemptsRef.current = plan.concepts.map(() => 1);
      setElapsed(0);
      commit({
        stage: "gallery",
        epoch,
        submittedDomain,
        brief: plan.brief,
        slots,
        settled: false,
      });

      plan.concepts.forEach((concept, index) => {
        void fetchSlot(
          epoch,
          plan.brief,
          concept,
          index,
          1,
          rootController.signal,
        );
      });
    } catch (error) {
      if (isStale(epoch, rootController)) return;
      // Stay on the Brief rather than dropping to the start: the extract that
      // produced it cost 15-60s and the choices made against it still stand.
      commit({
        stage: "compose",
        epoch,
        submittedDomain,
        adRunBrief,
        planning: false,
        error: (error as Error)?.message || DEFAULT_ERROR,
      });
    }
  }, [commit, fetchSlot, isStale]);

  const reset = useCallback(() => {
    invalidateCurrentRun();
    setElapsed(0);
    setDomain("");
    commit({ stage: "idle", error: null });
  }, [commit, invalidateCurrentRun]);

  const retrySlot = useCallback(
    (index: number) => {
      const current = stateRef.current;
      const rootController = rootControllerRef.current;
      if (
        current.stage !== "gallery" ||
        !rootController ||
        rootController.signal.aborted ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= current.slots.length
      ) {
        return;
      }

      const slot = current.slots[index];
      if (slot.status !== "error") return;

      const attempt = slot.attempt + 1;
      attemptsRef.current[index] = attempt;
      commit({
        ...current,
        slots: replaceSlot(current.slots, index, {
          status: "loading",
          concept: slot.concept,
          attempt,
        }),
      });
      void fetchSlot(
        current.epoch,
        current.brief,
        slot.concept,
        index,
        attempt,
        rootController.signal,
      );
    },
    [commit, fetchSlot],
  );

  const triggerDownload = useCallback((url: string, filename: string) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  }, []);

  const downloadAd = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.stage !== "gallery") return;
      const slot = current.slots[index];
      if (slot?.status !== "done") return;
      triggerDownload(
        slot.url,
        adFilename(current.submittedDomain, slot.concept, index, slot.ext),
      );
    },
    [triggerDownload],
  );

  const downloadAll = useCallback(() => {
    const current = stateRef.current;
    if (current.stage !== "gallery") return;
    const downloads = current.slots.flatMap((slot, index) =>
      slot.status === "done"
        ? [
            {
              url: slot.url,
              filename: adFilename(
                current.submittedDomain,
                slot.concept,
                index,
                slot.ext,
              ),
            },
          ]
        : [],
    );
    downloads.forEach((download, index) => {
      const timer = window.setTimeout(() => {
        downloadTimersRef.current.delete(timer);
        triggerDownload(download.url, download.filename);
      }, index * 300);
      downloadTimersRef.current.add(timer);
    });
  }, [triggerDownload]);

  const shareToX = useCallback(async () => {
    const current = stateRef.current;
    if (current.stage !== "gallery") return;
    const first = current.slots.find(
      (slot): slot is DoneAdSlot => slot.status === "done",
    );
    const caption = buildShareCaption(current.submittedDomain);
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(SHARE_URL)}`,
      "_blank",
      "noopener,noreferrer",
    );
    try {
      if (
        first &&
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard?.write
      ) {
        const blob = await (await fetch(first.url)).blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type || "image/png"]: blob }),
        ]);
      }
    } catch {
      // Clipboard image support is optional; the composer still opens.
    }
  }, []);

  const isGenerating =
    state.stage === "gallery" &&
    state.slots.some((slot) => slot.status === "loading");

  /**
   * Both waits are counted, and each restarts the clock. Reading the site is a
   * 15-60s wait with nothing on screen to watch, which is exactly where a real
   * count of seconds is worth more than an invented estimate of what remains.
   */
  const waitKey =
    state.stage === "brief"
      ? `brief:${state.epoch}`
      : isGenerating
        ? `gallery:${state.epoch}`
        : null;

  useEffect(() => {
    if (!waitKey) return;
    setElapsed(0);
    const timer = window.setInterval(
      () => setElapsed((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [waitKey]);

  useEffect(() => {
    if (!isGenerating) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isGenerating]);

  useEffect(
    () => () => {
      invalidateCurrentRun();
    },
    [invalidateCurrentRun],
  );

  if (state.stage === "idle") {
    return { phase: "idle", domain, setDomain, error: state.error, start };
  }
  if (state.stage === "brief") {
    return {
      phase: "brief",
      submittedDomain: state.submittedDomain,
      elapsed,
      reset,
    };
  }
  if (state.stage === "catalog") {
    const selectedProducts = state.adRunBrief.products.filter(({ name }) =>
      state.selected.has(productKey(name)),
    );
    return {
      phase: "catalog",
      submittedDomain: state.submittedDomain,
      brief: state.adRunBrief.brief,
      products: state.adRunBrief.products,
      selected: state.selected,
      selectedCount: selectedProducts.length,
      advertisableCount: selectedProducts.filter(isAdvertisable).length,
      toggleProduct,
      selectAll,
      deselectAll,
      confirmSelection,
      reset,
    };
  }
  if (state.stage === "dna") {
    const { brief, products } = state.adRunBrief;
    // The hero shot first, then the catalogue's own photographs, each once.
    const images = [
      ...(brief.heroImageUrl ? [brief.heroImageUrl] : []),
      ...products.flatMap(({ imageUrl }) => (imageUrl ? [imageUrl] : [])),
    ].filter((url, index, all) => all.indexOf(url) === index);

    return {
      phase: "dna",
      submittedDomain: state.submittedDomain,
      brief,
      products,
      images,
      catalogue: state.catalogue.products,
      editBrief,
      toggleProduct: toggleDnaProduct,
      confirmBrand,
      back: backToCatalog,
      reset,
    };
  }
  if (state.stage === "compose") {
    return {
      phase: "compose",
      submittedDomain: state.submittedDomain,
      brief: state.adRunBrief.brief,
      products: state.adRunBrief.products,
      planning: state.planning,
      error: state.error,
      generate,
      reset,
    };
  }

  const doneCount = state.slots.filter((slot) => slot.status === "done").length;
  const active = {
    submittedDomain: state.submittedDomain,
    brief: state.brief,
    slots: state.slots,
    elapsed,
    doneCount,
    retrySlot,
    reset,
    downloadAd,
  };

  if (!state.settled) {
    return { phase: "generating", ...active };
  }
  return {
    phase: "done",
    ...active,
    slots: state.slots,
    downloadAll,
    shareToX,
  };
}
