import { sql } from "drizzle-orm";
import { pgTable, pgEnum, text, varchar, timestamp, integer, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const logLevelEnum = pgEnum("log_level", ["ERROR", "WARN", "INFO", "DEBUG"]);

export const logEntries = pgTable("log_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lineNumber: integer("line_number").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  level: logLevelEnum("level").notNull(),
  logger: text("logger"),
  message: text("message").notNull(),
  stackTrace: text("stack_trace"),
  fileName: text("file_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const logFiles = pgTable("log_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("active"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const filterSettings = pgTable("filter_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  logLevels: json("log_levels").$type<string[]>().default(["ERROR", "WARN", "INFO", "DEBUG"]),
  keywords: json("keywords").$type<string[]>().default([]),
  timeRange: text("time_range").$type<"all" | string>().default("all"),
  autoScroll: boolean("auto_scroll").default(true),
});

export const insertLogEntrySchema = createInsertSchema(logEntries).omit({
  id: true,
  createdAt: true,
});

export const insertLogFileSchema = createInsertSchema(logFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertFilterSettingsSchema = createInsertSchema(filterSettings).omit({
  id: true,
});

export type LogEntry = typeof logEntries.$inferSelect;
export type InsertLogEntry = z.infer<typeof insertLogEntrySchema>;
export type LogFile = typeof logFiles.$inferSelect;
export type InsertLogFile = z.infer<typeof insertLogFileSchema>;
export type FilterSettings = typeof filterSettings.$inferSelect;
export type InsertFilterSettings = z.infer<typeof insertFilterSettingsSchema>;

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG";
export type ServerStatus = "connected" | "disconnected" | "connecting";
export type LogStatistics = {
  total: number;
  errors: number;
  warnings: number;
  filtered: number;
};