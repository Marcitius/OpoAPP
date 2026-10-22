import type { AppState, Card } from "../study/legacy";
import { assignCollection } from "./collections";
import { validSession } from "../memory/session";

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
  const next = assignCollection(current, collectionId, [cardId], false);
  const session = next.settings.activeCardSession;
  if (!validSession(session) || session.sourceCollectionId !== collectionId)
    return next;
  return {
    ...next,
    settings: {
      ...next.settings,
      activeCardSession: {
        ...session,
        updatedAt: new Date(now).toISOString(),
        items: session.items.filter((item) => item.id !== cardId),
        ...(session.presentation
          ? {
              presentation: {
                ...session.presentation,
                queue: session.presentation.queue.filter(
                  (q) => q.cardId !== cardId,
                ),
                index: Math.min(
                  session.presentation.index,
                  session.presentation.queue.filter((q) => q.cardId !== cardId)
                    .length,
                ),
              },
            }
          : {}),
      },
    },
  };
}
