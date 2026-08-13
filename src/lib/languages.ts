/**
 * The languages offered in the Brief's language picker.
 *
 * A list rather than a lookup: the platform can turn a tag into a name through
 * `Intl.DisplayNames`, but it cannot enumerate the tags worth offering, and a
 * picker of every subtag in existence is not a picker. These are the ones a
 * commercial site is actually published in, most-spoken first, with the tags
 * kept bare — the extract states "en" rather than "en-GB", and a Brief that
 * mixes the two reads as two languages.
 */
export const OFFERED_LANGUAGES = [
  "en",
  "ar",
  "zh",
  "hi",
  "es",
  "fr",
  "pt",
  "ru",
  "ja",
  "de",
  "ko",
  "it",
  "tr",
  "nl",
  "pl",
  "sv",
  "da",
  "no",
  "fi",
  "cs",
  "el",
  "he",
  "id",
  "ms",
  "th",
  "vi",
  "uk",
  "ro",
  "hu",
  "fa",
  "ur",
  "bn",
  "ta",
  "sw",
] as const;

/** "ja" -> "Japanese", using the platform's own table rather than a list here. */
export function languageName(tag: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
