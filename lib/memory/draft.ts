import { readValue, writeValue } from "../data/local";
import type { CardSession, SessionPresentation } from "./session";
export const reviewDraftKey = (user: string, id: string) =>
  `review-draft:${user}:${id}`;
export interface ReviewDraft {
  version: 1;
  id: string;
  turn: number;
  base: string;
  presentation: SessionPresentation;
}
export function matchingReviewDraft(
  draft: ReviewDraft | undefined,
  session: CardSession,
) {
  return draft?.version === 1 &&
    draft.id === session.id &&
    draft.turn === session.turn &&
    draft.base === session.updatedAt
    ? draft.presentation
    : null;
}
export async function readReviewDraft(user: string, session: CardSession) {
  return matchingReviewDraft(
    await readValue<ReviewDraft>("legacy", reviewDraftKey(user, session.id)),
    session,
  );
}
export function writeReviewDraft(
  user: string,
  id: string,
  turn: number,
  base: string,
  presentation: SessionPresentation,
) {
  return writeValue("legacy", reviewDraftKey(user, id), {
    version: 1,
    id,
    turn,
    base,
    presentation,
  } satisfies ReviewDraft);
}
