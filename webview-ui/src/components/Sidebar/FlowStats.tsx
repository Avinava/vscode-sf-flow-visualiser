/**
 * Flow Stats Component
 *
 * Displays statistics about the flow including:
 * - Node/edge counts
 * - Cyclomatic complexity score with rating
 * - Node breakdown by type
 */

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react";
import type { FlowNode, FlowEdge, NodeTypeConfig } from "../../types";
import { NODE_CONFIG } from "../../constants";
import {
  calculateComplexity,
  getComplexityColorClass,
  type ComplexityMetrics,
} from "../../utils/complexity";

export interface FlowStatsProps {
  nodeCount: number;
  edgeCount: number;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
}

export const FlowStats: React.FC<FlowStatsProps> = ({
  nodeCount,
  edgeCount,
  nodes = [],
  edges = [],
}) => {
  const [expanded, setExpanded] = useState(false);

  // Calculate complexity metrics
  const metrics: ComplexityMetrics | null = useMemo(() => {
    if (nodes.length === 0) return null;
    return calculateComplexity(nodes, edges);
  }, [nodes, edges]);

  // Filter out internal node types for display
  const displayableNodeTypes = useMemo(() => {
    if (!metrics) return [];
    return Object.entries(metrics.nodesByType)
      .filter(
        ([type]) => !["ROOT", "BRANCH", "GROUP", "START", "END"].includes(type)
      )
      .sort((a, b) => b[1] - a[1]);
  }, [metrics]);

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
      {/* Main stats row */}
      <div className="px-4 py-2 flex items-center gap-4 text-xs">
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

        {/* Complexity badge */}
        {metrics && (
          <span
            className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${getComplexityColorClass(metrics.rating)}`}
            onClick={() => setExpanded(!expanded)}
            title={`Cyclomatic Complexity: ${metrics.cyclomaticComplexity}`}
          >
            CC: {metrics.cyclomaticComplexity}
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && metrics && (
        <div className="px-4 pb-3 pt-1 space-y-3 border-t border-slate-200 dark:border-slate-700">
          {/* Complexity description */}
          <div className="flex items-start gap-2">
            <Info
              size={14}
              className="text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0"
            />
            <div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {metrics.description}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Complexity: {metrics.breakdown.base} base +{" "}
                {metrics.breakdown.decisions} decisions +{" "}
                {metrics.breakdown.loops} loops + {metrics.breakdown.waits}{" "}
                waits + {metrics.breakdown.faults} faults
              </div>
            </div>
          </div>

          {/* Node breakdown by type */}
          {displayableNodeTypes.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                Elements by Type
              </div>
              <div className="grid grid-cols-2 gap-1">
                {displayableNodeTypes.map(([type, count]) => {
                  const config: NodeTypeConfig =
                    NODE_CONFIG[type as keyof typeof NODE_CONFIG] ||
                    NODE_CONFIG.ACTION;
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-1.5 text-xs py-0.5"
                    >
                      <span
                        className="w-2 h-2 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="text-slate-600 dark:text-slate-400 truncate">
                        {config.label}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 ml-auto">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {metrics.recommendations.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                Recommendations
              </div>
              <div className="space-y-1">
                {metrics.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400"
                  >
                    <AlertTriangle
                      size={11}
                      className="text-amber-500 mt-0.5 flex-shrink-0"
                    />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FlowStats;
