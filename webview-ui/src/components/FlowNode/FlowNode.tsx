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
import { ChevronDown, ChevronRight, ShieldAlert, Info } from "lucide-react";
import type { FlowNode as FlowNodeType, NodeTypeConfig } from "../../types";
import { NODE_CONFIG } from "../../constants";
import { Tooltip } from "../Tooltip";

// ============================================================================
// TYPES
// ============================================================================

export interface FlowNodeProps {
  node: FlowNodeType;
  isSelected: boolean;
  isGoToTarget?: boolean;
  incomingGoToCount?: number;
  isCollapsed?: boolean;
  isBranchingNode?: boolean;
  onSelect: (node: FlowNodeType) => void;
  onToggleCollapse?: (nodeId: string) => void;
  violations?: Array<{
    severity: "error" | "warning" | "note";
    rule: string;
    message: string;
  }>;
  onOpenQualityTab?: () => void;
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
  isCollapsed = false,
  isBranchingNode = false,
  onSelect,
  onToggleCollapse,
  violations = [],
  onOpenQualityTab,
}) => {
  const config: NodeTypeConfig = NODE_CONFIG[node.type] || NODE_CONFIG.ACTION;

  // Get highest severity violation for badge
  const highestSeverity = violations.length > 0
    ? violations.some(v => v.severity === "error")
      ? "error"
      : violations.some(v => v.severity === "warning")
        ? "warning"
        : "note"
    : null;

  // Get badge style
  const getBadgeStyle = () => {
    switch (highestSeverity) {
      case "error":
        return {
          bg: "bg-red-500/90 hover:bg-red-600",
          text: "text-white",
          icon: "text-white",
        };
      case "warning":
        return {
          bg: "bg-yellow-400 hover:bg-yellow-500",
          text: "text-slate-900",
          icon: "text-slate-900",
        };
      case "note":
        return {
          bg: "bg-blue-500/90 hover:bg-blue-600",
          text: "text-white",
          icon: "text-white",
        };
      default:
        return {
          bg: "",
          text: "",
          icon: "",
        };
    }
  };

  const badgeStyle = getBadgeStyle();
  const hasDescription = !!node.data.description;

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
              shadow transition-all relative
              ${isSelected ? "ring-3 ring-red-200 dark:ring-red-900" : "hover:shadow-md"}
            `}
          >
            <config.icon size={12} className="text-white" fill="white" />
            
            {/* Description Indicator for End Node */}
            {hasDescription && (
              <Tooltip content={node.data.description} maxWidth={200} side="top">
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-sm border border-white dark:border-slate-800">
                  <Info size={8} />
                </div>
              </Tooltip>
            )}
          </div>

          {/* Label */}
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-2">
            End
          </div>

          {/* Incoming GoTo indicator */}
          {incomingGoToCount > 0 && (
            <div className="text-[10px] text-blue-500 dark:text-blue-400 italic ml-2">
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
        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800 shadow-sm mb-2" />

        {/* End circle */}
        <div
          className={`
            w-8 h-8 rounded-full bg-red-500 flex items-center justify-center cursor-pointer
            shadow transition-all relative
            ${isSelected ? "ring-3 ring-red-200 dark:ring-red-900" : "hover:shadow-md"}
          `}
        >
          <config.icon size={12} className="text-white" fill="white" />
          
          {/* Description Indicator for End Node */}
          {hasDescription && (
            <Tooltip content={node.data.description} maxWidth={200} side="right">
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-sm border border-white dark:border-slate-800">
                <Info size={8} />
              </div>
            </Tooltip>
          )}
        </div>

        {/* Label */}
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5">
          End
        </div>

        {/* Incoming GoTo indicator */}
        {incomingGoToCount > 0 && (
          <div className="text-[10px] text-blue-500 dark:text-blue-400 italic mt-0.5">
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
            rounded-lg border shadow-sm cursor-pointer overflow-hidden transition-all relative
            ${isSelected
              ? "border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-900"
              : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-md"
            }
            bg-white dark:bg-slate-800
          `}
        >
          {/* Description Indicator */}
          {hasDescription && (
            <div className="absolute top-2 right-2 z-10">
              <Tooltip content={node.data.description} maxWidth={240} side="left">
                <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 flex items-center justify-center transition-colors">
                  <Info size={10} />
                </div>
              </Tooltip>
            </div>
          )}

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
            <div className="flex-1 min-w-0 pr-4">
              <div
                className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate"
                title={node.label}
              >
                {node.label}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Start
              </div>
            </div>
          </div>

          {/* Trigger details panel - Salesforce style with inline labels */}
          {showExpansion && (
            <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 text-[13px] space-y-0.5">
              {hasObject && (
                <div className="flex items-baseline">
                  <span className="text-slate-500 dark:text-slate-400 mr-1">
                    Object:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {node.data.object}
                  </span>
                </div>
              )}
              {node.data.recordTriggerType && (
                <div className="flex items-baseline">
                  <span className="text-slate-500 dark:text-slate-400 mr-1">
                    Trigger:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {getRecordTriggerLabel(
                      node.data.recordTriggerType as string
                    )}
                  </span>
                </div>
              )}
              {node.data.triggerType && (
                <div className="flex items-baseline">
                  <span className="text-slate-500 dark:text-slate-400 mr-1 whitespace-nowrap">
                    Optimize for:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {getOptimizeForLabel(node.data.triggerType as string)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom connector dot */}
        <div className="flex justify-center -mt-1 relative z-10">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800 shadow-sm" />
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
            className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 shadow-sm whitespace-nowrap"
            title={`${incomingGoToCount} incoming GoTo connection${incomingGoToCount > 1 ? "s" : ""}`}
          >
            ↵ {incomingGoToCount} connection{incomingGoToCount > 1 ? "s" : ""}
          </div>
        )}
        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800 shadow-sm" />
      </div>

      {/* Node card */}
      <div
        className={`
          rounded-md border shadow-sm hover:shadow-md cursor-pointer overflow-visible transition-all duration-200 ease-out relative group
          ${isSelected
            ? "border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/50"
            : isCollapsed
              ? "border-amber-400 dark:border-amber-600 collapsed-blink"
              : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700"
          }
          ${isCollapsed ? "bg-amber-50 dark:bg-amber-950/30" : "bg-white dark:bg-slate-800"}
        `}
      >
        {/* Violation badge - integrated into top-right corner */}
        {violations.length > 0 && (
          <div
            className={`absolute -top-2 -right-2 px-1.5 py-1 rounded-full shadow-md cursor-pointer transition-transform duration-200 z-20 flex items-center gap-1 ${badgeStyle.bg} ${badgeStyle.text} hover:scale-110`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenQualityTab?.();
            }}
            title={`${violations.length} quality ${violations.length === 1 ? 'issue' : 'issues'} - Click to view details`}
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${badgeStyle.icon}`} />
            <span className="text-[10px] font-bold">{violations.length}</span>
          </div>
        )}

        <div className="flex items-stretch relative">
          {/* Icon - diamond shape for DECISION/WAIT nodes */}
          {node.type === "DECISION" || node.type === "WAIT" ? (
            <div className="w-12 flex items-center justify-center flex-shrink-0 py-2">
              <div
                className="w-8 h-8 flex items-center justify-center transform rotate-45 rounded-sm shadow-sm transition-transform group-hover:scale-105 duration-200"
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
              className="w-12 flex items-center justify-center flex-shrink-0 rounded-l-md"
              style={{ backgroundColor: config.color }}
            >
              <config.icon size={18} className="text-white transition-transform group-hover:scale-110 duration-200" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 px-3 py-2.5 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                {config.label}
              </span>
              {/* Description Indicator - Inline with label */}
              {hasDescription && (
                <Tooltip content={node.data.description} maxWidth={240} side="top">
                  <div className="text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-help">
                    <Info size={11} strokeWidth={2.5} />
                  </div>
                </Tooltip>
              )}
            </div>
            <div
              className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight"
              title={node.label}
            >
              {node.label}
            </div>
          </div>

          {/* Collapse button for branching nodes */}
          {isBranchingNode && onToggleCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(node.id);
              }}
              className="px-2 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-l border-slate-200 dark:border-slate-700"
              title={isCollapsed ? "Expand branches" : "Collapse branches"}
            >
              {isCollapsed ? (
                <ChevronRight
                  size={16}
                  className="text-slate-400 dark:text-slate-500"
                />
              ) : (
                <ChevronDown
                  size={16}
                  className="text-slate-400 dark:text-slate-500"
                />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Bottom connector dot */}
      <div className="flex justify-center -mt-1 relative z-10">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800 shadow-sm" />
      </div>

      {/* Collapsed indicator badge */}
      {isCollapsed && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-[10px] font-semibold text-amber-700 dark:text-amber-300 rounded-full whitespace-nowrap shadow-sm border border-amber-300 dark:border-amber-700">
          ▶ Collapsed
        </div>
      )}
    </div>
  );
};

export default FlowNodeComponent;
