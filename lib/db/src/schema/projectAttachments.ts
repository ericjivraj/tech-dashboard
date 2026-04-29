import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

// Attachments displayed in the project modal. URL is either a relative
// `/attachments/<file>.pdf` (served by the api from data/attachments) or a
// fully-qualified external link (SharePoint, Google Drive, etc.).
export const projectAttachmentsTable = pgTable("project_attachments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectAttachmentSchema = createInsertSchema(projectAttachmentsTable).omit({ id: true, createdAt: true });
export type InsertProjectAttachment = z.infer<typeof insertProjectAttachmentSchema>;
export type ProjectAttachment = typeof projectAttachmentsTable.$inferSelect;
