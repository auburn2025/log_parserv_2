import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogWebSocket } from "@/lib/websocket";
import { Sidebar } from "@/components/sidebar";
import { LogViewer } from "@/components/log-viewer";
import { useToast } from "@/hooks/use-toast";
export default function LogMonitor() {
    const [serverStatus, setServerStatus] = useState('disconnected');
    const [logEntries, setLogEntries] = useState([]);
    const [currentFile, setCurrentFile] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const [wsConnection, setWsConnection] = useState(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    // Fetch files
    const { data: files = [] } = useQuery({
        queryKey: ['/api/files'],
    });
    // Fetch filter settings
    const { data: filterSettings } = useQuery({
        queryKey: ['/api/filters'],
    });
    // Log filterSettings for debugging
    useEffect(() => {
        console.log('Filter settings:', filterSettings);
    }, [filterSettings]);
    // Fetch log entries for current file with pagination
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
        queryKey: ['/api/logs', currentFile?.id],
        queryFn: async ({ pageParam = 0 }) => {
            if (!currentFile?.id)
                return { entries: [], nextOffset: null };
            const response = await fetch(`/api/logs/${currentFile.id}?limit=1000&offset=${pageParam}`);
            if (!response.ok)
                throw new Error('Failed to fetch logs');
            const entries = await response.json();
            return { entries, nextOffset: entries.length === 1000 ? pageParam + 1000 : null };
        },
        getNextPageParam: (lastPage) => lastPage.nextOffset,
        enabled: !!currentFile?.id,
        onError: (err) => {
            toast({
                title: "Error",
                description: "Failed to load logs",
                variant: "destructive",
            });
        },
    });
    // Update log entries from paginated data
    useEffect(() => {
        if (data) {
            setLogEntries(data.pages.flatMap(page => page.entries).slice(-10000));
        }
    }, [data]);
    // WebSocket handlers
    const handleLogEntry = useCallback((entry) => {
        setLogEntries(prev => [...prev, entry].slice(-10000));
        if (currentFile?.id) {
            queryClient.invalidateQueries({ queryKey: ['/api/stats', currentFile.id] });
        }
    }, [currentFile?.id, queryClient]);
    const handleStatusChange = useCallback((status) => {
        setServerStatus(status);
        if (status === 'connected') {
            toast({
                title: "Connected",
                description: "Real-time log monitoring is active",
            });
        }
        else if (status === 'disconnected') {
            toast({
                title: "Disconnected",
                description: "Connection to server lost",
                variant: "destructive",
            });
        }
    }, [toast]);
    const handleError = useCallback((error) => {
        toast({
            title: "Connection Error",
            description: error,
            variant: "destructive",
        });
    }, [toast]);
    // Initialize WebSocket connection
    useEffect(() => {
        const ws = new LogWebSocket(handleLogEntry, handleStatusChange, handleError);
        ws.connect();
        setWsConnection(ws);
        return () => {
            ws.disconnect();
        };
    }, [handleLogEntry, handleStatusChange, handleError]);
    // Subscribe to current file when it changes
    useEffect(() => {
        if (wsConnection && currentFile?.id) {
            wsConnection.subscribeToFile(currentFile.id);
        }
    }, [wsConnection, currentFile?.id]);
    // Auto-select first file if available
    useEffect(() => {
        if (!currentFile && files.length > 0) {
            setCurrentFile(files[0]);
        }
    }, [files, currentFile]);
    const handleFileUpload = useCallback((file) => {
        setCurrentFile(file);
        setLogEntries([]);
        queryClient.invalidateQueries({ queryKey: ['/api/files'] });
        toast({
            title: "File Uploaded",
            description: `${file.fileName} has been processed successfully`,
        });
    }, [queryClient, toast]);
    const handleClearLogs = useCallback(async () => {
        if (!currentFile?.id)
            return;
        try {
            const response = await fetch(`/api/logs/${currentFile.id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                setLogEntries([]);
                queryClient.invalidateQueries({ queryKey: ['/api/logs', currentFile.id] });
                queryClient.invalidateQueries({ queryKey: ['/api/stats', currentFile.id] });
                toast({
                    title: "Logs Cleared",
                    description: "All log entries have been cleared",
                });
            }
        }
        catch (error) {
            toast({
                title: "Error",
                description: "Failed to clear logs",
                variant: "destructive",
            });
        }
    }, [currentFile?.id, queryClient, toast]);
    const handleExportLogs = useCallback(() => {
        if (!currentFile?.id)
            return;
        const url = `/api/export/${currentFile.id}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = currentFile.fileName;
        link.click();
    }, [currentFile]);
    return (_jsxs("div", { className: "flex h-screen bg-gray-900 text-gray-100", "data-testid": "log-monitor-app", children: [_jsx(Sidebar, { serverStatus: serverStatus, files: files, currentFile: currentFile, filterSettings: filterSettings || { logLevels: [], keywords: [], timeRange: 'all', autoScroll: true }, onFileSelect: setCurrentFile, onFileUpload: handleFileUpload, "data-testid": "sidebar" }), _jsx(LogViewer, { logEntries: logEntries, isLoading: isLoading || isFetchingNextPage, searchQuery: searchQuery, autoScroll: autoScroll, filterSettings: filterSettings, currentFile: currentFile, onSearchChange: setSearchQuery, onAutoScrollToggle: () => setAutoScroll(!autoScroll), onClearLogs: handleClearLogs, onExportLogs: handleExportLogs, onLoadMore: fetchNextPage, hasMore: hasNextPage, "data-testid": "log-viewer" })] }));
}
