/**
 * What to say during the wait while brand-extractor reads a site.
 *
 * These are the stages the service actually runs, in the order it runs them,
 * weighted by its own reported timings on allbirds.com — fetch 1.0s, catalogue
 * 1.2s, brand 2.1s, shortlist 5.5s, tone 2.8s.
 *
 * It answers in one blocking call and reports those timings only once it has
 * finished, so which stage is showing is a proportion of elapsed time and not a
 * live reading. That is also why the figure beside it is the time spent, which
 * is known, rather than the time remaining, which is not: naming a stage that
 * is roughly right costs nothing, and counting down to a moment we cannot
 * predict would be a promise we would break on every slow site.
 */
export const RESEARCH_STAGES = [
  { label: "Fetching your website", share: 0.08 },
  { label: "Reading your catalogue", share: 0.09 },
  { label: "Picking out your brand", share: 0.16 },
  { label: "Choosing what to advertise", share: 0.43 },
  { label: "Learning your tone of voice", share: 0.24 },
] as const;

/** Slowest extract measured, so the stages pace against the worst case. */
export const RESEARCH_NOMINAL_SECONDS = 40;

/** The stage to show after this many seconds of waiting. */
export function researchStage(elapsed: number): string {
  let end = 0;
  for (const stage of RESEARCH_STAGES) {
    end += stage.share * RESEARCH_NOMINAL_SECONDS;
    if (elapsed < end) return stage.label;
  }
  // Past the slowest run we have measured. Hold on the last stage rather than
  // invent a further one: the extract is still running, and we cannot see where.
  return RESEARCH_STAGES[RESEARCH_STAGES.length - 1].label;
}
