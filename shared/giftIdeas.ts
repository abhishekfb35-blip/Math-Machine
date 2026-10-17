import type { Product } from "./types";

export interface GiftIdeaGroup {
  id: string;
  title: string;
  description: string;
  products: Product[];
}

const GROUP_DEFINITIONS = [
  {
    id: "princess",
    title: "Princess-themed gifts",
    description: "Personalised towels and blankets with princess designs.",
    themes: ["princess"],
    namePattern: null,
  },
  {
    id: "superheroes",
    title: "Superhero-themed gifts",
    description: "Themed towel and blanket ideas for superhero fans.",
    themes: ["superheroes", "superhero"],
    namePattern: null,
  },
  {
    id: "animals",
    title: "Animal-themed gifts",
    description: "Animal designs embroidered on personalised products.",
    themes: ["animals", "animal", "dinosaurs"],
    namePattern: null,
  },
  {
    id: "cartoon-characters",
    title: "Cartoon character gifts",
    description: "Character designs such as Peppa Pig and Hello Kitty, where available.",
    themes: ["animation characters", "hello kitty"],
    namePattern: /\b(peppa|hello kitty)\b/i,
  },
  {
    id: "unicorn",
    title: "Unicorn-themed gifts",
    description: "Personalised designs for children who love unicorns.",
    themes: ["unicorn"],
    namePattern: /\bunicorn\b/i,
  },
] as const;

function isKidsProduct(product: Product): boolean {
  return (product.audienceNames ?? []).some((name) =>
    ["kids", "kid", "infant", "children", "child"].includes(name.trim().toLowerCase()),
  );
}

export function getGiftIdeaGroups(products: Product[], perGroup = 8): GiftIdeaGroup[] {
  const usedProducts = new Set<string>();
  const groups: GiftIdeaGroup[] = [];

  for (const definition of GROUP_DEFINITIONS) {
    const themeSet = new Set<string>(definition.themes);
    const matchingProducts = products.filter((product) => {
      if (!product.active || !isKidsProduct(product) || usedProducts.has(product.id)) return false;
      const themes = (product.themeNames ?? []).map((name) => name.trim().toLowerCase());
      return themes.some((theme) => themeSet.has(theme))
        || Boolean(definition.namePattern?.test(product.name));
    });
    const groupProducts = matchingProducts.slice(0, perGroup);
    for (const product of groupProducts) usedProducts.add(product.id);
    if (groupProducts.length) {
      groups.push({
        id: definition.id,
        title: definition.title,
        description: definition.description,
        products: groupProducts,
      });
    }
  }

  return groups;
}
