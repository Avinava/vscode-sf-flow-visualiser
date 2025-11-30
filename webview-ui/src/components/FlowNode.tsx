/**
 * Flow Node Component
 *
 * Renders individual flow nodes following Salesforce's alcNode pattern.
 *
 * Based on:
 * - alcNode.js: Node rendering, icon handling, selection
 * - alcCompoundNode.js: Compound node structure
 * - alcElementCard.js: Element card mode
 */

import React from "react";
import type { FlowNode as FlowNodeType, NodeTypeConfig } from "../types";
import { NODE_CONFIG } from "../constants";

// ============================================================================
// TYPES
// ============================================================================

interface FlowNodeProps {
  node: FlowNodeType;
  isSelected: boolean;
  isGoToTarget?: boolean;
  onSelect: (node: FlowNodeType) => void;
}

// ============================================================================
// NODE COMPONENT
// ============================================================================

export const FlowNodeComponent: React.FC<FlowNodeProps> = ({
  node,
  isSelected,
  isGoToTarget = false,
  onSelect,
}) => {
  const config: NodeTypeConfig = NODE_CONFIG[node.type] || NODE_CONFIG.ACTION;

  // Special rendering for END nodes
  if (node.type === "END") {
    const isFaultPath = node.data.isFaultPath === true;

    // For fault-path END nodes, position horizontally
    if (isFaultPath) {
      return (
        <div
          className="flow-node absolute flex flex-row items-center"
          style={{ left: node.x, top: node.y, width: node.width }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node);
          }}
        >
          {/* End circle */}
          <div
            className={`
              w-8 h-8 rounded-full bg-red-500 flex items-center justify-center cursor-pointer
              shadow transition-all
              ${isSelected ? "ring-3 ring-red-200" : "hover:shadow-md"}
            `}
          >
            <config.icon size={12} className="text-white" fill="white" />
          </div>

          {/* Label */}
          <div className="text-xs font-medium text-slate-500 ml-2">End</div>
        </div>
      );
    }

    // Normal END node (vertical connection from above)
    return (
      <div
        className="flow-node absolute flex flex-col items-center"
        style={{ left: node.x, top: node.y, width: node.width }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
      >
        {/* Top connector dot */}
        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white shadow-sm mb-2" />

        {/* End circle */}
        <div
          className={`
            w-8 h-8 rounded-full bg-red-500 flex items-center justify-center cursor-pointer
            shadow transition-all
            ${isSelected ? "ring-3 ring-red-200" : "hover:shadow-md"}
          `}
        >
          <config.icon size={12} className="text-white" fill="white" />
        </div>

        {/* Label */}
        <div className="text-xs font-medium text-slate-500 mt-1.5">End</div>
      </div>
    );
  }

  // Standard node rendering
  return (
    <div
      className="flow-node absolute"
      style={{ left: node.x, top: node.y, width: node.width }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
    >
      {/* Top connector dot */}
      {node.type !== "START" && (
        <div className="flex justify-center -mb-1 relative z-10">
          {isGoToTarget && (
            <div
              className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white bg-blue-500 shadow-sm"
              title="GoTo Target"
            >
              ↵
            </div>
          )}
          <div className="w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white shadow-sm" />
        </div>
      )}

      {/* Node card */}
      <div
        className={`
          rounded-lg border shadow-sm cursor-pointer overflow-hidden transition-all
          ${
            isSelected
              ? "border-blue-500 shadow-lg ring-2 ring-blue-200"
              : "border-slate-200 hover:border-slate-300 hover:shadow-md"
          }
          bg-white
        `}
      >
        <div className="flex items-stretch">
          {/* Icon - diamond shape for DECISION/WAIT nodes */}
          {node.type === "DECISION" || node.type === "WAIT" ? (
            <div className="w-12 flex items-center justify-center flex-shrink-0 py-2">
              <div
                className="w-8 h-8 flex items-center justify-center transform rotate-45 rounded-sm"
                style={{ backgroundColor: config.color }}
              >
                <config.icon
                  size={14}
                  className="text-white transform -rotate-45"
                />
              </div>
            </div>
          ) : (
            <div
              className="w-12 flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: config.color }}
            >
              <config.icon size={18} className="text-white" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 px-3 py-2 min-w-0">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
              {config.label}
            </div>
            <div
              className="text-sm font-semibold text-slate-800 truncate"
              title={node.label}
            >
              {node.label}
            </div>
            {node.type === "START" &&
              typeof node.data.object === "string" &&
              node.data.object && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Object: {node.data.object}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Bottom connector dot */}
      <div className="flex justify-center -mt-1 relative z-10">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white shadow-sm" />
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default FlowNodeComponent;
