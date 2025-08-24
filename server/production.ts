import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';
import { storage } from './storage.js';
import { parseLogLine } from '../client/src/lib/log-parser.js';
import { type ParsedLogEntry } from '../client/src/lib/log-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from React build
const clientPath = path.join(__dirname, '..', 'dist', 'public');
app.use(express.static(clientPath));

// Serve assets explicitly
const assetsPath = path.join(clientPath, 'assets');
app.use('/assets', express.static(assetsPath));

// Create uploads directory if not exists
const uploadsPath = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Setup WebSocket
const httpServer = createServer(app);
const wss = new WebSocketServer({
  server: httpServer,
  path: '/ws/logs',
});

// WebSocket connection handling
interface ExtendedWS extends WebSocket {
  subscribedFile?: string;
}

wss.on('connection', (ws: ExtendedWS) => {
  console.log('🔌 WebSocket client connected');

  ws.on('message', (message: WebSocket.RawData) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'subscribe' && data.fileName) {
        ws.subscribedFile = data.fileName;
        console.log(`📡 Client subscribed to file: ${data.fileName}`);
        ws.send(JSON.stringify({ type: 'subscribed', fileName: data.fileName }));
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
  });

  ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
});

// Broadcast function for WebSocket
const broadcast = (fileName: string, logEntry: any) => {
  wss.clients.forEach((client) => {
    const extendedClient = client as ExtendedWS;
    if (extendedClient.subscribedFile === fileName) {
      extendedClient.send(JSON.stringify({ type: 'logEntry', data: logEntry }));
    }
  });
};

// File upload with detailed logging
const upload = multer({ dest: 'uploads/' });
app.post('/api/upload', upload.single('logFile'), async (req, res) => {
  console.log('📁 File upload started');
  
  try {
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    console.log(`📄 Processing file: ${fileName} (${fileSize} bytes)`);

    // Create log file record
    const logFile = await storage.createLogFile({
      fileName,
      fileSize,
      status: 'processing',
    });

    console.log(`📊 Created log file record: ${logFile.id}`);

    // Parse the uploaded file
    const filePath = req.file.path;
    console.log(`📖 Reading file from: ${filePath}`);

    const fileBuffer = fs.readFileSync(filePath);

    // Detect encoding
    const detected = jschardet.detect(fileBuffer);
    const encoding = detected.encoding || 'utf-8';
    console.log(`🔍 Detected encoding: ${encoding} (confidence: ${detected.confidence})`);

    // Convert to UTF-8
    let fileContent: string;
    if (encoding.toLowerCase().includes('windows-1251') || encoding.toLowerCase().includes('cp1251')) {
      fileContent = iconv.decode(fileBuffer, 'win1251');
    } else if (encoding.toLowerCase().includes('cp866') || encoding.toLowerCase().includes('ibm866')) {
      fileContent = iconv.decode(fileBuffer, 'cp866');
    } else if (encoding.toLowerCase().includes('koi8')) {
      fileContent = iconv.decode(fileBuffer, 'koi8-r');
    } else {
      fileContent = iconv.decode(fileBuffer, 'utf8');
    }

    const lines = fileContent.split('\n');
    console.log(`📝 Total lines in file: ${lines.length}`);

    let lineNumber = 1;
    let processedCount = 0;
    let errorCount = 0;
    let lastEntry: ParsedLogEntry | null = null;

    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = parseLogLine(line, lineNumber);
          if (parsed.stackTrace) {
            if (lastEntry) {
              lastEntry.stackTrace = (lastEntry.stackTrace || '') + '\n' + parsed.stackTrace;
              await storage.updateLogEntry(lastEntry);
              broadcast(logFile.id, lastEntry);
            }
          } else {
            lastEntry = await storage.createLogEntry({
              ...parsed,
              fileName: logFile.id,
              timestamp: new Date(parsed.timestamp).toISOString(),
            });
            broadcast(logFile.id, lastEntry);
          }
          processedCount++;

          // Log progress every 100 lines
          if (processedCount % 100 === 0) {
            console.log(`⏳ Processed ${processedCount} lines...`);
          }
        } catch (parseError) {
          errorCount++;
          if (errorCount <= 10) {
            console.warn(`⚠️ Failed to parse line ${lineNumber}: ${line.substring(0, 100)}...`);
          }
        }
        lineNumber++;
      }
    }

    // Update file status
    await storage.updateLogFileStatus(logFile.id, 'active');

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    console.log(`✅ File processing completed: ${processedCount} lines processed, ${errorCount} errors`);

    res.json({
      message: 'File uploaded and processed successfully',
      fileId: logFile.id,
      fileName: logFile.fileName,
      linesProcessed: processedCount,
      errors: errorCount,
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// Basic API routes with logging
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check');
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/api/files', async (req, res) => {
  console.log('📋 Fetching files list');
  try {
    const files = await storage.getLogFiles();
    console.log(`📁 Found ${files.length} files`);
    res.json(files);
  } catch (error) {
    console.error('❌ Failed to fetch files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.get('/api/logs/:fileId', async (req, res) => {
  const { fileId } = req.params;
  console.log(`📊 Fetching logs for file: ${fileId}`);
  
  try {
    const { limit = '1000', offset = '0' } = req.query;
    const entries = await storage.getLogEntries(
      fileId,
      parseInt(limit as string, 10) || Infinity,
      parseInt(offset as string, 10) || 0,
    );
    console.log(`📄 Retrieved ${entries.length} log entries for file ${fileId}`);
    res.json(entries);
  } catch (error) {
    console.error(`❌ Failed to fetch logs for file ${fileId}:`, error);
    res.status(500).json({ error: 'Failed to fetch log entries' });
  }
});

// Get filter settings
app.get('/api/filters', async (req, res) => {
  console.log('⚙️ Fetching filter settings');
  try {
    const settings = await storage.getFilterSettings();
    res.json(
      settings || {
        logLevels: ["ERROR", "WARN", "INFO", "DEBUG"],
        keywords: [],
        timeRange: "all",
        autoScroll: true,
      }
    );
  } catch (error) {
    console.error('❌ Failed to fetch filter settings:', error);
    res.status(500).json({ error: "Failed to fetch filter settings" });
  }
});

// Update filter settings
app.post('/api/filters', async (req, res) => {
  console.log('💾 Updating filter settings');
  try {
    const settings = await storage.createOrUpdateFilterSettings(req.body);
    res.json(settings);
  } catch (error) {
    console.error('❌ Failed to update filter settings:', error);
    res.status(500).json({ error: "Failed to update filter settings" });
  }
});

// Get log statistics
app.get('/api/stats/:fileId', async (req, res) => {
  const { fileId } = req.params;
  console.log(`📊 Fetching statistics for file: ${fileId}`);
  
  try {
    const stats = await storage.getLogStatistics(fileId);
    res.json(stats);
  } catch (error) {
    console.error(`❌ Failed to fetch statistics for file ${fileId}:`, error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// Clear log entries
app.delete('/api/logs/:fileId', async (req, res) => {
  const { fileId } = req.params;
  console.log(`🧹 Clearing logs for file: ${fileId}`);
  
  try {
    await storage.clearLogEntries(fileId);
    res.json({ message: "Log entries cleared successfully" });
  } catch (error) {
    console.error(`❌ Failed to clear logs for file ${fileId}:`, error);
    res.status(500).json({ error: "Failed to clear log entries" });
  }
});

// Export logs
app.get('/api/export/:fileId', async (req, res) => {
  const { fileId } = req.params;
  console.log(`📤 Exporting logs for file: ${fileId}`);
  
  try {
    const entries = await storage.getLogEntries(fileId, Infinity);
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
  } catch (error) {
    console.error(`❌ Failed to export logs for file ${fileId}:`, error);
    res.status(500).json({ error: "Failed to export logs" });
  }
});

// Handle SPA routing
app.get('*', (req, res) => {
  console.log(`🌐 SPA route: ${req.path}`);
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Start server with detailed logging
httpServer.listen(port, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log(`✅ Log Monitor production server running on port ${port}`);
  console.log(`📁 Serving static files from: ${clientPath}`);
  console.log(`📁 Assets directory: ${assetsPath}`);
  console.log(`📁 Uploads directory: ${uploadsPath}`);
  console.log(`🔌 WebSocket available at: /ws/logs`);
  console.log('='.repeat(50));
});

// Error handling
app.use((error: any, req: any, res: any, next: any) => {
  console.error('❌ Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});