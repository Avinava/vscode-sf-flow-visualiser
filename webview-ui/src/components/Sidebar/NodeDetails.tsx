/**
 * Node Details Component
 *
 * Displays detailed information about a selected flow node.
 */

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FlowNode, FlowEdge, NodeTypeConfig } from "../../types";
import { NODE_CONFIG } from "../../constants";

export interface NodeDetailsProps {
  node: FlowNode;
  edges: FlowEdge[];
}

export const NodeDetails: React.FC<NodeDetailsProps> = ({ node, edges }) => {
  const config: NodeTypeConfig = NODE_CONFIG[node.type] || NODE_CONFIG.ACTION;

  // Get outgoing and incoming edges
  const outgoingEdges = edges.filter((e) => e.source === node.id);
  const incomingEdges = edges.filter((e) => e.target === node.id);

  return (
    <div className="p-4">
      {/* Header with icon */}
      <div className="flex items-start gap-3 mb-4">
        {/* Icon with proper shape for DECISION/WAIT */}
        {node.type === "DECISION" || node.type === "WAIT" ? (
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <div
              className="w-8 h-8 flex items-center justify-center transform rotate-45 rounded-sm"
              style={{ backgroundColor: config.color }}
            >
              {React.createElement(config.icon, {
                size: 16,
                className: "text-white transform -rotate-45",
              })}
            </div>
          </div>
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: config.color }}
          >
            {React.createElement(config.icon, {
              size: 20,
              className: "text-white",
            })}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">
            {node.label}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {config.label}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3">
        {/* API Name */}
        <div>
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
            API Name
          </div>
          <div className="font-mono text-xs bg-slate-100 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 break-all">
            {node.id}
          </div>
        </div>

        {/* Object (if present) */}
        {typeof node.data.object === "string" && node.data.object && (
          <div>
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
              Object
            </div>
            <div className="text-xs bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700">
              {node.data.object}
            </div>
          </div>
        )}

        {/* Connections */}
        <div>
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
            Connections
          </div>
          <div className="space-y-1">
            {/* Outgoing */}
            {outgoingEdges.map((e) => (
              <div
                key={e.id}
                className={`text-xs flex items-center gap-1.5 px-2 py-1.5 rounded border
                  ${
                    e.type === "fault"
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                      : "bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
              >
                <ChevronRight size={12} />
                <span className="truncate flex-1">{e.target}</span>
                {e.label && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    ({e.label})
                  </span>
                )}
              </div>
            ))}

            {/* Incoming */}
            {incomingEdges.map((e) => (
              <div
                key={e.id}
                className="text-xs flex items-center gap-1.5 px-2 py-1.5 rounded border bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              >
                <ChevronLeft size={12} />
                <span className="truncate">{e.source}</span>
              </div>
            ))}
          </div>
        </div>

        {/* XML Preview (if available) */}
        {typeof node.data.xmlElement === "string" && node.data.xmlElement && (
          <div>
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
              XML
            </div>
            <pre className="text-[10px] bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-40 font-mono">
              {node.data.xmlElement.slice(0, 600)}
              {node.data.xmlElement.length > 600 && "..."}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeDetails;
