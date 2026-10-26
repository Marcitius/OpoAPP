import type { AppState, Card } from "../study/legacy";
import { assignCollection } from "./collections";
import { savedCardSessions, storeCardSession } from "../memory/checkpoint";

// Edit content only: a remote review received while the editor is open must
// retain its latest scheduling, counters and history. Identity is never copied.
export function mergeCardContent(current: Card, edited: Card): Card {
  if (current.id !== edited.id) throw new Error("La tarjeta ha cambiado.");
  return {
    ...current,
    folderId: edited.folderId,
    type: edited.type,
    front: edited.front,
    back: edited.back,
    options: edited.options,
    correctOption: edited.correctOption,
    correctOptions: edited.correctOptions,
    attachment: edited.attachment,
    orthographyIsCorrect: edited.orthographyIsCorrect,
    orthographyCorrectForm: edited.orthographyCorrectForm,
    orthographyExplanation: edited.orthographyExplanation,
    orthographySource: edited.orthographySource,
  };
}

// Remove membership and pending session appearances in the same local update.
// Ratings and past attempts remain intact. Other collections are independent.
export function withdrawCollectionCard(
  current: AppState,
  collectionId: string,
  cardId: string,
  now: number,
): AppState {
  let next = assignCollection(current, collectionId, [cardId], false);
  for (const session of savedCardSessions(next.settings)) {
    if (session.sourceCollectionId !== collectionId) continue;
    const presentation = session.presentation;
    const queue = presentation?.queue.filter((q) => q.cardId !== cardId);
    const currentItem = presentation?.queue[presentation.index];
    next = {
      ...next,
      settings: storeCardSession(next.settings, {
        ...session,
        updatedAt: new Date(now).toISOString(),
        items: session.items.filter((item) => item.id !== cardId),
        ...(presentation && queue
          ? {
              presentation: {
                ...presentation,
                queue,
                index: currentItem
                  ? Math.max(0, queue.indexOf(currentItem))
                  : queue.length,
              },
            }
          : {}),
      }),
    };
  }
  return next;
}
