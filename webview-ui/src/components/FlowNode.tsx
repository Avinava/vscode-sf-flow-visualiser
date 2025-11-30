/**
 * Flow Node Component
 *
 * Renders individual flow nodes following Salesforce's alcNode pattern.
 *
 * Based on:
 * - alcNode.js: Node rendering, icon handling, selection
 * - alcCompoundNode.js: Compound node structure
 * - alcElementCard.js: Element card mode
 * - alcStartElementCard.js: Start node expansion panel
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
  incomingGoToCount?: number;
  onSelect: (node: FlowNodeType) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get human-readable record trigger type
 */
function getRecordTriggerLabel(recordTriggerType?: string): string {
  const types: Record<string, string> = {
    Create: "A record is created",
    Update: "A record is updated",
    CreateOrUpdate: "A record is created or updated",
    Delete: "A record is deleted",
  };
  return types[recordTriggerType || ""] || recordTriggerType || "";
}

/**
 * Get optimize for label
 */
function getOptimizeForLabel(triggerType?: string): string {
  if (triggerType === "RecordBeforeSave") {
    return "Fast Field Updates";
  }
  return "Actions and Related Records";
}

// ============================================================================
// NODE COMPONENT
// ============================================================================

export const FlowNodeComponent: React.FC<FlowNodeProps> = ({
  node,
  isSelected,
  isGoToTarget = false,
  incomingGoToCount = 0,
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

          {/* Incoming GoTo indicator */}
          {incomingGoToCount > 0 && (
            <div className="text-[10px] text-blue-500 italic ml-2">
              ↵ {incomingGoToCount} connection{incomingGoToCount > 1 ? "s" : ""}
            </div>
          )}
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

        {/* Incoming GoTo indicator */}
        {incomingGoToCount > 0 && (
          <div className="text-[10px] text-blue-500 italic mt-0.5">
            ↵ {incomingGoToCount} connection{incomingGoToCount > 1 ? "s" : ""}
          </div>
        )}
      </div>
    );
  }

  // Special rendering for START nodes with expanded trigger details
  if (node.type === "START") {
    const hasObject = typeof node.data.object === "string" && node.data.object;
    const hasTriggerInfo = node.data.triggerType || node.data.recordTriggerType;
    const showExpansion = hasObject || hasTriggerInfo;

    return (
      <div
        className="flow-node absolute"
        style={{ left: node.x, top: node.y, width: node.width }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
      >
        {/* Node card - Salesforce style */}
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
          {/* Main node header - Salesforce style with circular icon */}
          <div className="flex items-center p-3 gap-3">
            {/* Circular icon like Salesforce */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: config.color }}
            >
              <config.icon size={20} className="text-white" />
            </div>
            {/* Title and subtitle */}
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-semibold text-slate-800 truncate"
                title={node.label}
              >
                {node.label}
              </div>
              <div className="text-xs text-slate-500">Start</div>
            </div>
          </div>

          {/* Trigger details panel - Salesforce style with inline labels */}
          {showExpansion && (
            <div className="border-t border-slate-200 px-3 py-2 text-[13px] space-y-0.5">
              {hasObject && (
                <div className="flex items-baseline">
                  <span className="text-slate-500 mr-1">Object:</span>
                  <span className="font-medium text-slate-800">
                    {node.data.object}
                  </span>
                </div>
              )}
              {node.data.recordTriggerType && (
                <div className="flex items-baseline">
                  <span className="text-slate-500 mr-1">Trigger:</span>
                  <span className="font-medium text-slate-800">
                    {getRecordTriggerLabel(
                      node.data.recordTriggerType as string
                    )}
                  </span>
                </div>
              )}
              {node.data.triggerType && (
                <div className="flex items-baseline">
                  <span className="text-slate-500 mr-1">Optimize for:</span>
                  <span className="font-medium text-slate-800 truncate">
                    {getOptimizeForLabel(node.data.triggerType as string)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom connector dot */}
        <div className="flex justify-center -mt-1 relative z-10">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white shadow-sm" />
        </div>
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
      <div className="flex justify-center -mb-1 relative z-10">
        {isGoToTarget && (
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-medium text-blue-600 bg-blue-50 border border-blue-200 shadow-sm whitespace-nowrap"
            title={`${incomingGoToCount} incoming GoTo connection${incomingGoToCount > 1 ? "s" : ""}`}
          >
            ↵ {incomingGoToCount} connection{incomingGoToCount > 1 ? "s" : ""}
          </div>
        )}
        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white shadow-sm" />
      </div>

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
