/**
 * Node Details Component
 *
 * Displays detailed information about a selected flow node,
 * similar to Salesforce Flow Builder's detail panel.
 */

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Settings,
  Filter,
  List,
  ArrowRightLeft,
  Database,
  Code,
} from "lucide-react";
import type { FlowNode, FlowEdge, NodeTypeConfig } from "../../types";
import { NODE_CONFIG } from "../../constants";

export interface NodeDetailsProps {
  node: FlowNode;
  edges: FlowEdge[];
}

// Collapsible Section Component
interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  defaultOpen = false,
  children,
  badge,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-slate-400 dark:text-slate-500">{icon}</span>
          )}
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
            {title}
          </span>
          {badge !== undefined && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp size={14} className="text-slate-400 dark:text-slate-500" />
        ) : (
          <ChevronDown
            size={14}
            className="text-slate-400 dark:text-slate-500"
          />
        )}
      </button>
      {isOpen && <div className="px-4 pb-3 pt-1 space-y-2">{children}</div>}
    </div>
  );
};

// Data Row Component
interface DataRowProps {
  label: string;
  value: string | React.ReactNode;
  isCode?: boolean;
}

const DataRow: React.FC<DataRowProps> = ({ label, value, isCode = false }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
      {label}
    </span>
    {isCode ? (
      <code className="text-xs bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 font-mono break-all">
        {value}
      </code>
    ) : (
      <span className="text-xs text-slate-700 dark:text-slate-300 break-words">
        {value}
      </span>
    )}
  </div>
);

// Operator display helper
function formatOperator(operator: string): string {
  const operators: Record<string, string> = {
    Assign: "=",
    Add: "Add",
    Subtract: "Subtract",
    EqualTo: "=",
    NotEqualTo: "≠",
    GreaterThan: ">",
    GreaterThanOrEqualTo: ">=",
    LessThan: "<",
    LessThanOrEqualTo: "<=",
    Contains: "Contains",
    StartsWith: "Starts With",
    EndsWith: "Ends With",
    IsNull: "Is Null",
    IsBlank: "Is Blank",
  };
  return operators[operator] || operator;
}

export const NodeDetails: React.FC<NodeDetailsProps> = ({ node, edges }) => {
  const config: NodeTypeConfig = NODE_CONFIG[node.type] || NODE_CONFIG.ACTION;
  const data = node.data;

  // Get outgoing and incoming edges
  const outgoingEdges = edges.filter((e) => e.source === node.id);
  const incomingEdges = edges.filter((e) => e.target === node.id);

  // Check what data is available
  const hasDescription = Boolean(data.description);
  const hasAssignments =
    Array.isArray(data.assignmentItems) && data.assignmentItems.length > 0;
  const hasInputAssignments =
    Array.isArray(data.inputAssignments) && data.inputAssignments.length > 0;
  const hasFilters = Array.isArray(data.filters) && data.filters.length > 0;
  const hasRules = Array.isArray(data.rules) && data.rules.length > 0;
  const hasScreenFields =
    Array.isArray(data.screenFields) && data.screenFields.length > 0;
  const hasLoopInfo = Boolean(data.collectionReference);
  const hasRecordInfo = Boolean(data.object) || Boolean(data.inputReference);

  return (
    <div className="flex flex-col h-full">
      {/* Header with icon */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-start gap-3">
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

        {/* Description if present */}
        {hasDescription && (
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
            {data.description}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* General Info Section */}
        <Section
          title="General"
          icon={<FileText size={12} />}
          defaultOpen={true}
        >
          <DataRow label="API Name" value={node.id} isCode />
          {data.object && (
            <DataRow label="Object" value={data.object as string} />
          )}
          {data.actionName && (
            <DataRow label="Action" value={data.actionName as string} />
          )}
          {data.actionType && (
            <DataRow label="Action Type" value={data.actionType as string} />
          )}
          {data.flowName && (
            <DataRow label="Subflow" value={data.flowName as string} />
          )}
        </Section>

        {/* Assignment Items */}
        {hasAssignments && (
          <Section
            title="Assignments"
            icon={<ArrowRightLeft size={12} />}
            defaultOpen={true}
            badge={data.assignmentItems?.length}
          >
            <div className="space-y-2">
              {data.assignmentItems?.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-200 dark:border-slate-700"
                >
                  <div className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
                    <span className="text-blue-600 dark:text-blue-400">
                      {item.field}
                    </span>
                    <span className="text-slate-500 mx-1">
                      {formatOperator(item.operator)}
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      {item.value || "(empty)"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Record Info */}
        {hasRecordInfo && (
          <Section
            title="Record Settings"
            icon={<Database size={12} />}
            defaultOpen={true}
          >
            {data.object && (
              <DataRow label="Object" value={data.object as string} />
            )}
            {data.inputReference && (
              <DataRow
                label="Record Variable"
                value={data.inputReference as string}
                isCode
              />
            )}
            {data.getFirstRecordOnly !== undefined && (
              <DataRow
                label="Records"
                value={
                  data.getFirstRecordOnly ? "First record only" : "All records"
                }
              />
            )}
            {data.sortField && (
              <DataRow
                label="Sort By"
                value={`${data.sortField} (${data.sortOrder || "Asc"})`}
              />
            )}
            {data.storeOutputAutomatically && (
              <DataRow label="Store Output" value="Automatically" />
            )}
          </Section>
        )}

        {/* Input Assignments (for record creates/updates, actions, subflows) */}
        {hasInputAssignments && (
          <Section
            title="Input Values"
            icon={<Settings size={12} />}
            defaultOpen={true}
            badge={data.inputAssignments?.length}
          >
            <div className="space-y-1.5">
              {data.inputAssignments?.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-xs bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-200 dark:border-slate-700"
                >
                  <span className="font-medium text-slate-600 dark:text-slate-400 min-w-[80px]">
                    {item.field}
                  </span>
                  <span className="text-slate-400">=</span>
                  <code className="text-green-600 dark:text-green-400 font-mono break-all">
                    {item.value || "(empty)"}
                  </code>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Filters/Conditions */}
        {hasFilters && (
          <Section
            title="Filter Conditions"
            icon={<Filter size={12} />}
            defaultOpen={true}
            badge={data.filters?.length}
          >
            {data.filterLogic && data.filterLogic !== "and" && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Logic:{" "}
                <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">
                  {data.filterLogic}
                </code>
              </div>
            )}
            <div className="space-y-1.5">
              {data.filters?.map((filter, idx) => (
                <div
                  key={idx}
                  className="text-xs bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-200 dark:border-slate-700"
                >
                  <span className="text-blue-600 dark:text-blue-400 font-mono">
                    {filter.field}
                  </span>
                  <span className="text-slate-500 mx-1">
                    {formatOperator(filter.operator)}
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-mono">
                    {filter.value || "(empty)"}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Decision Rules */}
        {hasRules && (
          <Section
            title="Outcomes"
            icon={<List size={12} />}
            defaultOpen={true}
            badge={data.rules?.length}
          >
            <div className="space-y-3">
              {data.rules?.map((rule, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  <div className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {rule.label}
                    </span>
                  </div>
                  {rule.conditions.length > 0 && (
                    <div className="p-2 space-y-1">
                      {rule.conditionLogic && rule.conditionLogic !== "and" && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                          Logic:{" "}
                          <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">
                            {rule.conditionLogic}
                          </code>
                        </div>
                      )}
                      {rule.conditions.map((cond, cidx) => (
                        <div key={cidx} className="text-xs font-mono">
                          <span className="text-blue-600 dark:text-blue-400">
                            {cond.field}
                          </span>
                          <span className="text-slate-500 mx-1">
                            {formatOperator(cond.operator)}
                          </span>
                          <span className="text-green-600 dark:text-green-400">
                            {cond.value || "(empty)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {/* Default outcome */}
              {data.defaultConnectorLabel && (
                <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Default: {data.defaultConnectorLabel as string}
                  </span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Loop Info */}
        {hasLoopInfo && (
          <Section
            title="Loop Settings"
            icon={<ArrowRightLeft size={12} />}
            defaultOpen={true}
          >
            <DataRow
              label="Collection Variable"
              value={data.collectionReference as string}
              isCode
            />
            {data.iterationOrder && (
              <DataRow
                label="Direction"
                value={data.iterationOrder as string}
              />
            )}
            {data.assignNextValueToReference && (
              <DataRow
                label="Loop Variable"
                value={data.assignNextValueToReference as string}
                isCode
              />
            )}
          </Section>
        )}

        {/* Screen Fields */}
        {hasScreenFields && (
          <Section
            title="Screen Fields"
            icon={<List size={12} />}
            defaultOpen={true}
            badge={data.screenFields?.length}
          >
            <div className="space-y-1.5">
              {data.screenFields?.map((field, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-200 dark:border-slate-700"
                >
                  <div>
                    <div className="font-medium text-slate-700 dark:text-slate-300">
                      {field.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {field.type}
                    </div>
                  </div>
                  {field.required && (
                    <span className="text-[10px] text-red-500 font-medium">
                      Required
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Connections */}
        <Section
          title="Connections"
          icon={<ArrowRightLeft size={12} />}
          defaultOpen={false}
          badge={outgoingEdges.length + incomingEdges.length}
        >
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
        </Section>

        {/* XML Preview */}
        {typeof data.xmlElement === "string" && data.xmlElement && (
          <Section
            title="XML Source"
            icon={<Code size={12} />}
            defaultOpen={false}
          >
            <pre className="text-[10px] bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-60 font-mono whitespace-pre-wrap break-all">
              {data.xmlElement.slice(0, 2000)}
              {data.xmlElement.length > 2000 && "\n\n... (truncated)"}
            </pre>
          </Section>
        )}
      </div>
    </div>
  );
};

export default NodeDetails;
