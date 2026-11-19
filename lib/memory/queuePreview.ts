import type { Card } from "../study/legacy";
import {
  answerSession,
  nextSessionCard,
  skipSessionCard,
  upgradeCardSession,
  type CardSession,
  type SessionItem,
} from "./session";

// A read-only lookahead, not a second scheduler. Beyond the current card the
// order assumes each presentation is completed once. Real answers recalculate it.
// Transient ratings used by the existing session reducer never leave this function.
export function previewSessionQueue(
  session: CardSession,
  cards: Card[],
  now: number,
  activeIds: readonly string[] = [],
  limit = 30,
) {
  const source = upgradeCardSession(session);
  const byCard = new Map(cards.map((card) => [card.id, card]));
  const items = source.items.filter((item) => byCard.has(item.id));
  const byItem = new Map(items.map((item) => [item.id, item]));
  const scope = items.map((item) => byCard.get(item.id)!);
  let cursor: CardSession = { ...source, history: [], presentation: undefined };
  const consumed = new Set<string>();
  const consume = (id: string) => {
    const card = byCard.get(id)!;
    if (source.format === "orthography") {
      cursor = skipSessionCard(cursor, id, now);
    } else {
      cursor = answerSession(
        cursor,
        card,
        "easy",
        `queue-preview-${cursor.turn}-${id}`,
        now,
        10,
      );
    }
    consumed.add(id);
  };
  for (const id of activeIds) {
    const item = byItem.get(id);
    if (item && ["new", "reinforce"].includes(item.status) && !consumed.has(id))
      consume(id);
  }
  const upcoming: SessionItem[] = [];
  const count = Math.max(
    1,
    Math.min(items.length || 1, Math.floor(limit) || 30),
  );
  while (upcoming.length < count) {
    const next = nextSessionCard(cursor, scope, now);
    if (next.kind !== "card" || consumed.has(next.id)) break;
    upcoming.push(byItem.get(next.id)!);
    consume(next.id);
  }
  const next = nextSessionCard(cursor, scope, now);
  const hasMore = next.kind === "card" && !consumed.has(next.id);
  const held = items
    .filter(
      (item) =>
        item.status === "weak" ||
        item.status === "skipped" ||
        (!hasMore &&
          !consumed.has(item.id) &&
          ["new", "reinforce"].includes(item.status)),
    )
    .sort(
      (a, b) =>
        (a.lastScore ?? a.priorityScore ?? 11) -
        (b.lastScore ?? b.priorityScore ?? 11),
    );
  return {
    upcoming,
    held,
    approved: items.filter((item) => item.status === "remembered"),
    hasMore,
    waiting: next.kind === "waiting",
    missing: source.items.length - items.length,
    total: items.length,
  };
}
