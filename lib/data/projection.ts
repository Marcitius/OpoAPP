import {
  collections,
  emptyState,
  operation,
  rowKey,
  type JsonRecord,
  type LegacyState,
  type LocalAccount,
  type Operation,
  type Row,
  type Collection,
} from "./models";
const simple = ["folders", "cards", "reviews", "studyNodes"] as const;
export function flatten(
  state: LegacyState,
): Record<string, { kind: Collection; id: string; data: JsonRecord }> {
  const rows: ReturnType<typeof flatten> = {};
  const add = (kind: Collection, item: JsonRecord, index = 0) => {
    if (item.id)
      rows[rowKey(kind, String(item.id))] = {
        kind,
        id: String(item.id),
        data: { ...item, _order: index },
      };
  };
  simple.forEach((kind) =>
    (state[kind] ?? []).forEach((x, i) => add(kind, x, i)),
  );
  (state.studyTasks ?? []).forEach((x, i) => {
    const { _sessionId, _taskId, ...rest } = x;
    if (_sessionId)
      add(
        "studySessions",
        { ...rest, id: _sessionId, taskId: _taskId ?? x.id },
        i,
      );
    else add("studyTasks", rest, i);
  });
  (state.psychTests ?? []).forEach((x, i) => {
    const { attempts, ...rest } = x;
    add("psychTests", rest, i);
    (attempts ?? []).forEach((a: JsonRecord, j: number) =>
      add("attempts", { ...a, testId: x.id }, j),
    );
  });
  Object.entries(state.settings ?? {}).forEach(([id, value]) =>
    add("settings", { id, value }),
  );
  return rows;
}
export function project(rows: Record<string, Row>): LegacyState {
  const state = emptyState();
  const list = (kind: Collection): JsonRecord[] =>
    Object.values(rows)
      .filter((x) => x.kind === kind && !x.deleted)
      .sort(
        (a, b) =>
          (a.data._order ?? 0) - (b.data._order ?? 0) ||
          a.id.localeCompare(b.id),
      )
      .map((x) => {
        const { _order, ...data } = x.data;
        return { ...data, id: x.id };
      });
  simple.forEach((kind) => {
    state[kind] = list(kind);
  });
  // A stale offline move may temporarily conflict with a remote move. Keep the
  // local projection traversable while PostgreSQL validates the definitive tree.
  for (const nodes of [state.studyNodes, state.folders]) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const node of nodes) {
      const seen = new Set([node.id]);
      let parent = node.parentId;
      while (parent) {
        if (seen.has(parent)) {
          node.parentId = null;
          break;
        }
        seen.add(parent);
        parent = byId.get(parent)?.parentId;
      }
    }
  }
  // Logs are the authority for counters; simultaneous absolute updates cannot lose a review.
  state.cards = state.cards.map((card) => {
    const history = state.reviews.filter(
      (r) => r.cardId === card.id && !r.reinforcement,
    );
    return {
      ...card,
      reviewCount: Math.max(card.reviewCount ?? 0, history.length),
      successCount: Math.max(
        card.successCount ?? 0,
        history.filter((r) => r.correct).length,
      ),
    };
  });
  state.psychTests = list("psychTests").map((x) => ({
    ...x,
    attempts: list("attempts").filter((a) => a.testId === x.id),
  }));
  list("settings").forEach((x) => (state.settings[x.id] = x.value));
  // Each completion has its own session. Concurrent completions of one task remain visible.
  state.studyTasks = list("studyTasks");
  const sessions = list("studySessions");
  const sessionTasks = new Set(
    Object.values(rows)
      .filter((r) => r.kind === "studySessions")
      .map((s) => s.data.taskId),
  );
  state.studyTasks = state.studyTasks.filter(
    (t) =>
      state.studyNodes.some((n) => n.id === t.nodeId) &&
      !sessionTasks.has(t.id),
  );
  const primary = new Set<string>();
  sessions
    .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))
    .forEach((s) => {
      if (!state.studyNodes.some((n) => n.id === s.nodeId)) return;
      const isPrimary = !primary.has(s.taskId);
      primary.add(s.taskId);
      state.studyTasks.push({
        ...s,
        id: isPrimary ? s.taskId : s.id,
        _sessionId: s.id,
        _taskId: s.taskId,
        status: "done",
      });
    });
  return state;
}
export function differences(
  before: LegacyState,
  after: LegacyState,
  account: LocalAccount,
): Operation[] {
  const a = flatten(before),
    b = flatten(after),
    ops: Operation[] = [];
  for (const [key, next] of Object.entries(b)) {
    const old = a[key]?.data;
    const patch: JsonRecord = {};
    for (const [field, value] of Object.entries(next.data))
      if (JSON.stringify(value) !== JSON.stringify(old?.[field]))
        patch[field] = value;
    if (!Object.keys(patch).length) continue;
    const current = account.rows[key];
    ops.push(operation(next.kind, next.id, patch, current?.revision));
    if (next.kind === "studyTasks" && next.data.status === "done") {
      const isNewCompletion =
        old?.status !== "done" ||
        old?.completedAt !== next.data.completedAt ||
        old?.assessment !== next.data.assessment;
      if (!isNewCompletion && Object.hasOwn(patch, "completionNote")) {
        const session = Object.values(account.rows)
          .filter(
            (r) =>
              r.kind === "studySessions" &&
              !r.deleted &&
              r.data.taskId === next.id,
          )
          .sort((a, b) =>
            String(b.data.completedAt).localeCompare(
              String(a.data.completedAt),
            ),
          )[0];
        if (session)
          ops.push(
            operation(
              "studySessions",
              session.id,
              { completionNote: patch.completionNote },
              session.revision,
            ),
          );
      }
      if (isNewCompletion) {
        const id =
          next.data._completionEventId ??
          "session-" + ops[ops.length - 1].op_id;
        ops.push(
          operation("studySessions", id, { ...next.data, id, taskId: next.id }),
        );
        ops.push(
          operation("nodeStates", next.data.nodeId, {
            id: next.data.nodeId,
            nodeId: next.data.nodeId,
            status: "studied",
            lastStudiedAt: next.data.completedAt,
            assessment: next.data.assessment,
          }),
        );
      }
    }
  }
  for (const [key, old] of Object.entries(a))
    if (!b[key])
      ops.push(
        operation(old.kind, old.id, {}, account.rows[key]?.revision, true),
      );
  for (const op of [...ops]) {
    if (op.kind !== "studySessions" || !op.patch.taskId || op.deleted) continue;
    const taskId = op.patch.taskId;
    if (
      !account.rows[rowKey("studyTasks", taskId)] &&
      !ops.some((x) => x.kind === "studyTasks" && x.id === taskId)
    ) {
      ops.unshift(operation("studyTasks", taskId, { ...op.patch, id: taskId }));
    }
  }
  return ops;
}

export function applyLocal(a: LocalAccount, ops: Operation[]) {
  const txn = crypto.randomUUID();
  ops.forEach((op) => {
    op.txn_id ??= txn;
  });
  for (const op of ops) {
    const key = rowKey(op.kind, op.id);
    const old = a.rows[key];
    if (old?.deleted && !op.deleted) continue;
    a.rows[key] = {
      kind: op.kind,
      id: op.id,
      data: { ...old?.data, ...op.patch, id: op.id },
      revision: old?.revision ?? 0,
      deleted: !!op.deleted,
    };
  }
  a.queue.push(...ops);
  a.initialized = true;
}
export function mergeRemote(a: LocalAccount, remote: Row[], cursor: number) {
  for (const row of remote) {
    const key = rowKey(row.kind, row.id);
    if (row.revision >= (a.rows[key]?.revision ?? 0)) a.rows[key] = row;
  }
  a.cursor = Math.max(a.cursor, cursor);
  // Overlay unacknowledged patches without replacing unrelated server fields.
  for (const op of a.queue) {
    const key = rowKey(op.kind, op.id),
      old = a.rows[key];
    if (old?.deleted && !op.deleted) continue;
    a.rows[key] = {
      kind: op.kind,
      id: op.id,
      data: { ...old?.data, ...op.patch, id: op.id },
      revision: old?.revision ?? 0,
      deleted: !!op.deleted,
    };
  }
  a.initialized = true;
}
