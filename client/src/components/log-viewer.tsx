import { useState, useEffect, useRef, useMemo } from "react";
import { FixedSizeList as List } from 'react-window';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, ArrowUpDown, Trash2, Download } from "lucide-react";
import { type LogEntry, type FilterSettings, type LogFile } from "@shared/schema";
import { formatLogLevel, highlightKeywords } from "@/lib/log-parser";

interface LogViewerProps {
  logEntries: LogEntry[];
  isLoading: boolean;
  searchQuery: string;
  autoScroll: boolean;
  filterSettings?: FilterSettings;
  currentFile: LogFile | null;
  onSearchChange: (query: string) => void;
  onAutoScrollToggle: () => void;
  onClearLogs: () => void;
  onExportLogs: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function LogViewer({
  logEntries,
  isLoading,
  searchQuery,
  autoScroll,
  filterSettings,
  currentFile,
  onSearchChange,
  onAutoScrollToggle,
  onClearLogs,
  onExportLogs,
  onLoadMore,
  hasMore,
}: LogViewerProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const lastEntryCountRef = useRef(0);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && logEntries.length > lastEntryCountRef.current) {
      const container = logContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      setIsStreaming(true);
      
      const timer = setTimeout(() => setIsStreaming(false), 3000);
      return () => clearTimeout(timer);
    }
    lastEntryCountRef.current = logEntries.length;
  }, [logEntries.length, autoScroll]);

  // Infinite scroll
  useEffect(() => {
    const container = logContainerRef.current;
    if (!container || !onLoadMore || !hasMore) return;

    const handleScroll = () => {
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
        onLoadMore();
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, hasMore]);

  // Filter and search log entries
  const filteredEntries = useMemo(() => {
    let filtered = logEntries;

    // Filter by log levels
    if (filterSettings?.logLevels && filterSettings.logLevels.length > 0) {
      filtered = filtered.filter(entry => 
        filterSettings.logLevels!.includes(entry.level)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry =>
        (entry.message?.toLowerCase().includes(query) ?? false) ||
        (entry.logger?.toLowerCase().includes(query) ?? false) ||
        (entry.stackTrace?.toLowerCase().includes(query) ?? false)
      );
    }

    // Filter by keywords
    if (filterSettings?.keywords?.length) {
      filtered = filtered.filter(entry =>
        filterSettings.keywords.some(keyword =>
          (entry.message?.toLowerCase().includes(keyword.toLowerCase()) ?? false) ||
          (entry.logger?.toLowerCase().includes(keyword.toLowerCase()) ?? false) ||
          (entry.stackTrace?.toLowerCase().includes(keyword.toLowerCase()) ?? false)
        )
      );
    }

    // Filter by timeRange
    if (filterSettings?.timeRange && filterSettings.timeRange !== 'all') {
      const [start, end] = filterSettings.timeRange.split(':');
      filtered = filtered.filter(entry => {
        const timestamp = new Date(entry.timestamp);
        return timestamp >= new Date(start) && timestamp <= new Date(end);
      });
    }

    return filtered;
  }, [logEntries, filterSettings?.logLevels, filterSettings?.keywords, filterSettings?.timeRange, searchQuery]);

  const rowRenderer = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const entry = filteredEntries[index];
    const { color, bgColor, borderColor } = formatLogLevel(entry.level as import("@shared/schema").LogLevel);
    
    const highlightedMessage = filterSettings?.keywords?.length && entry.message
      ? highlightKeywords(entry.message, filterSettings.keywords)
      : entry.message || '';
    const highlightedLogger = filterSettings?.keywords?.length && entry.logger
      ? highlightKeywords(entry.logger, filterSettings.keywords)
      : entry.logger;
    const highlightedStackTrace = filterSettings?.keywords?.length && entry.stackTrace
      ? highlightKeywords(entry.stackTrace, filterSettings.keywords)
      : entry.stackTrace;

    return (
      <div
        key={`${entry.id}-${index}`}
        style={style}
        className={`flex p-3 hover:bg-gray-800 transition-colors border-l-4 ${borderColor} ${bgColor}`}
        data-testid={`log-entry-${entry.lineNumber}`}
      >
        <div className="w-20 text-xs text-gray-500 mt-0.5 font-mono">
          {String(entry.lineNumber).padStart(6, '0')}
        </div>
        <div className="w-32 text-xs text-gray-400 mt-0.5 font-mono">
          {entry.timestamp.toISOString().slice(0, 19).replace('T', ' ')}
        </div>
        <div className={`w-16 text-xs font-semibold mt-0.5 ${color}`}>
          {entry.level}
        </div>
        <div className="flex-1 text-white font-mono text-sm">
          {highlightedLogger && (
            <span className="text-blue-400" dangerouslySetInnerHTML={{ __html: highlightedLogger }} />
          )}
          <span 
            dangerouslySetInnerHTML={{ __html: highlightedMessage }}
            data-testid={`log-message-${entry.lineNumber}`}
          />
          {highlightedStackTrace && (
            <div className="text-gray-400 text-xs mt-1 pl-4 whitespace-pre-line">
              <span dangerouslySetInnerHTML={{ __html: highlightedStackTrace }} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col" data-testid="log-viewer-container">
      {/* Header Controls */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-white">Live Log Stream</h2>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className={`text-sm ${isStreaming ? 'text-emerald-400' : 'text-gray-400'}`}>
                {isStreaming ? 'Streaming' : 'Idle'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-primary-500 w-64 pl-10"
                data-testid="input-search"
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            
            {/* Controls */}
            <Button
              onClick={onAutoScrollToggle}
              variant={autoScroll ? "default" : "secondary"}
              className={autoScroll ? "bg-primary-500 hover:bg-primary-600" : "bg-gray-700 hover:bg-gray-600"}
              data-testid="button-auto-scroll"
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              Auto-scroll
            </Button>
            
            <Button
              onClick={onClearLogs}
              variant="secondary"
              className="bg-gray-700 hover:bg-gray-600"
              disabled={!currentFile}
              data-testid="button-clear"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
            
            <Button
              onClick={onExportLogs}
              className="bg-primary-500 hover:bg-primary-600"
              disabled={!currentFile}
              data-testid="button-export"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Log Display Area */}
      <div className="flex-1 overflow-hidden" ref={logContainerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center space-x-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading logs...</span>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Card className="bg-gray-800 border-gray-700 p-6 text-center">
              <p className="text-gray-400 mb-2">No log entries to display</p>
              <p className="text-xs text-gray-500">
                {logEntries.length === 0 
                  ? "Upload a log file to get started"
                  : "Try adjusting your filters or search query"
                }
              </p>
            </Card>
          </div>
        ) : (
          <>
            <List
              width={logContainerRef.current?.clientWidth || 800}
              height={logContainerRef.current?.clientHeight || 600}
              itemCount={filteredEntries.length}
              itemSize={60}
              className="h-full overflow-y-auto bg-gray-900 text-sm"
            >
              {({ index, style }) => rowRenderer({ index, style })}
            </List>
            
            {hasMore && (
              <div className="p-4 text-center">
                <Button onClick={onLoadMore} disabled={isLoading}>
                  Load More
                </Button>
              </div>
            )}
            
            {isStreaming && (
              <div className="flex items-center justify-center p-4 border-t border-gray-800">
                <div className="flex items-center space-x-2 text-gray-400">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Processing new entries...</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Footer Status Bar */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-4">
            <span data-testid="status-total-lines">
              Lines: {logEntries.length.toLocaleString()}
            </span>
            <span data-testid="status-filtered-lines">
              Filtered: {filteredEntries.length.toLocaleString()}
            </span>
            {currentFile && (
              <span data-testid="status-file-size">
                Size: {(currentFile.fileSize / 1024 / 1024).toFixed(1)} MB
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <span data-testid="status-last-update">
              Last update: {isStreaming ? 'just now' : '---'}
            </span>
            <span>Refresh: 5s</span>
          </div>
        </div>
      </div>
    </div>
  );
}