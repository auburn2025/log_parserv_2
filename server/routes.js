import { createServer } from "http";
import { WebSocketServer } from "ws";
import multer from "multer";
import fs from "fs";
import iconv from "iconv-lite";
import jschardet from "jschardet";
import { storage } from "./storage";
import { insertFilterSettingsSchema, } from "@shared/schema";
import { parseLogLine } from "../client/src/lib/log-parser";
const upload = multer({ dest: "uploads/" });
export async function registerRoutes(app) {
    const httpServer = createServer(app);
    const wss = new WebSocketServer({
        server: httpServer,
        path: "/ws/logs",
    });
    // WebSocket connection handling
    wss.on("connection", (ws) => {
        console.log("Client connected");
        ws.on("message", (message) => {
            const data = JSON.parse(message.toString());
            if (data.type === "subscribe" && data.fileName) {
                // Store the subscription for this client
                ws.subscribedFile = data.fileName;
                ws.send(JSON.stringify({ type: "subscribed", fileName: data.fileName }));
            }
        });
        ws.on("close", () => {
            console.log("Client disconnected");
        });
        // Send initial connection status
        ws.send(JSON.stringify({ type: "status", status: "connected" }));
    });
    // Broadcast new log entries to subscribed clients
    const broadcast = (fileName, logEntry) => {
        wss.clients.forEach((client) => {
            if (client.subscribedFile === fileName) {
                client.send(JSON.stringify({ type: "logEntry", data: logEntry }));
            }
        });
    };
    // File upload endpoint
    app.post("/api/upload", upload.single("logFile"), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }
            const fileName = req.file.originalname;
            const fileSize = req.file.size;
            // Create log file record
            const logFile = await storage.createLogFile({
                fileName,
                fileSize,
                status: "processing",
            });
            // Parse the uploaded file
            const filePath = req.file.path;
            const fileBuffer = fs.readFileSync(filePath);
            // Detect encoding
            const detected = jschardet.detect(fileBuffer);
            const encoding = detected.encoding || "utf-8";
            console.log(`Detected encoding: ${encoding} (confidence: ${detected.confidence})`);
            // Convert to UTF-8 if needed
            let fileContent;
            if (encoding.toLowerCase().includes("windows-1251") ||
                encoding.toLowerCase().includes("cp1251")) {
                fileContent = iconv.decode(fileBuffer, "win1251");
            }
            else if (encoding.toLowerCase().includes("cp866") ||
                encoding.toLowerCase().includes("ibm866")) {
                fileContent = iconv.decode(fileBuffer, "cp866");
            }
            else if (encoding.toLowerCase().includes("koi8")) {
                fileContent = iconv.decode(fileBuffer, "koi8-r");
            }
            else {
                // Default to UTF-8
                fileContent = iconv.decode(fileBuffer, "utf8");
            }
            const lines = fileContent.split("\n");
            let lineNumber = 1;
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const parsed = parseLogLine(line, lineNumber);
                        const logEntry = await storage.createLogEntry({
                            ...parsed,
                            fileName: logFile.id,
                        });
                        // Broadcast to connected clients
                        broadcast(logFile.id, logEntry);
                    }
                    catch (parseError) {
                        console.warn(`Failed to parse line ${lineNumber}: ${line}`);
                    }
                    lineNumber++;
                }
            }
            // Update file status
            await storage.updateLogFileStatus(logFile.id, "active");
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            res.json({
                message: "File uploaded and processed successfully",
                fileId: logFile.id,
                fileName: logFile.fileName,
                linesProcessed: lineNumber - 1,
            });
        }
        catch (error) {
            console.error("Upload error:", error);
            res.status(500).json({ error: "Failed to process file" });
        }
    });
    // Get log files
    app.get("/api/files", async (req, res) => {
        try {
            const files = await storage.getLogFiles();
            res.json(files);
        }
        catch (error) {
            res.status(500).json({ error: "Failed to fetch files" });
        }
    });
    // Get log entries
    app.get("/api/logs/:fileId", async (req, res) => {
        try {
            const { fileId } = req.params;
            const { limit = 1000, offset = 0 } = req.query;
            const entries = await storage.getLogEntries(fileId, parseInt(limit), parseInt(offset));
            res.json(entries);
        }
        catch (error) {
            res.status(500).json({ error: "Failed to fetch log entries" });
        }
    });
    // Clear log entries
    app.delete("/api/logs/:fileId", async (req, res) => {
        try {
            const { fileId } = req.params;
            await storage.clearLogEntries(fileId);
            res.json({ message: "Log entries cleared successfully" });
        }
        catch (error) {
            res.status(500).json({ error: "Failed to clear log entries" });
        }
    });
    // Get log statistics
    app.get("/api/stats/:fileId", async (req, res) => {
        try {
            const { fileId } = req.params;
            const stats = await storage.getLogStatistics(fileId);
            res.json(stats);
        }
        catch (error) {
            res.status(500).json({ error: "Failed to fetch statistics" });
        }
    });
    // Get filter settings
    app.get("/api/filters", async (req, res) => {
        try {
            const settings = await storage.getFilterSettings();
            res.json(settings || {
                logLevels: ["ERROR", "WARN", "INFO", "DEBUG"],
                keywords: [],
                timeRange: "all",
                autoScroll: true,
            });
        }
        catch (error) {
            res.status(500).json({ error: "Failed to fetch filter settings" });
        }
    });
    // Update filter settings
    app.post("/api/filters", async (req, res) => {
        try {
            const validatedData = insertFilterSettingsSchema.parse(req.body);
            const settings = await storage.createOrUpdateFilterSettings(validatedData);
            res.json(settings);
        }
        catch (error) {
            res.status(500).json({ error: "Failed to update filter settings" });
        }
    });
    // Export logs
    app.get("/api/export/:fileId", async (req, res) => {
        try {
            const { fileId } = req.params;
            const entries = await storage.getLogEntries(fileId, 10000); // Export up to 10k entries
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
            res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
            res.send(content);
        }
        catch (error) {
            res.status(500).json({ error: "Failed to export logs" });
        }
    });
    return httpServer;
}
