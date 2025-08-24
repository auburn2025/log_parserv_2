import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
export function LogStatistics({ fileId }) {
    const { data: stats } = useQuery({
        queryKey: ['/api/stats', fileId],
        refetchInterval: 5000, // Refresh every 5 seconds
    });
    return (_jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "text-xs font-semibold text-gray-400 mb-3", children: "Statistics" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs(Card, { className: "bg-gray-700 border-gray-600 rounded-lg p-3", children: [_jsx("div", { className: "text-lg font-bold text-red-400", "data-testid": "stats-errors", children: stats?.errors ?? 0 }), _jsx("div", { className: "text-xs text-gray-400", children: "Errors" })] }), _jsxs(Card, { className: "bg-gray-700 border-gray-600 rounded-lg p-3", children: [_jsx("div", { className: "text-lg font-bold text-amber-400", "data-testid": "stats-warnings", children: stats?.warnings ?? 0 }), _jsx("div", { className: "text-xs text-gray-400", children: "Warnings" })] }), _jsxs(Card, { className: "bg-gray-700 border-gray-600 rounded-lg p-3 col-span-2", children: [_jsx("div", { className: "text-lg font-bold text-blue-400", "data-testid": "stats-total", children: stats?.total ?? 0 }), _jsx("div", { className: "text-xs text-gray-400", children: "Total Entries" })] })] })] }));
}
