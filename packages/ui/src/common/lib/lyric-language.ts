export const lyricLanguageCode = (translation: LyricTranslation) => translation.language || "und";

export function lyricLanguages(lines: readonly LyricLine[]): string[] {
  return [
    ...new Set(
      lines.flatMap(
        (line) =>
          line.translations
            ?.filter((translation) => translation.text.trim())
            .map(lyricLanguageCode) ?? []
      )
    )
  ];
}

export function preferredLyricLanguage(languages: readonly string[]): string | undefined {
  return languages.find((language) => /^zh(?:-|$)/i.test(language)) ?? languages[0];
}

const languageLabels: Record<string, string> = {
  en: "英",
  zh: "中",
  ja: "日",
  ko: "韩",
  fr: "法",
  de: "德",
  es: "西",
  ru: "俄",
  und: "译"
};
const languageNames = new Intl.DisplayNames(["zh-CN"], { type: "language" });

export function lyricLanguageName(language: string): string {
  if (language === "und") return "翻译";
  try {
    return languageNames.of(language) ?? language;
  } catch {
    return language;
  }
}

export function lyricLanguageLabel(language: string, languages: readonly string[]): string {
  if (
    language.startsWith("zh-") &&
    languages.filter((item) => /^zh(?:-|$)/.test(item)).length > 1
  ) {
    if (language.includes("Hans")) return "简";
    if (language.includes("Hant")) return "繁";
  }
  return (
    languageLabels[language.split("-")[0]!.toLowerCase()] ?? lyricLanguageName(language).slice(0, 1)
  );
}
