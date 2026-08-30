import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_THEME_GROUP_DEFINITIONS,
  buildDefaultThemeGroups,
} from "../shared/themeGroups";

const currentThemeNames = [
  "animals", "superheroes", "princess", "florals", "vehicles", "space",
  "dinosaurs", "abstract", "sports", "unicorn", "ocean", "fish", "boat",
  "insects/bugs", "korean bands", "harry potter", "flamingo", "frozen",
  "christmas", "minions", "cars", "astronaut", "planets/solar system", "rocket",
  "avengers", "honey bee", "butterfly", "soccer", "basketball", "tennis",
  "aeroplane", "cricket", "anime", "zodiac signs", "mr mrs designs",
  "his her designs", "heart designs", "bikes/motorcycles", "hello kitty",
  "animation characters",
];

test("default theme groups preserve the seven agreed browsing groups", () => {
  assert.deepEqual(
    DEFAULT_THEME_GROUP_DEFINITIONS.map(group => group.name),
    [
      "Characters",
      "Animals & Nature",
      "Vehicles",
      "Space & Adventure",
      "Sports",
      "Celebrations & Relationships",
      "Patterns & Decorative",
    ],
  );
});

test("default theme groups assign every current theme exactly once by ID", () => {
  const groups = buildDefaultThemeGroups(
    currentThemeNames.map((name, index) => ({ id: `theme-${index}`, name })),
  );
  const assignedIds = groups.flatMap(group => group.themeIds);

  assert.equal(assignedIds.length, currentThemeNames.length);
  assert.equal(new Set(assignedIds).size, currentThemeNames.length);
  assert.deepEqual(
    new Set(assignedIds),
    new Set(currentThemeNames.map((_, index) => `theme-${index}`)),
  );
});

test("group assignments contain canonical IDs rather than display names", () => {
  const groups = buildDefaultThemeGroups([
    { id: "stable-character-id", name: "Superheroes" },
    { id: "stable-nature-id", name: "Animals" },
  ]);

  assert.deepEqual(groups.find(group => group.id === "characters")?.themeIds, ["stable-character-id"]);
  assert.deepEqual(groups.find(group => group.id === "animals-nature")?.themeIds, ["stable-nature-id"]);
});