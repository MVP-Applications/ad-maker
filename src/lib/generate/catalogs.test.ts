import { expect, test } from "vitest";
import { AD_RUN_MAX_SIZE } from "@/lib/ad-run-policy";
import {
  CREATIVE_DIRECTIONS,
  PHOTO_SAFE_DIRECTIONS,
  directionByKey,
  isPhotoSafe,
  type CreativeDirectionKey,
} from "./directions";
import {
  IMAGE_MODELS,
  assignImageModels,
  imageModelById,
  imageModelsByTier,
  takesLogo,
  takesProductPhoto,
  type ImageModelId,
} from "./models";

test("direction metadata is the source of typed keys and lookup results", () => {
  const key: CreativeDirectionKey = "typographic";
  expect(directionByKey(key)?.label).toBe("Type Poster");
  expect(directionByKey("not-a-direction")).toBeUndefined();
});

/**
 * Invariants rather than a count. The catalogue is meant to grow — a library
 * that costs a test edit every time a direction is added is a library nobody
 * adds to — so what is pinned is what an Ad Run actually depends on.
 */
test("every direction is distinct, named, and carries rules to write to", () => {
  expect(CREATIVE_DIRECTIONS.length).toBeGreaterThanOrEqual(AD_RUN_MAX_SIZE);
  expect(new Set(CREATIVE_DIRECTIONS.map(({ key }) => key)).size).toBe(
    CREATIVE_DIRECTIONS.length,
  );

  for (const direction of CREATIVE_DIRECTIONS) {
    expect(direction.label).not.toBe("");
    expect(direction.bestFor).not.toBe("");
    expect(direction.rules.length).toBeGreaterThan(0);
  }
});

/** A photo-safe key that no longer exists silently stops steering anything. */
test("every photo-safe direction is a direction the catalogue holds", () => {
  for (const key of PHOTO_SAFE_DIRECTIONS) {
    expect(directionByKey(key)).toBeDefined();
    expect(isPhotoSafe(key)).toBe(true);
  }
  // An Ad Run can draw six distinct directions for photographed articles alone.
  expect(PHOTO_SAFE_DIRECTIONS.size).toBeGreaterThanOrEqual(AD_RUN_MAX_SIZE);
});

test("Image Model records own tier, display name, and image-input capability", () => {
  const id: ImageModelId = "openai/gpt-image-2";
  expect(IMAGE_MODELS).toHaveLength(6);
  expect(imageModelsByTier("primary")).toHaveLength(3);
  expect(imageModelsByTier("secondary")).toHaveLength(3);
  expect(imageModelById(id)).toEqual({
    id,
    tier: "secondary",
    displayName: "GPT Image 2",
    reference: { kind: "native" },
    sizing: "pixel_size",
  });
  expect(imageModelById("not-a-model")).toBeUndefined();
});

test("every Product slot can be shown the real product", () => {
  // fal's text-to-image endpoints accept an image field and ignore it, so a
  // Product photo only counts where the model reaches fal's editing path or
  // takes images natively. Both kinds hold Product slots; neither company-only
  // model does.
  expect(imageModelsByTier("secondary").every(takesProductPhoto)).toBe(true);
  expect(
    imageModelsByTier("secondary").filter((m) => m.reference.kind === "fal_edit"),
  ).toHaveLength(2);
});

test("a logo only ever travels to a model that takes images natively", () => {
  // An editing endpoint starts from the picture it is given: a logo sent to one
  // comes back defaced rather than placed in an advertisement.
  for (const model of IMAGE_MODELS) {
    if (model.reference.kind !== "native") expect(takesLogo(model)).toBe(false);
  }
  expect(IMAGE_MODELS.filter(takesLogo)).toHaveLength(2);
});

test("every fal edit path is a sibling of its own model", () => {
  for (const model of IMAGE_MODELS) {
    if (model.reference.kind !== "fal_edit") continue;
    const bare = model.id.replace(/^fal\//, "").replace(/\/text-to-image$/, "");
    expect(model.reference.path).toBe(`${bare}/edit`);
  }
});

test("Image Model assignment is unique and primary-first", () => {
  const assigned = assignImageModels(() => 0);

  expect(new Set(assigned).size).toBe(IMAGE_MODELS.length);
  expect(
    assigned.slice(0, 3).every((id) => imageModelById(id)?.tier === "primary"),
  ).toBe(true);
  expect(
    assigned.slice(3).every((id) => imageModelById(id)?.tier === "secondary"),
  ).toBe(true);
});
