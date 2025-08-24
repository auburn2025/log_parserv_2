import { type LogEntry, type InsertLogEntry, type LogFile, type InsertLogFile, type FilterSettings, type InsertFilterSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Log entries
  getLogEntries(fileName: string, limit?: number, offset?: number): Promise<LogEntry[]>;
  createLogEntry(entry: InsertLogEntry): Promise<LogEntry>;
  clearLogEntries(fileName: string): Promise<void>;
  getLogStatistics(fileName: string): Promise<{ total: number; errors: number; warnings: number }>;

  // Log files
  getLogFiles(): Promise<LogFile[]>;
  getLogFile(id: string): Promise<LogFile | undefined>;
  createLogFile(file: InsertLogFile): Promise<LogFile>;
  updateLogFileStatus(id: string, status: string): Promise<void>;

  // Filter settings
  getFilterSettings(userId?: string): Promise<FilterSettings | undefined>;
  createOrUpdateFilterSettings(settings: InsertFilterSettings): Promise<FilterSettings>;
}

export class MemStorage implements IStorage {
  private logEntries: Map<string, LogEntry[]>;
  private logFiles: Map<string, LogFile>;
  private filterSettings: Map<string, FilterSettings>;

  constructor() {
    this.logEntries = new Map();
    this.logFiles = new Map();
    this.filterSettings = new Map();
  }

  async getLogEntries(fileName: string, limit: number = 1000, offset: number = 0): Promise<LogEntry[]> {
    const entries = this.logEntries.get(fileName) || [];
    return entries.slice(offset, offset + limit);
  }

  async createLogEntry(insertEntry: InsertLogEntry): Promise<LogEntry> {
    const id = randomUUID();
    const entry: LogEntry = { 
      ...insertEntry, 
      id, 
      logger: insertEntry.logger || null,
      stackTrace: insertEntry.stackTrace || null,
      createdAt: new Date()
    };
    
    const fileName = entry.fileName;
    const entries = this.logEntries.get(fileName) || [];
    entries.push(entry);
    this.logEntries.set(fileName, entries);
    
    return entry;
  }

  async clearLogEntries(fileName: string): Promise<void> {
    this.logEntries.set(fileName, []);
  }

  async getLogStatistics(fileName: string): Promise<{ total: number; errors: number; warnings: number }> {
    const entries = this.logEntries.get(fileName) || [];
    return {
      total: entries.length,
      errors: entries.filter(e => e.level === "ERROR").length,
      warnings: entries.filter(e => e.level === "WARN").length,
    };
  }

  async getLogFiles(): Promise<LogFile[]> {
    return Array.from(this.logFiles.values());
  }

  async getLogFile(id: string): Promise<LogFile | undefined> {
    return this.logFiles.get(id);
  }

  async createLogFile(insertFile: InsertLogFile): Promise<LogFile> {
    const id = randomUUID();
    const file: LogFile = { 
      ...insertFile, 
      id, 
      status: insertFile.status || "active",
      uploadedAt: new Date()
    };
    this.logFiles.set(id, file);
    return file;
  }

  async updateLogFileStatus(id: string, status: string): Promise<void> {
    const file = this.logFiles.get(id);
    if (file) {
      file.status = status;
      this.logFiles.set(id, file);
    }
  }

  async getFilterSettings(userId: string = "default"): Promise<FilterSettings | undefined> {
    return this.filterSettings.get(userId);
  }

  async createOrUpdateFilterSettings(insertSettings: InsertFilterSettings): Promise<FilterSettings> {
    const userId = insertSettings.userId || "default";
    const id = randomUUID();
    const settings: FilterSettings = { 
      ...insertSettings, 
      id,
      userId: insertSettings.userId || null,
      logLevels: insertSettings.logLevels ? [...insertSettings.logLevels] : null,
      keywords: insertSettings.keywords ? [...insertSettings.keywords] : null,
      timeRange: insertSettings.timeRange || null,
      autoScroll: insertSettings.autoScroll || null
    };
    this.filterSettings.set(userId, settings);
    return settings;
  }
}

export const storage = new MemStorage();
