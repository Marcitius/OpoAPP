export type JsonRecord = Record<string, any>;
export const collections = [
  "competitions",
  "syllabi",
  "folders",
  "cards",
  "reviews",
  "psychTests",
  "attempts",
  "studyNodes",
  "studyTasks",
  "studySessions",
  "nodeStates",
  "annotations",
  "settings",
] as const;
export type Collection = (typeof collections)[number];
export interface LegacyState {
  version: 1;
  folders: JsonRecord[];
  cards: JsonRecord[];
  reviews: JsonRecord[];
  psychTests: JsonRecord[];
  studyNodes: JsonRecord[];
  studyTasks: JsonRecord[];
  settings: JsonRecord;
}
export interface Row {
  kind: Collection;
  id: string;
  data: JsonRecord;
  revision: number;
  deleted: boolean;
  updated_at?: string;
}
export interface Operation {
  op_id: string;
  kind: Collection;
  id: string;
  patch: JsonRecord;
  deleted?: boolean;
  base_revision: number;
  created_at: string;
  txn_id?: string;
}
export interface LocalAccount {
  rows: Record<string, Row>;
  queue: Operation[];
  cursor: number;
  migrated: string[];
  initialized: boolean;
  rejectedOperations?: Operation[];
  notice?: string;
}
export const emptyState = (): LegacyState => ({
  version: 1,
  folders: [],
  cards: [],
  reviews: [],
  psychTests: [],
  studyNodes: [],
  studyTasks: [],
  settings: { dailyReviewGoal: 30, dailyNewLimit: 12, seedVersion: 2 },
});
export const emptyAccount = (): LocalAccount => ({
  rows: {},
  queue: [],
  cursor: 0,
  migrated: [],
  initialized: false,
});
export const rowKey = (kind: Collection, id: string) => kind + ":" + id;
export const operation = (
  kind: Collection,
  id: string,
  patch: JsonRecord,
  revision = 0,
  deleted = false,
): Operation => ({
  op_id: crypto.randomUUID(),
  kind,
  id,
  patch,
  deleted,
  base_revision: revision,
  created_at: new Date().toISOString(),
});
