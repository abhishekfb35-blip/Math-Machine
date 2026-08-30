export interface ThemeGroup {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
  themeIds: string[];
}

export type ThemeGroupsConfig = ThemeGroup[];

interface ThemeGroupDefinition extends Omit<ThemeGroup, "themeIds"> {
  themeNames: string[];
}

export const DEFAULT_THEME_GROUP_DEFINITIONS: ThemeGroupDefinition[] = [
  {
    id: "characters",
    name: "Characters",
    description: "Familiar characters, franchises, and entertainment favorites",
    enabled: true,
    sortOrder: 0,
    themeNames: [
      "superheroes", "princess", "unicorn", "korean bands", "harry potter",
      "frozen", "minions", "avengers", "anime", "hello kitty", "animation characters",
    ],
  },
  {
    id: "animals-nature",
    name: "Animals & Nature",
    description: "Animals, ocean life, and nature-inspired designs",
    enabled: true,
    sortOrder: 1,
    themeNames: [
      "animals", "ocean", "fish", "insects/bugs", "flamingo", "honey bee", "butterfly",
    ],
  },
  {
    id: "vehicles",
    name: "Vehicles",
    description: "Cars, bikes, boats, and aircraft",
    enabled: true,
    sortOrder: 2,
    themeNames: ["vehicles", "boat", "cars", "aeroplane", "bikes/motorcycles"],
  },
  {
    id: "space-adventure",
    name: "Space & Adventure",
    description: "Space exploration and big adventures",
    enabled: true,
    sortOrder: 3,
    themeNames: ["space", "dinosaurs", "astronaut", "planets/solar system", "rocket"],
  },
  {
    id: "sports",
    name: "Sports",
    description: "Sports and active-life designs",
    enabled: true,
    sortOrder: 4,
    themeNames: ["sports", "soccer", "basketball", "tennis", "cricket"],
  },
  {
    id: "celebrations-relationships",
    name: "Celebrations & Relationships",
    description: "Festive, zodiac, couple, and relationship designs",
    enabled: true,
    sortOrder: 5,
    themeNames: ["christmas", "zodiac signs", "mr mrs designs", "his her designs", "heart designs"],
  },
  {
    id: "patterns-decorative",
    name: "Patterns & Decorative",
    description: "Floral, abstract, and decorative designs",
    enabled: true,
    sortOrder: 6,
    themeNames: ["abstract", "florals"],
  },
];

export function buildDefaultThemeGroups(
  themeOptions: Array<{ id: string; name: string }>,
): ThemeGroupsConfig {
  const themeIdsByName = new Map(
    themeOptions.map(theme => [theme.name.trim().toLowerCase(), theme.id]),
  );

  return DEFAULT_THEME_GROUP_DEFINITIONS.map(({ themeNames, ...group }) => ({
    ...group,
    themeIds: themeNames
      .map(name => themeIdsByName.get(name))
      .filter((id): id is string => Boolean(id)),
  }));
}