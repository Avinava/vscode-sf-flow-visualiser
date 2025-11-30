/**
 * Flow Stats Component
 *
 * Displays statistics about the flow (node count, edge count).
 */

import React from "react";

export interface FlowStatsProps {
  nodeCount: number;
  edgeCount: number;
}

export const FlowStats: React.FC<FlowStatsProps> = ({
  nodeCount,
  edgeCount,
}) => {
  return (
    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex gap-4 text-xs flex-shrink-0">
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
        <span className="text-slate-500 dark:text-slate-400">connections</span>
      </span>
    </div>
  );
};

export default FlowStats;
