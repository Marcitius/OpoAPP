import { cardCorrectOptions, isMultipleChoiceCard, type Card } from "./legacy";
import { searchText } from "./selection";

const fold = (text: string) => searchText(text).replace(/\s+/g, " ");
const entities: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  uuml: "ü",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};
// Search produces plain strings rendered by React, never HTML. Avoid reparsing
// the whole library with the rich-content sanitizer on the first keystroke.
// The actual card preview still uses the unchanged sanitized RichContent reader.
export function cardSearchText(html: string) {
  return String(html ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|iframe|object|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(/<(script|style|iframe|object|template)\b[\s\S]*$/gi, " ")
    .replace(
      /<br\s*\/?\s*>|<\/(?:p|li|div|h[1-6]|blockquote|tr|pre|td|th)>/gi,
      " ",
    )
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith("#")) {
        const code =
          entity[1]?.toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return code > 0 &&
          code <= 0x10ffff &&
          !(code >= 0xd800 && code <= 0xdfff)
          ? String.fromCodePoint(code)
          : "�";
      }
      const value = entities[entity.toLowerCase()];
      return value === undefined
        ? match
        : entity[0] !== entity[0].toLowerCase()
          ? value.toUpperCase()
          : value;
    })
    .replace(/\s+/g, " ")
    .trim();
}
export interface CardSearchEntry {
  card: Card;
  question: string;
  answer: string;
  questionKey: string;
  answerKey: string;
}
export function createCardSearchIndex(cards: Card[]): CardSearchEntry[] {
  return cards.map((card) => {
    const question = cardSearchText(card.front);
    const parts = [cardSearchText(card.back)];
    if (isMultipleChoiceCard(card))
      parts.push(...cardCorrectOptions(card).map((i) => card.options[i] ?? ""));
    if (card.type === "orthography")
      parts.push(card.orthographyCorrectForm ?? "");
    if (card.type === "table" && Array.isArray(card.table?.rows))
      for (const row of card.table.rows)
        for (const cell of Array.isArray(row.cells) ? row.cells : [])
          parts.push(
            cardSearchText(cell.html ?? ""),
            cell.answer ?? "",
            ...(cell.alternatives ?? []),
          );
    const answer = parts.filter(Boolean).join(" · ");
    return {
      card,
      question,
      answer,
      questionKey: fold(question),
      answerKey: fold(answer),
    };
  });
}
export function searchCards(index: CardSearchEntry[], query: string) {
  const normalized = fold(query);
  if (!normalized) return [];
  const terms = normalized.split(" ");
  return index
    .flatMap((entry, order) => {
      const combined = `${entry.questionKey} ${entry.answerKey}`;
      if (!terms.every((term) => combined.includes(term))) return [];
      const questionMatch = terms.some((term) =>
        entry.questionKey.includes(term),
      );
      const answerMatch = terms.some((term) => entry.answerKey.includes(term));
      const rank =
        entry.questionKey === normalized
          ? 0
          : entry.questionKey.includes(normalized)
            ? 1
            : questionMatch
              ? 2
              : 3;
      return [{ ...entry, questionMatch, answerMatch, rank, order }];
    })
    .sort((a, b) => a.rank - b.rank || a.order - b.order);
}
export function cardSearchExcerpt(text: string, query: string, length = 160) {
  const key = fold(text);
  const positions = fold(query)
    .split(" ")
    .filter(Boolean)
    .map((term) => key.indexOf(term))
    .filter((i) => i >= 0);
  const start = Math.max(
    0,
    (positions.length ? Math.min(...positions) : 0) - 45,
  );
  return `${start ? "…" : ""}${text.slice(start, start + length)}${text.length > start + length ? "…" : ""}`;
}
