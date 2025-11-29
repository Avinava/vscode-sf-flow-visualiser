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
  onSelect: (node: FlowNodeType) => void;
}

// ============================================================================
// NODE COMPONENT
// ============================================================================

export const FlowNodeComponent: React.FC<FlowNodeProps> = ({
  node,
  isSelected,
  onSelect,
}) => {
  const config: NodeTypeConfig = NODE_CONFIG[node.type] || NODE_CONFIG.ACTION;

  // Special rendering for END nodes
  if (node.type === "END") {
    const isFaultPath = node.data.isFaultPath === true;

    return (
      <div
        className="flow-node absolute flex flex-col items-center"
        style={{ left: node.x, top: node.y, width: node.width }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
      >
        {/* Top connector dot (only for non-fault-path ends) */}
        {!isFaultPath && (
          <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow mb-2" />
        )}

        {/* End circle */}
        <div
          className={`
            w-10 h-10 rounded-full bg-red-500 flex items-center justify-center cursor-pointer
            shadow-md transition-all
            ${isSelected ? "ring-4 ring-red-200" : "hover:shadow-lg"}
          `}
        >
          <config.icon size={16} className="text-white" fill="white" />
        </div>

        {/* Label */}
        <div className="text-xs font-medium text-slate-600 mt-1.5">End</div>
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
        <div className="flex justify-center -mb-1.5 relative z-10">
          <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow" />
        </div>
      )}

      {/* Node card */}
      <div
        className={`
          rounded-xl border-2 shadow-md cursor-pointer overflow-hidden transition-all
          ${
            isSelected
              ? "border-blue-500 shadow-lg ring-2 ring-blue-200"
              : "border-slate-200 hover:border-slate-300 hover:shadow-lg"
          }
          bg-white
        `}
      >
        <div className="flex items-stretch">
          {/* Icon */}
          <div
            className="w-10 flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: config.color }}
          >
            <config.icon size={16} className="text-white" />
          </div>

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
      <div className="flex justify-center -mt-1.5 relative z-10">
        <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow" />
      </div>
    </div>
  );
};

// ============================================================================
// START NODE COMPONENT
// Special rendering for start nodes with trigger information
// ============================================================================

interface StartNodeProps {
  node: FlowNodeType;
  isSelected: boolean;
  onSelect: (node: FlowNodeType) => void;
}

export const StartNodeComponent: React.FC<StartNodeProps> = ({
  node,
  isSelected,
  onSelect,
}) => {
  const config = NODE_CONFIG.START;
  const triggerType = node.data.triggerType as string;
  const object = node.data.object as string;

  return (
    <div
      className="flow-node absolute"
      style={{ left: node.x, top: node.y, width: node.width }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
    >
      {/* Node card */}
      <div
        className={`
          rounded-xl border-2 shadow-md cursor-pointer overflow-hidden transition-all
          ${
            isSelected
              ? "border-green-500 shadow-lg ring-2 ring-green-200"
              : "border-slate-200 hover:border-slate-300 hover:shadow-lg"
          }
          bg-white
        `}
      >
        <div className="flex items-stretch">
          {/* Icon */}
          <div
            className="w-10 flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: config.color }}
          >
            <config.icon size={16} className="text-white" />
          </div>

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
            {object && (
              <div className="text-[10px] text-slate-500 mt-0.5">
                Object: {object}
              </div>
            )}
            {triggerType && (
              <div className="text-[10px] text-green-600 font-medium mt-0.5">
                {triggerType === "RecordAfterSave" && "After Save"}
                {triggerType === "RecordBeforeSave" && "Before Save"}
                {triggerType === "Scheduled" && "Scheduled"}
                {triggerType === "PlatformEvent" && "Platform Event"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom connector dot */}
      <div className="flex justify-center -mt-1.5 relative z-10">
        <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow" />
      </div>
    </div>
  );
};

// ============================================================================
// END NODE COMPONENT
// Special rendering for end nodes
// ============================================================================

interface EndNodeProps {
  node: FlowNodeType;
  isSelected: boolean;
  onSelect: (node: FlowNodeType) => void;
}

export const EndNodeComponent: React.FC<EndNodeProps> = ({
  node,
  isSelected,
  onSelect,
}) => {
  const isFaultPath = node.data.isFaultPath === true;

  if (isFaultPath) {
    // Horizontal layout for fault path ends
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
            w-10 h-10 rounded-full bg-red-500 flex items-center justify-center cursor-pointer
            shadow-md transition-all
            ${isSelected ? "ring-4 ring-red-200" : "hover:shadow-lg"}
          `}
        >
          <NODE_CONFIG.END.icon size={16} className="text-white" fill="white" />
        </div>

        {/* Label */}
        <div className="text-xs font-medium text-slate-600 ml-2">End</div>
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
      <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow mb-2" />

      {/* End circle */}
      <div
        className={`
          w-10 h-10 rounded-full bg-red-500 flex items-center justify-center cursor-pointer
          shadow-md transition-all
          ${isSelected ? "ring-4 ring-red-200" : "hover:shadow-lg"}
        `}
      >
        <NODE_CONFIG.END.icon size={16} className="text-white" fill="white" />
      </div>

      {/* Label */}
      <div className="text-xs font-medium text-slate-600 mt-1.5">End</div>
    </div>
  );
};

// ============================================================================
// DECISION NODE COMPONENT
// Diamond-shaped node for decisions
// ============================================================================

interface DecisionNodeProps {
  node: FlowNodeType;
  isSelected: boolean;
  onSelect: (node: FlowNodeType) => void;
}

export const DecisionNodeComponent: React.FC<DecisionNodeProps> = ({
  node,
  isSelected,
  onSelect,
}) => {
  const config = NODE_CONFIG.DECISION;

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
      <div className="flex justify-center -mb-1.5 relative z-10">
        <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow" />
      </div>

      {/* Node card */}
      <div
        className={`
          rounded-xl border-2 shadow-md cursor-pointer overflow-hidden transition-all
          ${
            isSelected
              ? "border-amber-500 shadow-lg ring-2 ring-amber-200"
              : "border-slate-200 hover:border-slate-300 hover:shadow-lg"
          }
          bg-white
        `}
      >
        <div className="flex items-stretch">
          {/* Diamond icon container */}
          <div
            className="w-10 flex items-center justify-center flex-shrink-0 rotate-45"
            style={{ backgroundColor: config.color }}
          >
            <config.icon size={16} className="text-white -rotate-45" />
          </div>

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
      <div className="flex justify-center -mt-1.5 relative z-10">
        <div className="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow" />
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default FlowNodeComponent;
