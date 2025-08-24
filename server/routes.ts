import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import multer from "multer";
import fs from "fs";
import path from "path";
import iconv from "iconv-lite";
import jschardet from "jschardet";
import { storage } from "./storage";
import {
  insertLogEntrySchema,
  insertLogFileSchema,
  insertFilterSettingsSchema,
} from "@shared/schema";
import { parseLogLine } from "../client/src/lib/log-parser";

const upload = multer({ dest: "uploads/" });

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws/logs",
  });

  wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (message) => {
      const data = JSON.parse(message.toString());

      if (data.type === "subscribe" && data.fileName) {
        (ws as any).subscribedFile = data.fileName;
        ws.send(
          JSON.stringify({ type: "subscribed", fileName: data.fileName }),
        );
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });

    ws.send(JSON.stringify({ type: "status", status: "connected" }));
  });

  const broadcast = (fileName: string, logEntry: any) => {
    console.log("Broadcasting log entry:", { fileName, logEntry });
    wss.clients.forEach((client) => {
      if ((client as any).subscribedFile === fileName) {
        client.send(JSON.stringify({ type: "logEntry", data: logEntry }));
      }
    });
  };

  app.post("/api/upload", upload.single("logFile"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileName = req.file.originalname;
      const fileSize = req.file.size;

      const logFile = await storage.createLogFile({
        fileName,
        fileSize,
        status: "processing",
      });

      const filePath = req.file.path;
      const fileBuffer = fs.readFileSync(filePath);

      const detected = jschardet.detect(fileBuffer);
      const encoding = detected.encoding || "utf-8";
      console.log(`Detected encoding: ${encoding} (confidence: ${detected.confidence})`);

      let fileContent: string;
      if (encoding.toLowerCase().includes("windows-1251") || encoding.toLowerCase().includes("cp1251")) {
        fileContent = iconv.decode(fileBuffer, "win1251");
      } else if (encoding.toLowerCase().includes("cp866") || encoding.toLowerCase().includes("ibm866")) {
        fileContent = iconv.decode(fileBuffer, "cp866");
      } else if (encoding.toLowerCase().includes("koi8")) {
        fileContent = iconv.decode(fileBuffer, "koi8-r");
      } else {
        fileContent = iconv.decode(fileBuffer, "utf8");
      }

      const lines = fileContent.split("\n");
      console.log(`📝 Total lines in file: ${lines.length}`);
      let lineNumber = 1;
      let errorCount = 0;

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = parseLogLine(line, lineNumber);
            const logEntry = await storage.createLogEntry({
              ...parsed,
              fileName: logFile.id,
            });
            broadcast(logFile.id, logEntry);
          } catch (parseError) {
            console.warn(`⚠ Failed to parse line ${lineNumber}: ${line} - Error: ${parseError.message}`);
            errorCount++;
            const logEntry = await storage.createLogEntry({
              lineNumber,
              timestamp: new Date(),
              level: 'INFO',
              message: line,
              fileName: logFile.id,
            });
            broadcast(logFile.id, logEntry);
          }
          lineNumber++;
        }
      }

      await storage.updateLogFileStatus(logFile.id, "active");
      fs.unlinkSync(filePath);

      console.log(`✅ File processing completed: ${lineNumber - 1} lines processed, ${errorCount} errors`);
      res.json({
        message: "File uploaded and processed successfully",
        fileId: logFile.id,
        fileName: logFile.fileName,
        linesProcessed: lineNumber - 1,
        errors: errorCount,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process file" });
    }
  });

  app.get("/api/files", async (req, res) => {
    try {
      const files = await storage.getLogFiles();
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.delete("/api/files/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      await storage.deleteLogFile(fileId);
      console.log(`Deleted file: ${fileId}`);
      res.json({ message: "Log file deleted successfully" });
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({ error: "Failed to delete log file" });
    }
  });

  app.get("/api/logs/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const { limit = 1000, offset = 0 } = req.query;

      const parsedLimit = parseInt(limit as string) || 1000;
      const parsedOffset = parseInt(offset as string) || 0;

      const entries = await storage.getLogEntries(
        fileId,
        parsedLimit,
        parsedOffset,
      );

      console.log(`Log entries sent to client: ${entries.length} entries, offset: ${parsedOffset}, limit: ${parsedLimit}`);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching log entries:", error);
      res.status(500).json({ error: "Failed to fetch log entries" });
    }
  });

  app.delete("/api/logs/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      await storage.clearLogEntries(fileId);
      res.json({ message: "Log entries cleared successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear log entries" });
    }
  });

  app.get("/api/stats/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const stats = await storage.getLogStatistics(fileId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  app.get("/api/filters", async (req, res) => {
    try {
      const settings = await storage.getFilterSettings();
      res.json(
        settings || {
          logLevels: ["ERROR", "WARN", "INFO", "DEBUG"],
          keywords: [],
          timeRange: "all",
          autoScroll: true,
        },
      );
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch filter settings" });
    }
  });

  app.post("/api/filters", async (req, res) => {
    try {
      console.log("Received filter settings:", req.body);
      const validatedData = insertFilterSettingsSchema.parse(req.body);
      const settings = await storage.createOrUpdateFilterSettings(validatedData);
      console.log("Filter settings updated:", settings);
      res.json(settings);
    } catch (error) {
      console.error("Filter update error:", error);
      res.status(500).json({ error: "Failed to update filter settings" });
    }
  });

  app.get("/api/export/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const entries = await storage.getLogEntries(fileId, 10000);

      const logFile = await storage.getLogFile(fileId);
      const fileName = logFile?.fileName || "export.log";

      let content = "";
      entries.forEach((entry) => {
        content += `${entry.timestamp} ${entry.level} ${entry.logger || ""} ${entry.message}\n`;
        if (entry.stackTrace) {
          content += `${entry.stackTrace}\n`;
        }
      });

      res.setHeader("Content-Type", "text/plain");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.send(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to export logs" });
    }
  });

  return httpServer;
}
