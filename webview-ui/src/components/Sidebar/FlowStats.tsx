/**
 * Flow Stats Component
 *
 * Displays basic statistics about the flow including node and edge counts.
 * Complexity metrics are shown in the header instead.
 */

import { X } from "lucide-react";

export interface FlowStatsProps {
  nodeCount: number;
  edgeCount: number;
  onClose?: () => void;
}

export const FlowStats: React.FC<FlowStatsProps> = ({
  nodeCount,
  edgeCount,
  onClose,
}) => {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
      {/* Main stats row */}
      <div className="px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {nodeCount}
            </span>
            <span className="text-slate-500 dark:text-slate-400">nodes</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {edgeCount}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              connections
            </span>
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-500 dark:text-slate-400"
            title="Close sidebar"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default FlowStats;
