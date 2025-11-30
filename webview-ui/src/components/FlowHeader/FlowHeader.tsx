/**
 * Flow Header Component
 *
 * Displays flow metadata in a header bar similar to Salesforce Flow Builder.
 * Shows: flow name, description, status, object, trigger type, API version, complexity.
 *
 * Based on Salesforce's Flow Builder header patterns.
 */

import React, { useState } from "react";
import {
  FileText,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  Zap,
  Code,
  Activity,
  X,
  AlertTriangle,
} from "lucide-react";
import type { FlowMetadata } from "../../types";
import type { ComplexityMetrics } from "../../utils/complexity";
import { getComplexityColorClass } from "../../utils/complexity";

// ============================================================================
// TYPES
// ============================================================================

export interface FlowHeaderProps {
  metadata: FlowMetadata;
  fileName?: string;
  complexity?: ComplexityMetrics | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get human-readable process type label
 */
function getProcessTypeLabel(processType?: string): string {
  const types: Record<string, string> = {
    AutoLaunchedFlow: "Autolaunched Flow",
    Flow: "Screen Flow",
    Workflow: "Record-Triggered Flow",
    CustomEvent: "Platform Event-Triggered Flow",
    InvocableProcess: "Invocable Process",
    LoginFlow: "Login Flow",
    ActionPlan: "Action Plan",
    CheckoutFlow: "Checkout Flow",
    ContactRequestFlow: "Contact Request Flow",
    FSCLending: "FSC Lending Flow",
    FieldServiceMobile: "Field Service Mobile Flow",
    FieldServiceWeb: "Field Service Web Flow",
    IndividualObjectLinkingFlow: "Individual Object Linking Flow",
    Survey: "Survey Flow",
    SurveyEnrich: "Survey Enrich Flow",
    TransactionSecurityFlow: "Transaction Security Flow",
    UserProvisioningFlow: "User Provisioning Flow",
  };
  return types[processType || ""] || processType || "Flow";
}

/**
 * Get human-readable trigger type label
 */
function getTriggerTypeLabel(
  triggerType?: string,
  recordTriggerType?: string
): string {
  if (!triggerType) return "";

  const triggers: Record<string, string> = {
    RecordAfterSave: "After Save",
    RecordBeforeSave: "Before Save",
    RecordBeforeDelete: "Before Delete",
    Scheduled: "Scheduled",
    PlatformEvent: "Platform Event",
  };

  const triggerLabel = triggers[triggerType] || triggerType;

  // Add record trigger type info (Create, Update, CreateOrUpdate, Delete)
  if (recordTriggerType) {
    const recordTypes: Record<string, string> = {
      Create: "record is created",
      Update: "record is updated",
      CreateOrUpdate: "record is created or updated",
      Delete: "record is deleted",
    };
    const recordLabel = recordTypes[recordTriggerType] || recordTriggerType;
    return `${triggerLabel} - A ${recordLabel}`;
  }

  return triggerLabel;
}

/**
 * Get status badge styling
 */
function getStatusStyle(status?: string): {
  bg: string;
  text: string;
  icon: React.ElementType;
} {
  switch (status?.toLowerCase()) {
    case "active":
      return { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle };
    case "draft":
      return {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        icon: AlertCircle,
      };
    case "obsolete":
    case "inactive":
      return { bg: "bg-red-100", text: "text-red-700", icon: XCircle };
    default:
      return { bg: "bg-slate-100", text: "text-slate-600", icon: Info };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Complexity Badge with clickable popover showing details
 */
const ComplexityBadge: React.FC<{ complexity: ComplexityMetrics }> = ({
  complexity,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${getComplexityColorClass(complexity.rating)}`}
      >
        <Activity className="w-3.5 h-3.5" />
        <span>CC: {complexity.cyclomaticComplexity}</span>
        <span className="hidden sm:inline capitalize">
          ({complexity.rating.replace("-", " ")})
        </span>
      </button>

      {/* Details Popover */}
      {showDetails && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDetails(false)}
          />
          {/* Popover */}
          <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 animate-in">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  Complexity Details
                </span>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <X size={14} className="text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3">
              {/* Score and Rating */}
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {complexity.cyclomaticComplexity}
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getComplexityColorClass(complexity.rating)}`}
                >
                  {complexity.rating.replace("-", " ")}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {complexity.description}
              </p>

              {/* Breakdown */}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                  Score Breakdown
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      Base complexity
                    </span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {complexity.breakdown.base}
                    </span>
                  </div>
                  {complexity.breakdown.decisions > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">
                        Decision branches
                      </span>
                      <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
                        +{complexity.breakdown.decisions}
                      </span>
                    </div>
                  )}
                  {complexity.breakdown.loops > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">
                        Loop iterations
                      </span>
                      <span className="font-mono font-medium text-pink-600 dark:text-pink-400">
                        +{complexity.breakdown.loops}
                      </span>
                    </div>
                  )}
                  {complexity.breakdown.waits > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">
                        Wait paths
                      </span>
                      <span className="font-mono font-medium text-yellow-600 dark:text-yellow-400">
                        +{complexity.breakdown.waits}
                      </span>
                    </div>
                  )}
                  {complexity.breakdown.faults > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">
                        Fault handlers
                      </span>
                      <span className="font-mono font-medium text-red-600 dark:text-red-400">
                        +{complexity.breakdown.faults}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Total
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      {complexity.cyclomaticComplexity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {complexity.recommendations.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    Recommendations
                  </div>
                  <div className="space-y-1">
                    {complexity.recommendations.map((rec, idx) => (
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

            {/* Footer with info */}
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-b-lg border-t border-slate-200 dark:border-slate-700">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Cyclomatic complexity measures the number of linearly
                independent paths through a flow. Lower is better.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const FlowHeader: React.FC<FlowHeaderProps> = ({
  metadata,
  fileName,
  complexity,
}) => {
  const flowName =
    metadata.label ||
    fileName?.replace(".flow-meta.xml", "") ||
    "Untitled Flow";

  const processTypeLabel = getProcessTypeLabel(metadata.processType);
  const triggerLabel = getTriggerTypeLabel(
    metadata.triggerType,
    metadata.recordTriggerType
  );
  const statusStyle = getStatusStyle(metadata.status);
  const StatusIcon = statusStyle.icon;

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Flow Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {flowName}
          </h1>
          {/* Status Badge */}
          {metadata.status && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
            >
              <StatusIcon className="w-2.5 h-2.5" />
              {metadata.status}
            </span>
          )}
          {/* Process Type & API Version */}
          <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline-flex items-center gap-1">
            <Code className="w-3 h-3" />
            {processTypeLabel}
            {metadata.apiVersion && (
              <span className="text-slate-300 dark:text-slate-600 ml-1">
                v{metadata.apiVersion}
              </span>
            )}
          </span>
        </div>

        {/* Center/Right: Complexity Score with clickable popover */}
        {complexity && <ComplexityBadge complexity={complexity} />}

        {/* Right: Trigger Info */}
        {(metadata.object || triggerLabel) && (
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
            {metadata.object && (
              <span className="inline-flex items-center gap-1">
                <Database className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {metadata.object}
                </span>
              </span>
            )}
            {triggerLabel && (
              <span className="inline-flex items-center gap-1 hidden md:inline-flex">
                <Zap className="w-3 h-3" />
                {triggerLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowHeader;
