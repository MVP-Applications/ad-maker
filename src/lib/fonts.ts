/**
 * The typefaces the Brief's font picker offers.
 *
 * Nearly all of these are Google Fonts, which matters for more than breadth:
 * a picker is only useful if the specimen is the face itself, and a reader has
 * almost none of these installed. `googleFontHref` gives the preview something
 * real to load, so choosing is done by looking rather than by recognising a
 * name. The handful of system faces below are the ones no web service serves
 * and a brand still sets — those preview only where they are installed.
 */
export type FontCategory =
  | "sans-serif"
  | "serif"
  | "monospace"
  | "display"
  | "handwriting";

export type OfferedFont = {
  name: string;
  category: FontCategory;
  /** False for faces Google does not serve; the preview then needs them local. */
  google: boolean;
};

const SANS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway",
  "Nunito", "Nunito Sans", "Work Sans", "Rubik", "Karla", "Mulish", "Manrope",
  "DM Sans", "Public Sans", "Plus Jakarta Sans", "Figtree", "Outfit", "Sora",
  "Space Grotesk", "Epilogue", "Urbanist", "Lexend", "Barlow", "Cabin",
  "Source Sans 3", "IBM Plex Sans", "Noto Sans", "PT Sans", "Fira Sans",
  "Ubuntu", "Oxygen", "Quicksand", "Josefin Sans", "Asap", "Assistant",
  "Heebo", "Hind", "Titillium Web", "Overpass", "Red Hat Display",
  "Archivo", "Chivo", "Exo 2", "Jost", "Kanit", "Prompt", "Signika",
  "Dosis", "Catamaran", "Maven Pro", "Questrial", "Varela Round",
  "Libre Franklin", "Schibsted Grotesk", "Instrument Sans", "Geist",
  "Onest", "Bricolage Grotesque", "Wix Madefor Display", "Albert Sans",
  "Be Vietnam Pro", "Readex Pro", "Syne", "General Sans", "Satoshi",
  "Cairo", "Tajawal", "Almarai", "IBM Plex Sans Arabic", "Noto Sans Arabic",
];

const SERIF = [
  "Playfair Display", "Merriweather", "Lora", "PT Serif", "Noto Serif",
  "Source Serif 4", "Libre Baskerville", "Crimson Text", "Crimson Pro",
  "EB Garamond", "Cormorant Garamond", "Cormorant", "Spectral", "Bitter",
  "Arvo", "Rokkitt", "Zilla Slab", "Roboto Slab", "Josefin Slab",
  "Domine", "Cardo", "Neuton", "Vollkorn", "Alegreya", "Frank Ruhl Libre",
  "Faustina", "Literata", "Newsreader", "Fraunces", "Petrona",
  "DM Serif Display", "DM Serif Text", "Instrument Serif", "Young Serif",
  "Bodoni Moda", "Prata", "Marcellus", "Cinzel", "Gilda Display",
  "Old Standard TT", "Amiri", "Scheherazade New", "Noto Naskh Arabic",
];

const MONO = [
  "JetBrains Mono", "IBM Plex Mono", "Roboto Mono", "Space Mono",
  "Source Code Pro", "Fira Code", "Inconsolata", "Ubuntu Mono",
  "DM Mono", "Azeret Mono", "Martian Mono", "Geist Mono", "Courier Prime",
];

const DISPLAY = [
  "Oswald", "Bebas Neue", "Anton", "Archivo Black", "Righteous", "Teko",
  "Staatliches", "Alfa Slab One", "Abril Fatface", "Lilita One",
  "Passion One", "Fjalla One", "Russo One", "Black Ops One", "Bungee",
  "Monoton", "Audiowide", "Orbitron", "Rampart One", "Chakra Petch",
  "Unbounded", "Climate Crisis", "Playfair Display SC", "Yeseva One",
];

const HANDWRITING = [
  "Pacifico", "Dancing Script", "Caveat", "Satisfy", "Great Vibes",
  "Sacramento", "Shadows Into Light", "Indie Flower", "Kalam",
  "Permanent Marker", "Amatic SC", "Courgette", "Lobster", "Cookie",
];

/** Faces Google does not serve, kept because brands genuinely set them. */
const SYSTEM: readonly (readonly [string, FontCategory])[] = [
  ["Helvetica Neue", "sans-serif"],
  ["Helvetica", "sans-serif"],
  ["Arial", "sans-serif"],
  ["Verdana", "sans-serif"],
  ["Tahoma", "sans-serif"],
  ["Trebuchet MS", "sans-serif"],
  ["Futura", "sans-serif"],
  ["Avenir", "sans-serif"],
  ["Avenir Next", "sans-serif"],
  ["Gill Sans", "sans-serif"],
  ["Franklin Gothic", "sans-serif"],
  ["Optima", "sans-serif"],
  ["Segoe UI", "sans-serif"],
  ["SF Pro Display", "sans-serif"],
  ["Georgia", "serif"],
  ["Times New Roman", "serif"],
  ["Garamond", "serif"],
  ["Baskerville", "serif"],
  ["Palatino", "serif"],
  ["Didot", "serif"],
  ["Bodoni 72", "serif"],
  ["Hoefler Text", "serif"],
  ["Courier New", "monospace"],
  ["Menlo", "monospace"],
  ["Monaco", "monospace"],
];

const fromNames = (names: readonly string[], category: FontCategory) =>
  names.map((name) => ({ name, category, google: true }));

export const OFFERED_FONTS: readonly OfferedFont[] = [
  ...fromNames(SANS, "sans-serif"),
  ...fromNames(SERIF, "serif"),
  ...fromNames(MONO, "monospace"),
  ...fromNames(DISPLAY, "display"),
  ...fromNames(HANDWRITING, "handwriting"),
  ...SYSTEM.map(([name, category]) => ({ name, category, google: false })),
].sort((a, b) => a.name.localeCompare(b.name));

export const FONT_CATEGORY_LABEL: Record<FontCategory, string> = {
  "sans-serif": "Sans serif",
  serif: "Serif",
  monospace: "Monospace",
  display: "Display",
  handwriting: "Handwriting",
};

/** The generic a preview falls back to when the face itself cannot load. */
const GENERIC: Record<FontCategory, string> = {
  "sans-serif": "sans-serif",
  serif: "serif",
  monospace: "monospace",
  display: "sans-serif",
  handwriting: "cursive",
};

export function findFont(family: string | null): OfferedFont | null {
  if (!family) return null;
  const wanted = family.trim().toLowerCase();
  return OFFERED_FONTS.find((font) => font.name.toLowerCase() === wanted) ?? null;
}

/**
 * A CSS stack for previewing `family`, quoted so a multi-word name survives.
 *
 * A family the list does not carry is still the brand's answer, so it previews
 * on its own merits and falls back to the page's own sans.
 */
export function fontPreviewStack(family: string | null): string {
  if (!family) return "var(--font-geist-sans), sans-serif";
  const known = findFont(family);
  const fallback = known
    ? GENERIC[known.category]
    : "var(--font-geist-sans), sans-serif";
  return `"${family.replace(/["\\]/g, "")}", ${fallback}`;
}

/**
 * Where to fetch `family` from Google Fonts, or null when it is not served.
 *
 * Regular and bold only: the preview sets one word, and asking for the whole
 * range would download far more than a specimen needs.
 */
export function googleFontHref(family: string | null): string | null {
  const font = findFont(family);
  if (!font?.google) return null;
  const name = font.name.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${name}:wght@400;700&display=swap`;
}
