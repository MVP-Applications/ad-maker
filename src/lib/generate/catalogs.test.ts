import { expect, test } from "vitest";
import {
  CREATIVE_DIRECTIONS,
  directionByKey,
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
  expect(CREATIVE_DIRECTIONS).toHaveLength(12);
  expect(directionByKey(key)?.label).toBe("Type Poster");
  expect(directionByKey("not-a-direction")).toBeUndefined();
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
