import { describe, expect, it } from "vitest";
import {
  COMPOSITIONS,
  COPY_ANGLES,
  FINISHES,
  LENSES,
  LIGHTING,
  SURFACES,
  craftMenu,
  craftMove,
  type CraftAxis,
  type CraftMove,
} from "./craft";

const AXES: readonly [CraftAxis, readonly CraftMove<string>[]][] = [
  ["lighting", LIGHTING],
  ["lens", LENSES],
  ["composition", COMPOSITIONS],
  ["surface", SURFACES],
  ["finish", FINISHES],
  ["copyAngle", COPY_ANGLES],
];

describe("the craft library", () => {
  it.each(AXES)("gives every %s move a key, a name and a sentence", (_, moves) => {
    expect(moves.length).toBeGreaterThan(0);
    expect(new Set(moves.map(({ key }) => key)).size).toBe(moves.length);

    for (const move of moves) {
      expect(move.key).toMatch(/^[a-z0-9_]+$/);
      expect(move.label).not.toBe("");
      // The sentence is spliced straight into an image prompt, so it has to be
      // a sentence rather than a label repeated.
      expect(move.prompt.length).toBeGreaterThan(20);
      expect(move.prompt.trimEnd().endsWith(".")).toBe(true);
    }
  });

  it.each(AXES)("finds a %s move by key, and nothing by a key it lacks", (axis, moves) => {
    expect(craftMove(axis, moves[0].key)?.label).toBe(moves[0].label);
    expect(craftMove(axis, "not-a-move")).toBeUndefined();
    expect(craftMove(axis, null)).toBeUndefined();
  });

  /** A key on the wrong axis is as wrong as a key nothing holds. */
  it("keeps the axes apart", () => {
    expect(craftMove("lens", "rembrandt")).toBeUndefined();
    expect(craftMove("lighting", "rembrandt")).toBeDefined();
  });

  /**
   * The menu is what the director reads, and it carries keys and names only —
   * a hundred and thirty-two sentences is a prompt nobody can afford on every
   * compose, and the prose is spliced in later anyway.
   */
  it("offers the director names without spending the prose on it", () => {
    const menu = craftMenu(LIGHTING);

    expect(menu).toContain("rembrandt (Rembrandt key)");
    expect(menu).not.toContain(LIGHTING[0].prompt);
  });

  /**
   * The whole argument for building it on axes: the combinations are the
   * library, not the entries. Three hundred flat presets is three hundred
   * looks; six independent axes is a space nobody runs out of.
   */
  it("composes into far more pictures than it holds moves", () => {
    const named = AXES.reduce((total, [, moves]) => total + moves.length, 0);
    const combinations = AXES.filter(([axis]) => axis !== "copyAngle").reduce(
      (total, [, moves]) => total * moves.length,
      1,
    );

    expect(named).toBeGreaterThan(100);
    expect(combinations).toBeGreaterThan(1_000_000);
  });
});
