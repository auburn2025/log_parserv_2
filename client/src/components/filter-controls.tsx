import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { type FilterSettings, type LogLevel } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface FilterControlsProps {
  filterSettings?: FilterSettings;
}

const LOG_LEVELS: { value: LogLevel; label: string; color: string }[] = [
  { value: "ERROR", label: "ERROR", color: "bg-red-500" },
  { value: "WARN", label: "WARN", color: "bg-amber-500" },
  { value: "INFO", label: "INFO", color: "bg-blue-500" },
  { value: "DEBUG", label: "DEBUG", color: "bg-gray-500" },
];

export function FilterControls({ filterSettings }: FilterControlsProps) {
  const [selectedLevels, setSelectedLevels] = useState<string[]>(filterSettings?.logLevels || ["ERROR", "WARN", "INFO", "DEBUG"]);
  const [keywords, setKeywords] = useState<string[]>(filterSettings?.keywords || []);
  const [newKeyword, setNewKeyword] = useState("");
  const [timeRange, setTimeRange] = useState<"all" | "1h" | "6h" | "24h" | "custom">("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize state from settings
  useEffect(() => {
    if (filterSettings) {
      setSelectedLevels(filterSettings.logLevels || ["ERROR", "WARN", "INFO", "DEBUG"]);
      setKeywords(filterSettings.keywords || []);
      const timeRangeValue = filterSettings.timeRange || "all";
      setTimeRange(timeRangeValue === "all" ? "all" : timeRangeValue.includes(':') ? "custom" : timeRangeValue as "1h" | "6h" | "24h");
      if (timeRangeValue.includes(':')) {
        const [start, end] = timeRangeValue.split(':');
        setCustomStart(start);
        setCustomEnd(end);
      }
    }
  }, [filterSettings]);

const updateFilterMutation = useMutation({
  mutationFn: async (newSettings: Partial<FilterSettings>) => {
    console.log("Sending filter settings to server:", newSettings);
    const response = await apiRequest("POST", "/api/filters", newSettings);
    return response.json();
  },
  onSuccess: (data) => {
    console.log("Filter settings updated:", data);
    queryClient.invalidateQueries({ queryKey: ["/api/filters"], refetchType: "all" });
    toast({
      title: "Success",
      description: "Filter settings updated",
    });
  },
  onError: (error) => {
    console.error("Filter update error:", error);
    toast({
      title: "Error",
      description: "Failed to update filter settings",
      variant: "destructive",
    });
  },
});
  const handleLevelToggle = (level: string, checked: boolean) => {
    const newLevels = checked 
      ? [...selectedLevels, level]
      : selectedLevels.filter(l => l !== level);
    
    setSelectedLevels(newLevels);
    updateFilterMutation.mutate({ logLevels: newLevels });
  };

  const handleAddKeyword = () => {
    const trimmedKeyword = newKeyword.trim();
    if (!trimmedKeyword || keywords.includes(trimmedKeyword) || /[.*+?^${}()|[\]\\]/.test(trimmedKeyword)) {
      toast({
        title: "Invalid Keyword",
        description: "Keyword cannot be empty or contain special characters",
        variant: "destructive",
      });
      return;
    }

    const newKeywords = [...keywords, trimmedKeyword];
    setKeywords(newKeywords);
    setNewKeyword("");
    updateFilterMutation.mutate({ keywords: newKeywords });
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    const newKeywords = keywords.filter(k => k !== keywordToRemove);
    setKeywords(newKeywords);
    updateFilterMutation.mutate({ keywords: newKeywords });
  };

  const handleTimeRangeChange = (value: "all" | "1h" | "6h" | "24h" | "custom") => {
    setTimeRange(value);
    let newTimeRange: string = value;
    if (value !== "custom") {
      const now = new Date();
      let start: Date;
      switch (value) {
        case "1h":
          start = new Date(now.getTime() - 60 * 60 * 1000);
          newTimeRange = `${start.toISOString()}:${now.toISOString()}`;
          break;
        case "6h":
          start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          newTimeRange = `${start.toISOString()}:${now.toISOString()}`;
          break;
        case "24h":
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          newTimeRange = `${start.toISOString()}:${now.toISOString()}`;
          break;
        case "all":
          newTimeRange = "all";
          break;
      }
    }
    updateFilterMutation.mutate({ timeRange: newTimeRange });
  };

  const handleCustomRangeChange = () => {
    if (customStart && customEnd) {
      updateFilterMutation.mutate({ timeRange: `${customStart}:${customEnd}` });
    }
  };

  const handleKeywordInputKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddKeyword();
    }
  };

  return (
    <div className="p-4 border-b border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Filters & Highlighting</h3>
      
      {/* Log Level Filters */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-400 mb-2 block">Log Levels</label>
        <div className="space-y-2">
          {LOG_LEVELS.map(({ value, label, color }) => (
            <div key={value} className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={selectedLevels.includes(value)}
                onCheckedChange={(checked) => handleLevelToggle(value, checked as boolean)}
                className="data-[state=checked]:bg-primary-500 data-[state=checked]:border-primary-500"
                data-testid={`checkbox-${value.toLowerCase()}`}
              />
              <span className="text-sm text-gray-300">{label}</span>
              <div className={`w-3 h-3 ${color} rounded`}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Keywords */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-400 mb-2 block">Custom Keywords</label>
        <div className="flex space-x-2 mb-2">
          <Input
            placeholder="Add keyword..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyPress={handleKeywordInputKeyPress}
            className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-primary-500"
            data-testid="keyword-input"
          />
          <Button
            onClick={handleAddKeyword}
            disabled={!newKeyword.trim() || updateFilterMutation.isPending}
            className="bg-primary-500 hover:bg-primary-600 px-3"
            data-testid="button-add-keyword"
          >
            {updateFilterMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {keywords.length > 0 && (
          <div className="space-y-1">
            {keywords.map((keyword) => (
              <Card
                key={keyword}
                className="flex items-center justify-between bg-gray-700 border-gray-600 rounded px-3 py-2"
              >
                <span className="text-sm text-gray-300" data-testid={`keyword-${keyword}`}>
                  {keyword}
                </span>
                <Button
                  onClick={() => handleRemoveKeyword(keyword)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-400 p-1"
                  data-testid={`button-remove-${keyword}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Time Range Filter */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-400 mb-2 block">Time Range</label>
        <Select value={timeRange} onValueChange={handleTimeRangeChange}>
          <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white focus:border-primary-500">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 border-gray-600">
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="6h">Last 6 Hours</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
        {timeRange === "custom" && (
          <div className="mt-2 space-y-2">
            <Input
              type="datetime-local"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              onBlur={handleCustomRangeChange}
              className="bg-gray-700 border-gray-600 text-white"
              data-testid="custom-start-date"
            />
            <Input
              type="datetime-local"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              onBlur={handleCustomRangeChange}
              className="bg-gray-700 border-gray-600 text-white"
              data-testid="custom-end-date"
            />
          </div>
        )}
      </div>
    </div>
  );
}