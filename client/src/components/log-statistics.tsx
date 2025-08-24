import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

interface LogStatisticsProps {
  fileId: string;
}

interface Statistics {
  total: number;
  errors: number;
  warnings: number;
}

export function LogStatistics({ fileId }: LogStatisticsProps) {
  const { data: stats } = useQuery<Statistics>({
    queryKey: ['/api/stats', fileId],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-gray-400 mb-3">Statistics</h3>
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gray-700 border-gray-600 rounded-lg p-3">
          <div className="text-lg font-bold text-red-400" data-testid="stats-errors">
            {stats?.errors ?? 0}
          </div>
          <div className="text-xs text-gray-400">Errors</div>
        </Card>
        <Card className="bg-gray-700 border-gray-600 rounded-lg p-3">
          <div className="text-lg font-bold text-amber-400" data-testid="stats-warnings">
            {stats?.warnings ?? 0}
          </div>
          <div className="text-xs text-gray-400">Warnings</div>
        </Card>
        <Card className="bg-gray-700 border-gray-600 rounded-lg p-3 col-span-2">
          <div className="text-lg font-bold text-blue-400" data-testid="stats-total">
            {stats?.total ?? 0}
          </div>
          <div className="text-xs text-gray-400">Total Entries</div>
        </Card>
      </div>
    </div>
  );
}
