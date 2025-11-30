/**
 * Sidebar Component
 *
 * Collapsible sidebar showing flow stats and selected node details.
 */

import React from "react";
import { ChevronLeftCircle, ChevronRightCircle, Info } from "lucide-react";
import type { FlowNode, FlowEdge } from "../../types";
import { FlowStats } from "./FlowStats";
import { NodeDetails } from "./NodeDetails";

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedNode: FlowNode | null;
  nodeCount: number;
  edgeCount: number;
  edges: FlowEdge[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  selectedNode,
  nodeCount,
  edgeCount,
  edges,
}) => {
  return (
    <>
      {/* Sidebar panel */}
      <div
        className="bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shadow-lg transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0"
        style={{ width: isOpen ? 320 : 0 }}
      >
        {/* Stats */}
        <FlowStats nodeCount={nodeCount} edgeCount={edgeCount} />

        {/* Details Panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedNode ? (
            <NodeDetails node={selectedNode} edges={edges} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 p-6">
              <Info className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-center text-xs">
                Select a node to view details
              </p>
            </div>
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
