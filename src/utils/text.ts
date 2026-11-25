/** Инициалы из первых двух слов: «Кузнецов Дмитрий Александрович» → «КД» */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

const normalize = (text: string) => text.toLowerCase().replaceAll("ё", "е");

/** Все слова запроса встречаются в тексте, без учёта регистра и «ё»: «кузн дм» */
export const matchesQuery = (text: string, query: string) => {
  const haystack = normalize(text);
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
};
