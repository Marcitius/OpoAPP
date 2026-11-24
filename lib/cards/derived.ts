import type { AppState, Card, Review } from "../study/legacy";
import { snapshotCard, cardContentKey } from "./context";
import { cardSessionById, storeCardSession } from "../memory/checkpoint";
import { createCardSession } from "../memory/session";
export interface CardDerivation {
  version: 1;
  sourceCardId: string;
  sourceContentKey: string;
  sourceContent: NonNullable<Review["cardSnapshot"]>;
  createdAt: string;
  sessionId?: string;
  noteId?: string;
}
export function sourceNeedsReview(card: Card, cards: Card[]) {
  if (!card.derivation) return false;
  const source = cards.find((c) => c.id === card.derivation?.sourceCardId);
  return (
    !!source && card.derivation?.sourceContentKey !== cardContentKey(source)
  );
}
export function saveDerivedCard(
  state: AppState,
  card: Card,
  sourceId: string,
  now: string,
  sessionId?: string,
  practice = false,
  noteId?: string,
  basis?: Card,
): AppState {
  const source = state.cards.find((c) => c.id === sourceId);
  if (!source) throw Error("La tarjeta de origen ya no está disponible.");
  if (state.cards.some((c) => c.id === card.id) || card.id === sourceId)
    throw Error("La tarjeta ya existe.");
  if (!state.folders.some((f) => f.id === card.folderId))
    throw Error("Selecciona una carpeta disponible.");
  let session = sessionId ? cardSessionById(state.settings, sessionId) : null;
  if (
    practice &&
    (!session ||
      session.format === "orthography" ||
      card.type === "orthography")
  )
    throw Error("Guarda esta tarjeta para estudiarla en una sesión nueva.");
  const derivation: CardDerivation = {
    version: 1,
    sourceCardId: sourceId,
    sourceContentKey: cardContentKey(basis ?? source),
    sourceContent: snapshotCard(state, basis ?? source),
    createdAt: now,
    ...(sessionId ? { sessionId } : {}),
    ...(noteId ? { noteId } : {}),
  };
  const derived = { ...card, derivation };
  let settings = {
    ...state.settings,
    ["cardDerivation:" + card.id]: {
      cardId: card.id,
      ...derivation,
      content: snapshotCard(state, derived),
    },
  };
  if (practice && session) {
    // The answer has just been studied. Interleave using the existing distinct-
    // card gap, and exclude this guided practice from independent recall/FSRS.
    const item = createCardSession(
      [derived],
      session.mode,
      "draft",
      Date.parse(now),
    ).items[0];
    const others = session.items.filter(
      (i) =>
        i.id !== sourceId &&
        i.status !== "remembered" &&
        state.cards.some((c) => c.id === i.id),
    ).length;
    const gap = Math.min(3, Math.max(1, others));
    const trail = session.trail ?? [];
    session = {
      ...session,
      updatedAt: now,
      items: [
        ...session.items,
        {
          ...item,
          status: "reinforce",
          guidedPractice: true,
          lastStep: trail.length,
          lastScore: 4,
          gap,
        },
      ],
    };
    settings = storeCardSession(settings, session);
  }
  return { ...state, cards: [...state.cards, derived], settings };
}

export function acknowledgeDerivedSource(
  state: AppState,
  id: string,
): AppState {
  const child = state.cards.find((c) => c.id === id);
  const source = state.cards.find(
    (c) => c.id === child?.derivation?.sourceCardId,
  );
  if (!child?.derivation || !source) return state;
  return {
    ...state,
    cards: state.cards.map((c) =>
      c.id === id
        ? {
            ...c,
            derivation: {
              ...child.derivation!,
              sourceContentKey: cardContentKey(source),
              sourceContent: snapshotCard(state, source),
            },
          }
        : c,
    ),
  };
}
