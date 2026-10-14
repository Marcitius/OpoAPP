import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { readAccount, transact } from "../data/local";
import {
  applyLocal,
  differences,
  mergeRemote,
  project,
} from "../data/projection";
import {
  emptyState,
  operation,
  type LegacyState,
  type LocalAccount,
  type Operation,
  type Row,
} from "../data/models";
export type SyncStatus = {
  phase: "loading" | "saved" | "saving" | "offline" | "error";
  pending: number;
  message?: string;
};
export class SyncEngine {
  state = emptyState();
  status: SyncStatus = { phase: "loading", pending: 0 };
  private listeners = new Set<() => void>();
  private running = false;
  private currentSync?: Promise<void>;
  private stopped = false;
  private localChain = Promise.resolve();
  private channel?: RealtimeChannel;
  private broadcast?: BroadcastChannel;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    public readonly user: string,
    private client: SupabaseClient,
  ) {}
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish(
    a: LocalAccount,
    phase = this.status.phase,
    message?: string,
  ) {
    if (this.stopped) return;
    this.state = project(a.rows);
    this.status = {
      phase,
      pending: a.queue.length,
      message: message ?? a.notice,
    };
    this.listeners.forEach((fn) => fn());
  }
  async start() {
    const a = await readAccount(this.user);
    if (this.stopped) return;
    this.publish(a, navigator.onLine ? "saving" : "offline");
    if (typeof BroadcastChannel !== "undefined") {
      this.broadcast = new BroadcastChannel("opogc:" + this.user);
      this.broadcast.onmessage = async (event) => {
        this.publish(await readAccount(this.user));
        if (event.data === "change") void this.sync();
      };
    }
    this.channel = this.client
      .channel("opogc:" + this.user)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sync_heads",
          filter: `user_id=eq.${this.user}`,
        },
        () => {
          void this.sync();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void this.sync();
      });
    window.addEventListener("online", this.onWake);
    window.addEventListener("focus", this.onWake);
    document.addEventListener("visibilitychange", this.onVisible);
    this.timer = setInterval(() => {
      if (document.visibilityState === "visible") void this.sync();
    }, 30000);
    await this.sync();
  }
  private onWake = () => {
    void this.sync();
  };
  private onVisible = () => {
    if (document.visibilityState === "visible") void this.sync();
  };
  async update(before: LegacyState, next: LegacyState) {
    // The updater was evaluated once by the UI, outside React's state callback.
    this.localChain = this.localChain
      .catch(() => {})
      .then(async () => {
        const a = await transact(this.user, (a) =>
          applyLocal(a, differences(before, next, a)),
        );
        this.publish(a, navigator.onLine ? "saving" : "offline");
        this.broadcast?.postMessage("change");
        void this.sync();
      });
    return this.localChain;
  }
  async enqueue(ops: Operation[]) {
    await this.localChain;
    const a = await transact(this.user, (a) => applyLocal(a, ops));
    this.publish(a, "saving");
    this.broadcast?.postMessage("change");
    void this.sync();
  }
  async flush() {
    await this.localChain;
    await this.sync();
    return (await readAccount(this.user)).queue.length === 0;
  }
  async sync() {
    if (this.stopped) return;
    if (this.running) return this.currentSync;
    if (!navigator.onLine) {
      this.publish(await readAccount(this.user), "offline");
      return;
    }
    this.running = true;
    const work = async () => {
      try {
        await this.localChain;
        this.publish(await readAccount(this.user), "saving");
        // Pull first, then replay the durable queue. A lost HTTP response is safe: op_id is idempotent.
        await this.pull();
        while (!this.stopped) {
          const a = await readAccount(this.user);
          if (!a.queue.length) break;
          // Each local transaction is uploaded atomically, including parent-child imports.
          // The server caps total JSON size, rather than splitting dependent records.
          const batch = a.queue.filter((op) => op.txn_id === a.queue[0].txn_id);
          const { data, error } = await this.rpc("apply_operations", {
            operations: batch,
          });
          if (
            error &&
            /syllabus cycle|folder cycle/i.test(error.message) &&
            batch.every((op) => ["studyNodes", "folders"].includes(op.kind))
          ) {
            const refused = new Set(batch.map((op) => op.op_id));
            await transact(this.user, (a) => {
              a.rejectedOperations = [
                ...(a.rejectedOperations ?? []),
                ...batch,
              ];
              a.queue = a.queue.filter((op) => !refused.has(op.op_id));
              a.rows = {};
              a.cursor = 0;
              a.notice =
                "Un movimiento concurrente creaba un ciclo. Se ha restaurado el árbol válido; el cambio rechazado se conserva en la copia de seguridad.";
            });
            await this.pull();
            continue;
          }
          if (error) throw error;
          const acknowledged = new Set<string>(data);
          if (!acknowledged.size)
            throw new Error("El servidor no confirmó las operaciones.");
          await transact(this.user, (a) => {
            a.queue = a.queue.filter((op) => !acknowledged.has(op.op_id));
          });
        }
        await this.pull();
        const a = await readAccount(this.user);
        this.publish(a, a.queue.length ? "saving" : "saved");
        this.broadcast?.postMessage("remote");
      } catch (e) {
        this.publish(
          await readAccount(this.user),
          navigator.onLine ? "error" : "offline",
          e instanceof Error
            ? e.message
            : ((e as any)?.message ??
                "No se pudo conectar. Tus cambios siguen guardados en este dispositivo."),
        );
      }
    };
    this.currentSync = (async () => {
      try {
        if (navigator.locks)
          await navigator.locks.request("opogc-sync:" + this.user, work);
        else await work();
      } finally {
        this.running = false;
      }
    })();
    return this.currentSync;
  }
  private async rpc(name: string, args: Record<string, unknown>) {
    if (this.stopped)
      throw new Error(
        "La sesión se ha cerrado; los cambios pendientes se conservan.",
      );
    const {
      data: { session },
    } = await this.client.auth.getSession();
    if (!session || session.user.id !== this.user || this.stopped)
      throw new Error("Inicia sesión con la cuenta que generó estos cambios.");
    // Bind each HTTP request to this account's token. Switching accounts mid-request
    // cannot upload the previous account's outbox under the new user's JWT.
    return this.client
      .rpc(name, args)
      .setHeader("Authorization", `Bearer ${session.access_token}`);
  }

  private async pull() {
    for (;;) {
      const a = await readAccount(this.user);
      const { data, error } = await this.rpc("pull_changes", {
        after_revision: a.cursor,
        page_size: 1000,
      });
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      if (!rows.length) {
        await transact(this.user, (a) => {
          a.initialized = true;
        });
        break;
      }
      const cursor = Math.max(...rows.map((r) => Number(r.revision)));
      await transact(this.user, (a) => mergeRemote(a, rows, cursor));
      if (rows.length < 1000) break;
    }
  }
  async migrate(source: LegacyState, fingerprint: string) {
    await this.localChain;
    const a = await transact(this.user, (a) => {
      if (a.migrated.includes(fingerprint)) return;
      // A migration merges by stable record ID. It never deletes existing account records.
      const merged = mergeImport(project(a.rows), source);
      const ops = differences(project(a.rows), merged, a).map((op) =>
        op.kind === "studySessions" &&
        op.id.startsWith("session-") &&
        op.patch.taskId
          ? {
              ...op,
              id:
                "import-session:" +
                op.patch.taskId +
                ":" +
                op.patch.completedAt,
            }
          : op,
      );
      applyLocal(a, ops);
      a.migrated.push(fingerprint);
    });
    this.publish(a, "saving");
    this.broadcast?.postMessage("change");
    await this.sync();
  }
  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    window.removeEventListener("online", this.onWake);
    window.removeEventListener("focus", this.onWake);
    document.removeEventListener("visibilitychange", this.onVisible);
    this.broadcast?.close();
    if (this.channel) void this.client.removeChannel(this.channel);
  }
}
export function mergeImport(a: LegacyState, b: LegacyState): LegacyState {
  const union = (x: any[], y: any[]) => {
    const m = new Map(x.map((i) => [i.id, i]));
    y.forEach((i) => m.set(i.id, { ...m.get(i.id), ...i }));
    return [...m.values()];
  };
  const studyTasks = union(a.studyTasks, b.studyTasks).map((t) => {
    const old = a.studyTasks.find((x) => x.id === t.id);
    if (old?.status === "done" && t.status !== "done") return old;
    return {
      ...t,
      completionNote: t.completionNote || old?.completionNote || "",
    };
  });
  const cards = union(a.cards, b.cards).map((c) => {
    const old = a.cards.find((x) => x.id === c.id);
    if (old && (old.reviewCount ?? 0) > (c.reviewCount ?? 0)) {
      for (const k of [
        "dueAt",
        "lastReviewedAt",
        "intervalDays",
        "ease",
        "repetitions",
        "lapses",
        "streak",
        "reviewCount",
        "successCount",
        "fsrsStability",
        "fsrsDifficulty",
        "orthographyStage",
      ])
        c[k] = old[k];
    }
    return c;
  });
  return {
    ...a,
    folders: union(a.folders, b.folders),
    cards,
    reviews: union(a.reviews, b.reviews),
    studyNodes: union(a.studyNodes, b.studyNodes),
    studyTasks,
    psychTests: union(a.psychTests, b.psychTests).map((t) => ({
      ...t,
      attempts: union(
        a.psychTests.find((x) => x.id === t.id)?.attempts ?? [],
        t.attempts ?? [],
      ),
    })),
    settings: {
      ...a.settings,
      ...b.settings,
      seedVersion: Math.max(
        a.settings.seedVersion ?? 2,
        b.settings.seedVersion ?? 2,
      ),
    },
  };
}
