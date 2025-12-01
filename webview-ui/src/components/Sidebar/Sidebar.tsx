/**
 * Sidebar Component
 *
 * Collapsible sidebar showing flow stats and selected node details.
 */

import React from "react";
import { ChevronLeftCircle, ChevronRightCircle, Info, Activity } from "lucide-react";
import type { FlowNode, FlowEdge } from "../../types";
import type { FlowQualityMetrics } from "../../utils/flow-scanner";
import { FlowStats } from "./FlowStats";
import { NodeDetails } from "./NodeDetails";
import { FlowQuality } from "./FlowQuality";

export type TabView = "details" | "quality";

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedNode: FlowNode | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  qualityMetrics: FlowQualityMetrics | null;
  activeTab: TabView;
  onTabChange: (tab: TabView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  selectedNode,
  nodes,
  edges,
  qualityMetrics,
  activeTab,
  onTabChange,
}) => {
  // Show quality tab if there are violations
  const hasViolations = (qualityMetrics?.totalViolations || 0) > 0;
  return (
    <>
      {/* Sidebar panel */}
      <div
        className="bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shadow-lg transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0"
        style={{ width: isOpen ? 320 : 0 }}
      >
        {/* Stats */}
        <FlowStats nodeCount={nodes.length} edgeCount={edges.length} />

        {/* Tab Navigation */}
        {qualityMetrics && (
          <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <button
              onClick={() => onTabChange("details")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === "details"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/10"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
            >
              <Info className="w-3.5 h-3.5" />
              Details
            </button>
            <button
              onClick={() => onTabChange("quality")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === "quality"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/10"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Quality
              {hasViolations && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-semibold">
                  {qualityMetrics.totalViolations}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Content Panel */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "details" ? (
            selectedNode ? (
              <NodeDetails node={selectedNode} edges={edges} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 p-6">
                <Info className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-center text-xs">
                  Select a node to view details
                </p>
              </div>
            )
          ) : (
            <FlowQuality metrics={qualityMetrics} />
          )}
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-lg shadow-md p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
        style={{ left: isOpen ? 308 : 0, marginTop: "40px" }}
      >
        {isOpen ? (
          <ChevronLeftCircle
            size={20}
            className="text-slate-500 dark:text-slate-400"
          />
        ) : (
          <ChevronRightCircle
            size={20}
            className="text-slate-500 dark:text-slate-400"
          />
        )}
      </button>
    </>
  );
};

export default Sidebar;
