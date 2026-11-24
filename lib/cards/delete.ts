import type { AppState } from "../study/legacy";
import { savedCardSessions, storeCardSession } from "../memory/checkpoint";
import { membershipKey, reviewCollections } from "../review/collections";
export const deletedCardKey = (id: string) => "deletedCard:" + id;
export function deleteCards(
  state: AppState,
  ids: string[],
  now: string,
): AppState {
  const deleted = new Set(
    ids.filter((id) => state.cards.some((c) => c.id === id)),
  );
  if (!deleted.size) return state;
  let settings = { ...state.settings };
  for (const card of state.cards)
    if (deleted.has(card.id)) {
      // Retain the SQL reference needed by old reviews in a portable backup.
      // Attachments are deliberately not retained or downloaded for deleted cards.
      settings[deletedCardKey(card.id)] = {
        version: 1,
        at: now,
        card: { ...card, attachment: null },
      };
      for (const collection of reviewCollections(settings))
        settings[membershipKey(collection.id, card.id)] = false;
    }
  for (const session of savedCardSessions(settings)) {
    if (!session.items.some((i) => deleted.has(i.id))) continue;
    const p = session.presentation,
      current = p?.queue[p.index];
    const queue = p?.queue.filter((q) => !deleted.has(q.cardId));
    settings = storeCardSession(settings, {
      ...session,
      turn: session.turn + 1,
      updatedAt: now,
      items: session.items.filter((i) => !deleted.has(i.id)),
      ...(p && queue
        ? {
            presentation: {
              ...p,
              queue,
              index:
                current && !deleted.has(current.cardId)
                  ? Math.max(0, queue.indexOf(current))
                  : queue.length,
              orthography: p.orthography
                ? {
                    ...p.orthography,
                    groupIds: p.orthography.groupIds.filter(
                      (id) => !deleted.has(id),
                    ),
                    results:
                      p.orthography.results?.filter(
                        (r) => !deleted.has(r.cardId),
                      ) ?? null,
                  }
                : null,
              orthographySelected: p.orthographySelected.filter(
                (id) => !deleted.has(id),
              ),
            },
          }
        : {}),
    });
  }
  return {
    ...state,
    settings,
    cards: state.cards.filter((c) => !deleted.has(c.id)),
  };
}
