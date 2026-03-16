const BG_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sht",
  ъ: "a",
  ь: "y",
  ю: "yu",
  я: "ya",
};

export function transliteratedSlug(value: string) {
  const normalized = value.trim().toLocaleLowerCase("bg-BG");
  const transliterated = [...normalized]
    .map((char) => {
      if (char in BG_TO_LATIN) return BG_TO_LATIN[char];
      if (/[a-z0-9]/.test(char)) return char;
      return " ";
    })
    .join("");

  return transliterated
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
