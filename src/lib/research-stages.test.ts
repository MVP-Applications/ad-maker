import { expect, test } from "vitest";
import {
  RESEARCH_NOMINAL_SECONDS,
  RESEARCH_STAGES,
  researchStage,
} from "./research-stages";

const first = RESEARCH_STAGES[0].label;
const last = RESEARCH_STAGES[RESEARCH_STAGES.length - 1].label;

// The shares divide one wait between them, so they have to add up to it.
test("the stage shares account for the whole wait", () => {
  const total = RESEARCH_STAGES.reduce((sum, { share }) => sum + share, 0);

  expect(total).toBeCloseTo(1, 5);
});

test("opens on the first stage", () => {
  expect(researchStage(0)).toBe(first);
  expect(researchStage(1)).toBe(first);
});

test("advances through every stage in order across one nominal wait", () => {
  const seen: string[] = [];
  for (let second = 0; second <= RESEARCH_NOMINAL_SECONDS; second++) {
    const stage = researchStage(second);
    if (stage !== seen[seen.length - 1]) seen.push(stage);
  }

  expect(seen).toEqual(RESEARCH_STAGES.map(({ label }) => label));
});

// A slow site keeps waiting, and we still cannot see how far along it is.
test("holds on the last stage rather than running out of them", () => {
  expect(researchStage(RESEARCH_NOMINAL_SECONDS)).toBe(last);
  expect(researchStage(RESEARCH_NOMINAL_SECONDS * 10)).toBe(last);
});

test("never goes backwards as the wait grows", () => {
  const order = new Map<string, number>(
    RESEARCH_STAGES.map(({ label }, index) => [label, index]),
  );

  let previous = 0;
  for (let second = 0; second <= 120; second++) {
    const index = order.get(researchStage(second));
    expect(index).toBeDefined();
    expect(index!).toBeGreaterThanOrEqual(previous);
    previous = index!;
  }
});
