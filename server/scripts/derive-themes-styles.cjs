/**
 * Script to derive themes and styles from product names and update seed-data.json.
 * Run: node server/scripts/derive-themes-styles.cjs
 */

const fs = require("fs");
const path = require("path");

const SEED_DATA_PATH = path.join(__dirname, "../seed-data.json");

// Helper: match whole words surrounded by spaces/punctuation.
// Pads the string with spaces so leading/trailing words can match " dog " patterns.
function matchesAny(text, keywords) {
  const lower = ` ${text.toLowerCase()} `;
  return keywords.some((kw) => lower.includes(kw));
}

// ── Theme rules ───────────────────────────────────────────────────────────────
// Rules are evaluated in order; a product can match multiple themes.
// NOTE: "sports" theme is listed in seed.ts STARTER_THEMES (sortOrder: 8).

const THEME_RULES = [
  {
    theme: "dinosaurs",
    keywords: ["dinosaur", "dino "],
  },
  {
    theme: "space",
    keywords: ["space ", "rocket", "astronaut", "solar system", "galaxy", "star wars"],
  },
  {
    theme: "sports",
    keywords: [
      "basketball", "cricket", "soccer", "football", "tennis", "footballer",
      "ronaldo", "messi", "maradona", "dhoni", "kohli", "fcb barcelona",
      "sports car", // exclude — handled by vehicles; will be overridden by later vehicles rule
      " sports ", "sports personalised", "cricket player", "sports race car",
      "racing car", "race car",
    ],
  },
  {
    theme: "superheroes",
    keywords: [
      "superman", "spiderman", "batman", "wolverine", " hulk", "avengers",
      "captain america", "iron man", "ironman", "wonder woman", "superhero",
      "super hero", "singham", "bahubali", "little singham",
      "goku", "dragon ball", "shiva on his", "ninja hattori",
      "bts bathrobe", "bts bath", " bts ",
      "tigger tiger superhero",
    ],
  },
  {
    theme: "princess",
    keywords: [
      "princess", " elsa", " anna ", "belle ", "rapunzel", "sophia", "moana",
      "jasmine", "dorothy", "snowhite", "snow white", "tinkerbell", "tinkerbel",
      "barbie", "mermaid princess", "tiara",
    ],
  },
  {
    theme: "florals",
    keywords: ["floral", " flower", " rose ", "daisy", "sunflower"],
  },
  {
    theme: "vehicles",
    keywords: [
      " car ", " car)", " car,", "mustang", "motorcycle", " bike ", "biker",
      "aeroplane", "airplane", "train engine", " cycle", "cruiser",
      "sports car", "racing car", "race car", "red car", "yellow car",
      "blue car", "beetle car", " beetle ", "red beetle",
    ],
  },
  {
    theme: "animals",
    keywords: [
      "pony", "unicorn", " elephant", " lion", " dog ", " cat ", " bear ",
      " fish", " bird ", "rio bird", " cow ", "giraffe", " bee ", "bee,",
      "butterfly", "turtle", "crocodile", "caterpillar", "sheep",
      "peacock", "penguin", " owl", " frog", " rabbit", " ant ", "panda",
      " lizard", "octopus", " whale", " duck", "monkey", "tiger",
      "tigger", "dragonfly", "mermaid", "peppa", "doraemon",
      "hello kitty", " kitty", "minnie", "mickey", "winnie", "pooh",
      "reindeer", " dora ", "crab", "snail", "parrot", "animals", "animal",
      "puppy", "ladybird", "ladybug", "paw patrol", "masha", " nemo", "dori ",
      " chick", "minion", "olaf ", "santa claus", "boss baby",
      "baby croc", "croc in", "ant personalised",
    ],
  },
  {
    theme: "abstract",
    keywords: ["emblem", "abstract", "geometric", "wings emblem"],
  },
];

// ── Style rules ───────────────────────────────────────────────────────────────

const STYLE_RULES = [
  {
    style: "initials",
    keywords: ["initials", "monogram", "initial "],
  },
  {
    style: "elegant",
    keywords: [
      "laurel", "golden", "royal", "gold ", "gold)", "emblem",
      "king and queen", "king & queen", "k & q of hearts", " crown",
      "elegant", "queen of hearts", "king of hearts",
      "mr right", "mrs right", "mr & mrs", "mr and mrs",
      "his and her", "his & her", "he and she", "couple", "valentines",
      "wings emblem", "handsome and gorgeous",
    ],
  },
  {
    style: "bold",
    keywords: [
      "superman", "spiderman", "batman", "wolverine", " hulk", "avengers",
      "captain america", "iron man", "wonder woman", "superhero", "super hero",
      "soccer", "football", "cricket", "basketball", "footballer",
      "ronaldo", "messi", "maradona", "dhoni", "kohli",
      "sports car", "racing car", "race car",
      "sports personalised", "sports kids", "sports adult",
      "goku", "dragon ball", "singham", "ninja hattori",
    ],
  },
  {
    style: "classic",
    keywords: [
      "embroidered", "classic",
    ],
  },
  {
    style: "minimal",
    keywords: ["minimal", "speedo"],
  },
];

// ── Derive functions ──────────────────────────────────────────────────────────

function deriveThemes(name) {
  const matched = new Set();
  for (const rule of THEME_RULES) {
    if (matchesAny(name, rule.keywords)) {
      matched.add(rule.theme);
    }
  }
  // Remove "sports" if also matched "vehicles" (sports car → vehicles only)
  if (matched.has("sports") && matched.has("vehicles")) {
    const lower = ` ${name.toLowerCase()} `;
    const isVehicleOnly = [" car ", " car)", " car,", "mustang", "motorcycle", "aeroplane", "airplane", "train engine", " cycle", "cruiser"].some(kw => lower.includes(kw));
    const isSportsActivity = ["basketball", "cricket", "soccer", "football", "tennis", "footballer", "ronaldo", "messi", "maradona", "dhoni", "kohli", " sports "].some(kw => lower.includes(kw));
    if (!isSportsActivity) {
      matched.delete("sports");
    }
  }
  // Fallback: if nothing matched, assign "abstract"
  if (matched.size === 0) {
    matched.add("abstract");
  }
  return [...matched].join(",");
}

function deriveStyles(name) {
  const matched = new Set();
  for (const rule of STYLE_RULES) {
    if (matchesAny(name, rule.keywords)) {
      matched.add(rule.style);
    }
  }
  // Default fallback: all products get at least "classic"
  if (matched.size === 0) {
    matched.add("classic");
  }
  return [...matched].join(",");
}

// ── Main ──────────────────────────────────────────────────────────────────────

const seedData = JSON.parse(fs.readFileSync(SEED_DATA_PATH, "utf8"));
const products = seedData.products ?? seedData;

let themesSet = 0;
let stylesSet = 0;
const themeDistribution = {};
const styleDistribution = {};

for (const product of products) {
  const themes = deriveThemes(product.name);
  const styles = deriveStyles(product.name);

  product.themes = themes || null;
  product.styles = styles || null;

  if (themes) {
    themesSet++;
    themes.split(",").forEach((t) => {
      themeDistribution[t.trim()] = (themeDistribution[t.trim()] || 0) + 1;
    });
  }
  if (styles) {
    stylesSet++;
    styles.split(",").forEach((s) => {
      styleDistribution[s.trim()] = (styleDistribution[s.trim()] || 0) + 1;
    });
  }
}

fs.writeFileSync(SEED_DATA_PATH, JSON.stringify(seedData, null, 2), "utf8");

console.log(`\nDone! Updated ${products.length} products in seed-data.json`);
console.log(`  Products with themes: ${themesSet} / ${products.length}`);
console.log(`  Products with styles: ${stylesSet} / ${products.length}`);

const noTheme = products.filter(p => !p.themes);
const noStyle = products.filter(p => !p.styles);
if (noTheme.length > 0) console.log(`  WARNING: ${noTheme.length} products still without theme!`);
if (noStyle.length > 0) console.log(`  WARNING: ${noStyle.length} products still without style!`);

console.log("\nTheme distribution:");
Object.entries(themeDistribution)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k}: ${v}`));
console.log("\nStyle distribution:");
Object.entries(styleDistribution)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// Spot-check
console.log("\nSpot checks:");
const checks = [
  "Dinosaur Personalised Towel",
  "Floral Heart with Ladybird with Initials, Personalised Couple Set",
  "Red Beetle Personalised Bath Towel",
  "Space Rocket with Astronaut Personalised Kids Bath Towel",
  "Honey Bee with Flower Personalised Kids Bath Towel (Blue)",
  "Princess Personalised Kids Bath Towel",
  "Superman Personalised Towel",
  "Golden Laurel Initials Personalised Bathrobe",
  "Basketball Personalised Towel",
  "Dhoni Cricket Player Personalised Bath Towel",
  "Ronaldo Soccer/Football Kids Bath Towel",
  "Santa Claus Christmas Personalised Kids Bath Towel",
  "Paw Patrol Personalised Towel",
  "Goku from Dragon Ball Personalised Towel",
  "Personalised Kids Bath Towel",
  "Dog Kids Bath Towel",
  "Princess Kids Bath Towel",
];
checks.forEach((name) => {
  const p = products.find((x) => x.name === name);
  if (p) console.log(`  "${name}"\n    themes: ${p.themes} | styles: ${p.styles}`);
});
