import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FilterControls } from "@/components/filter-controls";
import { LogStatistics } from "@/components/log-statistics";
import { useToast } from "@/hooks/use-toast";
export function Sidebar({ serverStatus, files, currentFile, filterSettings, onFileSelect, onFileUpload }) {
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('logFile', file);
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                const result = await response.json();
                // Create a LogFile object from the response
                const uploadedFile = {
                    id: result.fileId,
                    fileName: result.fileName,
                    fileSize: file.size,
                    status: 'active',
                    uploadedAt: new Date(),
                };
                onFileUpload(uploadedFile);
            }
            else {
                throw new Error('Upload failed');
            }
        }
        catch (error) {
            toast({
                title: "Upload Failed",
                description: "Failed to upload and process the log file",
                variant: "destructive",
            });
        }
        finally {
            setIsUploading(false);
            // Reset the input
            event.target.value = '';
        }
    };
    const handleFileDrop = (event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file && (file.name.endsWith('.log') || file.name.endsWith('.txt'))) {
            // Create a fake input event to reuse the upload logic
            const fakeEvent = {
                target: { files: [file], value: '' }
            };
            handleFileUpload(fakeEvent);
        }
        else {
            toast({
                title: "Invalid File",
                description: "Please upload a .log or .txt file",
                variant: "destructive",
            });
        }
    };
    const handleDragOver = (event) => {
        event.preventDefault();
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'connected':
                return 'text-emerald-400';
            case 'connecting':
                return 'text-yellow-400';
            case 'disconnected':
                return 'text-red-400';
            default:
                return 'text-gray-400';
        }
    };
    const getStatusDot = (status) => {
        const baseClass = "w-2 h-2 rounded-full";
        switch (status) {
            case 'connected':
                return `${baseClass} bg-emerald-500 animate-pulse`;
            case 'connecting':
                return `${baseClass} bg-yellow-500 animate-pulse`;
            case 'disconnected':
                return `${baseClass} bg-red-500`;
            default:
                return `${baseClass} bg-gray-500`;
        }
    };
    return (_jsxs("div", { className: "w-80 bg-gray-800 border-r border-gray-700 flex flex-col", "data-testid": "sidebar-container", children: [_jsx("div", { className: "p-6 border-b border-gray-700", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center", children: _jsx(FileText, { className: "w-5 h-5 text-white" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-white", children: "Tomcat Monitor" }), _jsx("p", { className: "text-sm text-gray-400", children: "Log Analysis Tool" })] })] }) }), _jsxs("div", { className: "p-4 border-b border-gray-700", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm font-medium text-gray-300", children: "Server Status" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: getStatusDot(serverStatus) }), _jsx("span", { className: `text-sm capitalize ${getStatusColor(serverStatus)}`, "data-testid": "server-status", children: serverStatus })] })] }), _jsxs("div", { className: "mt-2 text-xs text-gray-500", children: ["Last update: ", serverStatus === 'connected' ? 'just now' : '---'] })] }), _jsxs("div", { className: "p-4 border-b border-gray-700", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300 mb-3", children: "Log File" }), _jsxs("div", { className: "border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-primary-500 transition-colors cursor-pointer relative", onDrop: handleFileDrop, onDragOver: handleDragOver, "data-testid": "file-upload-area", children: [_jsx("input", { type: "file", accept: ".log,.txt", onChange: handleFileUpload, disabled: isUploading, className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer", "data-testid": "file-input" }), _jsx(Upload, { className: "w-8 h-8 text-gray-500 mb-2 mx-auto" }), _jsx("p", { className: "text-sm text-gray-400", children: isUploading ? 'Processing...' : 'Drop log file here or click to browse' }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Supports .log, .txt files" })] }), files.length > 0 && (_jsx("div", { className: "mt-3 space-y-2", children: files.map((file) => (_jsx(Card, { className: `p-3 cursor-pointer transition-colors ${currentFile?.id === file.id
                                ? 'bg-primary-500/20 border-primary-500'
                                : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`, onClick: () => onFileSelect(file), "data-testid": `file-item-${file.id}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-gray-300 truncate", children: file.fileName }), _jsx("span", { className: `text-xs ${file.status === 'active' ? 'text-emerald-400' : 'text-gray-400'}`, children: file.status })] }) }, file.id))) }))] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: _jsx(FilterControls, { filterSettings: filterSettings, "data-testid": "filter-controls" }) }), currentFile && (_jsx("div", { className: "border-t border-gray-700", children: _jsx(LogStatistics, { fileId: currentFile.id, "data-testid": "log-statistics" }) }))] }));
}
