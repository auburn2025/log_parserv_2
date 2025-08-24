import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { LogViewer } from "../log-viewer";
import { FilterControls } from "../filter-controls";
import { apiRequest } from "../lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LogMonitor() {
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [allLogEntries, setAllLogEntries] = useState<any[]>([]);
  const limit = 1000; // Количество записей за один запрос
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: filterSettings } = useQuery({
    queryKey: ["/api/filters"],
    queryFn: () => apiRequest("GET", "/api/filters").then(res => res.json()),
  });

  const { data: logFiles } = useQuery({
    queryKey: ["/api/files"],
    queryFn: () => apiRequest("GET", "/api/files").then(res => res.json()),
  });

  const { data: logEntries, isLoading } = useQuery({
    queryKey: ["/api/logs", currentFileId, offset],
    queryFn: () =>
      currentFileId
        ? apiRequest("GET", `/api/logs/${currentFileId}?limit=${limit}&offset=${offset}`).then(res => res.json())
        : Promise.resolve([]),
    enabled: !!currentFileId,
    onSuccess: (data) => {
      setAllLogEntries((prev) => {
        const newEntries = offset === 0 ? data : [...prev, ...data];
        const uniqueEntries = Array.from(new Map(newEntries.map(entry => [entry.id, entry])).values());
        console.log(`Loaded ${data.length} entries, total: ${uniqueEntries.length}, offset: ${offset}`);
        return uniqueEntries;
      });
    },
  });

  const totalEntries = logFiles?.find(file => file.id === currentFileId)?.linesProcessed || 0;
  const hasMore = allLogEntries.length < totalEntries;

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      setOffset((prev) => prev + limit);
    }
  };

  const { mutate: uploadFile } = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/upload", formData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setCurrentFileId(data.fileId);
      setOffset(0);
      setAllLogEntries([]);
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  const { mutate: deleteFile } = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest("DELETE", `/api/files/${fileId}`);
    },
    onSuccess: (_data, fileId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      if (currentFileId === fileId) {
        setCurrentFileId(null);
        setAllLogEntries([]);
        setOffset(0);
      }
      toast({
        title: "Success",
        description: "Log file deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete log file",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append("logFile", file);
      uploadFile(formData);
    }
  };

  const handleClearLogs = () => {
    if (currentFileId) {
      apiRequest("DELETE", `/api/logs/${currentFileId}`).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/logs", currentFileId] });
        setAllLogEntries([]);
        setOffset(0);
        toast({
          title: "Success",
          description: "Logs cleared successfully",
        });
      });
    }
  };

  const handleExportLogs = () => {
    if (currentFileId) {
      window.location.href = `/api/export/${currentFileId}`;
    }
  };

  const handleDeleteFile = (fileId: string) => {
    deleteFile(fileId);
  };

  useWebSocket({
    url: "/ws/logs",
    onMessage: (data) => {
      if (data.type === "logEntry" && data.data.fileName === currentFileId) {
        queryClient.setQueryData(["/api/logs", currentFileId, offset], (oldData: any[] | undefined) => {
          const newData = oldData ? [...oldData, data.data] : [data.data];
          setAllLogEntries((prev) => {
            const updated = [...prev, data.data];
            const uniqueEntries = Array.from(new Map(updated.map(entry => [entry.id, entry])).values());
            console.log(`WebSocket added entry, total: ${uniqueEntries.length}`);
            return uniqueEntries;
          });
          return newData;
        });
      }
    },
  });

  return (
    <div className="flex h-screen w-full">
      <div className="w-80 p-4">
        <FilterControls filterSettings={filterSettings} />
      </div>
      <div className="flex-1 p-4 w-full">
        <div className="mb-4 flex items-center space-x-4">
          <Select value={currentFileId ?? undefined} onValueChange={setCurrentFileId}>
            <SelectTrigger className="w-[200px] bg-gray-700 border-gray-600 text-white">
              <SelectValue placeholder="Select a log file" />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600">
              {logFiles?.map((file) => (
                <div key={file.id} className="flex items-center justify-between px-2 py-1">
                  <SelectItem value={file.id} className="flex-1">
                    {file.fileName}
                  </SelectItem>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs ${file.status === 'active' ? 'text-green-400' : 'text-gray-400'}`}>
                      {file.status}
                    </span>
                    <button
                      className="text-red-400 hover:text-red-600 p-1"
                      onClick={() => handleDeleteFile(file.id)}
                      data-testid={`delete-file-${file.id}`}
                      title="Delete log file"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Log
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
            data-testid="file-upload-input"
          />
        </div>
        <LogViewer
          logEntries={allLogEntries}
          isLoading={isLoading}
          searchQuery={searchQuery}
          autoScroll={autoScroll}
          filterSettings={filterSettings}
          currentFile={logFiles?.find(file => file.id === currentFileId)}
          onSearchChange={setSearchQuery}
          onAutoScrollToggle={() => setAutoScroll(!autoScroll)}
          onClearLogs={handleClearLogs}
          onExportLogs={handleExportLogs}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
        />
      </div>
    </div>
  );
}