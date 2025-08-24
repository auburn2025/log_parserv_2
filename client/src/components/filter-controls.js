import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
const LOG_LEVELS = [
    { value: "ERROR", label: "ERROR", color: "bg-red-500" },
    { value: "WARN", label: "WARN", color: "bg-amber-500" },
    { value: "INFO", label: "INFO", color: "bg-blue-500" },
    { value: "DEBUG", label: "DEBUG", color: "bg-gray-500" },
];
export function FilterControls({ filterSettings }) {
    const [selectedLevels, setSelectedLevels] = useState(filterSettings?.logLevels || ["ERROR", "WARN", "INFO", "DEBUG"]);
    const [keywords, setKeywords] = useState(filterSettings?.keywords || []);
    const [newKeyword, setNewKeyword] = useState("");
    const [timeRange, setTimeRange] = useState("all");
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
            setTimeRange(timeRangeValue === "all" ? "all" : timeRangeValue.includes(':') ? "custom" : timeRangeValue);
            if (timeRangeValue.includes(':')) {
                const [start, end] = timeRangeValue.split(':');
                setCustomStart(start);
                setCustomEnd(end);
            }
        }
    }, [filterSettings]);
    const updateFilterMutation = useMutation({
        mutationFn: async (newSettings) => {
            const response = await apiRequest("POST", "/api/filters", newSettings);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/filters"] });
            toast({
                title: "Success",
                description: "Filter settings updated",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to update filter settings",
                variant: "destructive",
            });
        },
    });
    const handleLevelToggle = (level, checked) => {
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
    const handleRemoveKeyword = (keywordToRemove) => {
        const newKeywords = keywords.filter(k => k !== keywordToRemove);
        setKeywords(newKeywords);
        updateFilterMutation.mutate({ keywords: newKeywords });
    };
    const handleTimeRangeChange = (value) => {
        setTimeRange(value);
        let newTimeRange = value;
        if (value !== "custom") {
            const now = new Date();
            let start;
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
    const handleKeywordInputKeyPress = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddKeyword();
        }
    };
    return (_jsxs("div", { className: "p-4 border-b border-gray-700", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300 mb-3", children: "Filters & Highlighting" }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "text-xs font-medium text-gray-400 mb-2 block", children: "Log Levels" }), _jsx("div", { className: "space-y-2", children: LOG_LEVELS.map(({ value, label, color }) => (_jsxs("div", { className: "flex items-center space-x-2 cursor-pointer", children: [_jsx(Checkbox, { checked: selectedLevels.includes(value), onCheckedChange: (checked) => handleLevelToggle(value, checked), className: "data-[state=checked]:bg-primary-500 data-[state=checked]:border-primary-500", "data-testid": `checkbox-${value.toLowerCase()}` }), _jsx("span", { className: "text-sm text-gray-300", children: label }), _jsx("div", { className: `w-3 h-3 ${color} rounded` })] }, value))) })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "text-xs font-medium text-gray-400 mb-2 block", children: "Custom Keywords" }), _jsxs("div", { className: "flex space-x-2 mb-2", children: [_jsx(Input, { placeholder: "Add keyword...", value: newKeyword, onChange: (e) => setNewKeyword(e.target.value), onKeyPress: handleKeywordInputKeyPress, className: "flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-primary-500", "data-testid": "keyword-input" }), _jsx(Button, { onClick: handleAddKeyword, disabled: !newKeyword.trim() || updateFilterMutation.isPending, className: "bg-primary-500 hover:bg-primary-600 px-3", "data-testid": "button-add-keyword", children: updateFilterMutation.isPending ? (_jsx("div", { className: "w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" })) : (_jsx(Plus, { className: "w-4 h-4" })) })] }), keywords.length > 0 && (_jsx("div", { className: "space-y-1", children: keywords.map((keyword) => (_jsxs(Card, { className: "flex items-center justify-between bg-gray-700 border-gray-600 rounded px-3 py-2", children: [_jsx("span", { className: "text-sm text-gray-300", "data-testid": `keyword-${keyword}`, children: keyword }), _jsx(Button, { onClick: () => handleRemoveKeyword(keyword), variant: "ghost", size: "sm", className: "text-gray-400 hover:text-red-400 p-1", "data-testid": `button-remove-${keyword}`, children: _jsx(X, { className: "w-3 h-3" }) })] }, keyword))) }))] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "text-xs font-medium text-gray-400 mb-2 block", children: "Time Range" }), _jsxs(Select, { value: timeRange, onValueChange: handleTimeRangeChange, children: [_jsx(SelectTrigger, { className: "w-full bg-gray-700 border-gray-600 text-white focus:border-primary-500", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { className: "bg-gray-700 border-gray-600", children: [_jsx(SelectItem, { value: "all", children: "All Time" }), _jsx(SelectItem, { value: "1h", children: "Last Hour" }), _jsx(SelectItem, { value: "6h", children: "Last 6 Hours" }), _jsx(SelectItem, { value: "24h", children: "Last 24 Hours" }), _jsx(SelectItem, { value: "custom", children: "Custom Range" })] })] }), timeRange === "custom" && (_jsxs("div", { className: "mt-2 space-y-2", children: [_jsx(Input, { type: "datetime-local", value: customStart, onChange: (e) => setCustomStart(e.target.value), onBlur: handleCustomRangeChange, className: "bg-gray-700 border-gray-600 text-white", "data-testid": "custom-start-date" }), _jsx(Input, { type: "datetime-local", value: customEnd, onChange: (e) => setCustomEnd(e.target.value), onBlur: handleCustomRangeChange, className: "bg-gray-700 border-gray-600 text-white", "data-testid": "custom-end-date" })] }))] })] }));
}
