import { randomUUID } from "crypto";

export class MemStorage {
    logEntries;
    logFiles;
    filterSettings;
    constructor() {
        this.logEntries = new Map();
        this.logFiles = new Map();
        this.filterSettings = new Map();
    }
    async getLogEntries(fileName, limit = 1000, offset = 0) {
        const entries = this.logEntries.get(fileName) || [];
        return entries.slice(offset, offset + limit).map(entry => ({
            ...entry,
            level: entry.level.toUpperCase(),
            timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : entry.timestamp.toISOString()
        }));
    }
    async createLogEntry(insertEntry) {
        const id = randomUUID();
        const entry = {
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
    async clearLogEntries(fileName) {
        this.logEntries.set(fileName, []);
    }
    async deleteLogFile(fileId) {
        this.logFiles.delete(fileId);
        this.logEntries.delete(fileId);
    }
    async getLogStatistics(fileName) {
        const entries = this.logEntries.get(fileName) || [];
        return {
            total: entries.length,
            errors: entries.filter(e => e.level.toUpperCase() === "ERROR").length,
            warnings: entries.filter(e => e.level.toUpperCase() === "WARN").length,
        };
    }
    async getLogFiles() {
        return Array.from(this.logFiles.values());
    }
    async getLogFile(id) {
        return this.logFiles.get(id);
    }
    async createLogFile(insertFile) {
        const id = randomUUID();
        const file = {
            ...insertFile,
            id,
            status: insertFile.status || "active",
            uploadedAt: new Date()
        };
        this.logFiles.set(id, file);
        return file;
    }
    async updateLogFileStatus(id, status) {
        const file = this.logFiles.get(id);
        if (file) {
            file.status = status;
            this.logFiles.set(id, file);
        }
    }
    async getFilterSettings(userId = "default") {
        return this.filterSettings.get(userId);
    }
    async createOrUpdateFilterSettings(insertSettings) {
        const userId = insertSettings.userId || "default";
        const id = randomUUID();
        const settings = {
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