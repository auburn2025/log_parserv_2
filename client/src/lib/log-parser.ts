import { type LogLevel } from "@shared/schema";

export interface ParsedLogEntry {
  lineNumber: number;
  timestamp: Date;
  level: LogLevel;
  logger?: string;
  message: string;
  stackTrace?: string;
}

// Regex patterns for common Tomcat log formats
const TOMCAT_PATTERNS = [
  // Формат: YYYY-MM-DD HH:mm:ss,SSS [LEVEL] [logger] message
  /^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2},\d{3})\s+(ERROR|WARN|INFO|DEBUG)\s+main\s+(.+)$/,
  // Формат: DD.MM.YY HH:mm:ss:SSS - LEVEL - LOGGER - MESSAGE
  /^(\d{2}\.\d{2}\.\d{2}\s\d{2}:\d{2}:\d{2}:\d{3})\s*-\s*(ERROR|WARN|INFO|DEBUG)\s*-\s*([\w.-]+)\s*-\s*(.+)$/,
  // Java stack trace line
  /^\s+(at\s+.+|Caused\s+by:.+|\.{3}\s+\d+\s+more|\s+.*Exception.*)$/,
];

export function parseLogLine(line: string, lineNumber: number): ParsedLogEntry {
  line = line.trim();
  
  if (!line) {
    throw new Error('Empty line');
  }

  // Try each pattern
  for (const pattern of TOMCAT_PATTERNS) {
    const match = line.match(pattern);
    
    if (match) {
      if (match.length === 4) {
        // Формат YYYY-MM-DD HH:mm:ss,SSS
        console.log(`Parsed line ${lineNumber}:`, { timestamp: match[1], level: match[2], message: match[3] });
        return {
          lineNumber,
          timestamp: new Date(match[1].replace(',', '.')),
          level: match[2].toUpperCase() as LogLevel,
          logger: 'main',
          message: match[3],
        };
      } else if (match.length === 5) {
        // Формат DD.MM.YY HH:mm:ss:SSS
        const timestampStr = `20${match[1].slice(6, 8)}-${match[1].slice(3, 5)}-${match[1].slice(0, 2)} ${match[1].slice(9)}`;
        console.log(`Parsed line ${lineNumber}:`, { timestamp: timestampStr, level: match[2], logger: match[3], message: match[4] });
        return {
          lineNumber,
          timestamp: new Date(timestampStr.replace(':', '.')),
          level: match[2].toUpperCase() as LogLevel,
          logger: match[3],
          message: match[4],
        };
      }
    }
  }

  // Check if it's a stack trace line
  const stackTraceMatch = line.match(TOMCAT_PATTERNS[2]);
  if (stackTraceMatch) {
    console.log(`Parsed stack trace line ${lineNumber}:`, line);
    return {
      lineNumber,
      timestamp: new Date(),
      level: 'DEBUG',
      message: '',
      stackTrace: line,
    };
  }

  // If no pattern matches, treat as generic INFO log
  console.warn(`Unmatched log line ${lineNumber}: ${line}`);
  return {
    lineNumber,
    timestamp: new Date(),
    level: 'INFO',
    message: line,
  };
}

export function highlightKeywords(text: string, keywords: string[]): string {
  if (!keywords.length || !text) return text;
  
  const regex = new RegExp(
    keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'gi'
  );
  return text.replace(regex, '<mark class="bg-purple-500 text-white px-1 rounded">$&</mark>');
}

export function formatLogLevel(level: LogLevel): { color: string; bgColor: string; borderColor: string } {
  switch (level) {
    case 'ERROR':
      return { color: 'text-red-400', bgColor: 'bg-red-900/20', borderColor: 'border-red-500' };
    case 'WARN':
      return { color: 'text-amber-400', bgColor: 'bg-amber-900/20', borderColor: 'border-amber-500' };
    case 'INFO':
      return { color: 'text-blue-400', bgColor: '', borderColor: 'border-transparent' };
    case 'DEBUG':
      return { color: 'text-gray-400', bgColor: '', borderColor: 'border-transparent' };
    default:
      return { color: 'text-gray-400', bgColor: '', borderColor: 'border-transparent' };
  }
}