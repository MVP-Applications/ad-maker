"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  briefHref,
  decodeAdRunBrief,
  decodeAdRunPlan,
  renderedAdHref,
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
  | ComposeController
  | GeneratingController
  | DoneController;

type InternalState =
  | { stage: "idle"; error: string | null }
  | { stage: "brief"; epoch: number; submittedDomain: string }
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
          stage: "compose",
          epoch,
          submittedDomain,
          adRunBrief,
          planning: false,
          error: null,
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
