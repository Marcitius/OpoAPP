import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appState = sqliteTable("app_state", {
  owner: text("owner").primaryKey(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});
